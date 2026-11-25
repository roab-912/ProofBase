// Client-side benchmark only. All data, salts and keys are disposable.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { wtns } from 'snarkjs';
import { scanZeroClear } from '../zero-clear.mjs';
import { timedSample } from './timed-sample.mjs';
import { checkInstalled } from './catalog.mjs';
import { createBatchTree } from '../../packages/core/src/batch-tree.ts';
import { createBatchHash } from '../../packages/sdk/src/batch-hash.ts';
import { createCommitmentAdapter } from '../../packages/sdk/src/commitment.ts';
import { encodeColumn } from '../../packages/sdk/src/encoding.ts';
import {
  createRecordEncryption,
  deriveRecordKey,
  recordAad,
} from '../../packages/sdk/src/record-encryption.ts';
import { prepareThresholdOpenings } from '../../packages/prover/src/threshold-openings.ts';

const size = Number(process.argv[2] ?? 16);
assert.ok([16, 64, 256].includes(size));
const dir = resolve(process.env.SPIKE_DIR ?? '.local/spike', String(size));
mkdirSync(dir, { recursive: true });
const tmp = mkdtempSync(join(dir, 'client-'));
const codec = await createRecordEncryption(),
  hasher = await createCommitmentAdapter();
const tree = await createBatchTree(await createBatchHash());
const ids = {
  tenantId: randomUUID(),
  keyId: randomUUID(),
  collectionId: randomUUID(),
};
const rootKey = randomBytes(32);
const key = await deriveRecordKey(rootKey, ids);
const privateLabel = 'spike-' + randomUUID();
const saltCanary = randomBytes(16);
const schema = { version: '1', columns: [{ type: 'int64' }] };
const max = (1n << 63n) + 8n;
const profile = JSON.parse(readFileSync('config/protocol.json', 'utf8'));
if (process.env.SPIKE_ENGINE === 'plonk')
  profile.proofSystemId = 'circom-plonk-bn254/dev1';
if (process.env.SPIKE_ENGINE === 'noir')
  profile.proofSystemId = 'noir-ultrahonk-bn254/dev1';
