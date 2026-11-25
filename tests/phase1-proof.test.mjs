import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyThresholdBlock } from '../packages/verifier/src/threshold.ts';
import { createHash } from 'node:crypto';
import { proveBlock } from '../packages/prover/src/block-proof.ts';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkInstalled, installCatalog } from '../tools/spike/catalog.mjs';

test('development catalog detects altered witness programs and keys before proving', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'proofbase-catalog-'));
  try {
    await mkdir(join(dir, 'threshold_js'));
    const files = ['threshold_js/threshold.wasm', 'dev.zkey', 'vkey.json'];
    for (const file of files) await writeFile(join(dir, file), 'original');
    await installCatalog(dir, 16, 'groth16');
    const { profile } = JSON.parse(
      await readFile(join(dir, 'catalog.json'), 'utf8'),
    );
    await checkInstalled(dir, 16, 'groth16', profile);
    for (const file of files) {
      await writeFile(join(dir, file), 'changed');
      await assert.rejects(
        checkInstalled(dir, 16, 'groth16', profile),
        /invalid_installed_artifact/,
      );
      await writeFile(join(dir, file), 'original');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const vk = Uint8Array.of(1);
const sha = '0x' + createHash('sha256').update(vk).digest('hex');
const profile = Object.freeze({
  protocolId: 'proofbase/1',
  encodingId: 'e',
  recordHashId: 'h',
  batchTreeId: 't',
  anchorTreeId: 'a',
  proofSystemId: 'groth',
  encryptionSuiteId: 's',
});
const artifact = {
  id: 'threshold_max/16',
  circuitVersion: '1',
  protocolId: 'proofbase/1',
  proofSystemId: 'groth',
  ceremony: 'development',
  sha256: sha,
};
const query = {
  root: 1n,
  start: 0,
  count: 1,
  target: 2n,
  from: 0n,
  to: 1n,
  column: 0,
  max: 8n,
};
const proof = {
  protocol: profile,
  artifact,
  proof: Uint8Array.of(1),
  publicInputs: [
    '1',
    '2',
    '1',
    '0',
    '2',
    '1',
    '0',
    '1',
    '0',
    '1',
    '0',
    '1',
    '0',
    '1',
    '2',
    '0',
    '1',
    '0',
    '8',
  ],
};
const verifier = { id: 'groth', verify: async () => true };
test('client checks engine identity and binds the signals returned by the prover', async () => {
  const engine = {
    id: 'groth',
    prove: async () => ({ publicSignals: ['1'], proof: Uint8Array.of(2) }),
  };
  const run = (expected, adapter) =>
    proveBlock(adapter, null, null, expected, profile, artifact);
  assert.deepEqual((await run(['1'], engine)).publicInputs, ['1']);
  await assert.rejects(run(['2'], engine), /unexpected_public_signals/);
  await assert.rejects(
    run(['1'], { ...engine, id: 'other' }),
    /incompatible_proof_profile/,
  );
});
const check = (p = proof, key = vk, q = query) =>
  verifyThresholdBlock(
    p,
    { artifact, profile, blockSize: 16, key },
    q,
    verifier,
  );
test('public verification binds profile, artifact bytes and every query signal before accepting', async () => {
  assert.equal((await check()).matched, 1n);
  for (const mutation of [
    { artifact: { ...artifact, circuitVersion: '2' } },
    { protocol: { ...profile, recordHashId: 'other' } },
    { publicInputs: proof.publicInputs.slice(1) },
  ])
    await assert.rejects(check({ ...proof, ...mutation }));
  await assert.rejects(check(proof, Uint8Array.of(2)));
  await assert.rejects(check(proof, vk, { ...query, root: 2n }));
  await assert.rejects(
    check({ ...proof, publicInputs: ['01', ...proof.publicInputs.slice(1)] }),
  );
  await assert.rejects(
    verifyThresholdBlock(
      proof,
      { artifact, profile, blockSize: 16, key: vk },
      query,
      { ...verifier, verify: async () => false },
    ),
  );
});