async function encryptFixture() {
  const rows = [];
  for (let i = 0; i < size; i++) {
    const value = String(i % 9),
      salt = i === 0 ? saltCanary : randomBytes(16);
    const encoded = encodeColumn({ type: 'int64', value });
    const colsCommit = hasher.commit(
      [encoded],
      BigInt('0x' + salt.toString('hex')),
    );
    const ctx = { ...ids, partitionId: 2n, colsCommit };
    const body = new TextEncoder().encode(
      JSON.stringify({
        eventTime: String(i),
        partitionLabel: privateLabel,
        salt: salt.toString('base64url'),
        schemaVersion: '1',
        values: [value],
      }),
    );
    const envelope = await codec.encrypt(body, recordAad(ctx), key);
    body.fill(0);
    rows.push({
      ...ctx,
      profile,
      ts: BigInt(i),
      pseq: BigInt(i + 1),
      envelope,
    });
  }
  return rows;
}
try {
  const engine = process.env.SPIKE_ENGINE ?? 'groth16';
  if (
    !['noir', 'groth16', 'plonk'].includes(engine) ||
    (process.env.RAPIDSNARK && engine !== 'groth16')
  )
    throw new Error('unsupported_prover');
  await checkInstalled(
    engine === 'noir'
      ? resolve(dir, '..', 'noir' + size)
      : engine === 'plonk'
        ? join(dir, 'plonk')
        : dir,
    size,
    engine,
    profile,
  );
  const dump = (value) =>
    JSON.stringify(value, (_, v) =>
      typeof v === 'bigint'
        ? String(v)
        : v instanceof Uint8Array
          ? Buffer.from(v).toString('base64url')
          : v,
    );
  const material = dump(await encryptFixture());
  const select = execFileSync(
    process.execPath,
    ['tools/spike/public-store.mjs'],
    { encoding: 'utf8', input: material, env: {} },
  );
  const artifacts = [
    ['request', material],
    ['storage', select],
  ].map(([kind, body]) => {
    const path = join(tmp, kind + '.json');
    writeFileSync(path, body, { mode: 0o600 });
    return { kind, path };
  });
  scanZeroClear({
    artifacts,
    requiredKinds: ['request', 'storage'],
    sentinels: [rootKey, Buffer.from(key.bytes), privateLabel, saltCanary],
  });
  const rows = JSON.parse(select);
  for (const row of rows) {
    assert.deepEqual(row.profile, profile);
    for (const k of ['ts', 'pseq', 'partitionId', 'colsCommit'])
      row[k] = BigInt(row[k]);
    for (const k of ['nonce', 'ciphertext'])
      row.envelope[k] = Buffer.from(row.envelope[k], 'base64url');
  }
  const path = await tree.inclusion(rows, 0n);
  const query = {
    ...ids,
    partitionId: 2n,
    from: 0n,
    to: BigInt(size),
    column: 0,
    max,
  };
  const start = performance.now();
  const openings = await prepareThresholdOpenings(
    { start: 0, count: size, size },
    rows,
    query,
    schema,
    {
      open: (r) => codec.decrypt(r.envelope, recordAad(r), key),
      commit: hasher.commit,
      encode: encodeColumn,
    },
  );
  const input = {
    columns: openings.columns,
    salts: openings.salts,
    root: path.root,
    start: 0,
    count: size,
    target: 2n,
    from: 0,
    to: size,
    column: 0,
    max,
    siblings: path.siblings.slice(Math.log2(size)),
  };
  for (const name of ['partitionId', 'pseq', 'ts', 'colsCommit'])
    input[name] = rows.map((row) => row[name]);
  if (process.env.SPIKE_ENGINE === 'noir') {
    const stringify = (value) =>
      JSON.stringify(value, (_, x) =>
        typeof x === 'number' || typeof x === 'bigint' ? String(x) : x,
      );
    writeFileSync(
      join(tmp, 'Prover.toml'),
      Object.entries(input)
        .map(([k, v]) => k + ' = ' + stringify(v))
        .join('\n'),
      { mode: 0o600 },
    );
    const pkg = resolve(dir, '..', 'noir' + size);
    const args = [
      'sh',
      'tools/spike/noir.sh',
      ...[pkg, tmp].map((p) =>
        relative(process.cwd(), p).replaceAll('\\', '/'),
      ),
    ];
    const raw =
      process.platform === 'win32'
        ? execFileSync('wsl', ['-d', 'Debian', '--', ...args], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit'],
          })
        : execFileSync(args[0], args.slice(1), {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit'],
          });
    const signals = readFileSync(join(tmp, 'public_inputs'));
    const expected = [
      path.root,
      0,
      size,
      2,
      0,
      size,
      0,
      max,
      size,
      2,
      1,
      0,
      2,
      size,
      size - 1,
      1,
      0,
      size,
      size - 1,
    ]
      .map((x) => BigInt(x).toString(16).padStart(64, '0'))
      .join('');
    assert.equal(signals.toString('hex'), expected);
    const results = raw
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const [p, m, v] = line.split(/\s+/).map(Number);
        return { proveMs: p * 1000, peakKiB: m, verifyMs: v * 1000 };
      });
    writeFileSync(
      join(dir, 'noir.json'),
      JSON.stringify({ size, results }, null, 2),
    );
  } else {
    const plonk = process.env.SPIKE_ENGINE === 'plonk';
    await wtns.calculate(
      input,
      join(dir, plonk ? 'plonk' : '', 'threshold_js', 'threshold.wasm'),
      join(tmp, 'client.wtns'),
    );
    const witnessMs = performance.now() - start;
    const expected = [
      size,
      2,
      1,
      0,
      2,
      size,
      size - 1,
      1,
      0,
      size,
      size - 1,
      path.root,
      0,
      size,
      2,
      0,
      size,
      0,
      max,
    ].map(String);
    writeFileSync(join(tmp, 'expected.json'), JSON.stringify(expected));
    const results = [];
    for (let i = 0; i < 3; i++) {
      if (plonk && size === 64 && process.env.SPIKE_TIMEBOX === '1') {
        results.push(await timedSample(dir, tmp, 60000));
        continue;
      }
      const sample = execFileSync(
        process.execPath,
        ['tools/spike/measure.mjs', dir, tmp],
        { encoding: 'utf8' },
      );
      results.push(JSON.parse(sample));
    }
    const report = { size, witnessMs, results };
    writeFileSync(
      join(
        dir,
        plonk
          ? 'plonk.json'
          : process.env.RAPIDSNARK
            ? 'native.json'
            : 'measurement.json',
      ),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  }
} finally {
  key.bytes.fill(0);
  rootKey.fill(0);
  saltCanary.fill(0);
  rmSync(tmp, { recursive: true, force: true });
}
