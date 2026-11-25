import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createBatchTree } from '../packages/core/src/batch-tree.ts';
import { createBatchHash } from '../packages/sdk/src/batch-hash.ts';
import { createCommitmentAdapter } from '../packages/sdk/src/commitment.ts';

const dir = mkdtempSync(join(tmpdir(), 'proofbase-threshold-'));
try {
  execFileSync(
    'circom',
    [
      'circuits/tests/threshold16.circom',
      '-l',
      'node_modules',
      '--wasm',
      '--r1cs',
      '-o',
      dir,
    ],
    { stdio: 'inherit' },
  );
  writeFileSync(join(dir, 'package.json'), '{"type":"commonjs"}');
  const build = createRequire(import.meta.url)(
    resolve(dir, 'threshold16_js/witness_calculator.js'),
  );
  const calc = await build(
    readFileSync(join(dir, 'threshold16_js/threshold16.wasm')),
  );
  const commit = await createCommitmentAdapter(),
    tree = await createBatchTree(await createBatchHash());
  const colsCommit = commit.commit([7n], 8n);
  const rows = Array.from({ length: 19 }, (_, i) => ({
    partitionId: 2n,
    pseq: BigInt(i + 1),
    ts: BigInt(i),
    colsCommit,
  }));
  const path = await tree.inclusion(rows, 16n);
  const values = Array.from({ length: 16 }, (_, i) =>
    i < 2 ? [7n, ...Array(7).fill(0n)] : Array(8).fill(0n),
  );
  const input = {
    root: path.root,
    start: 16,
    count: 19,
    target: 2n,
    from: 16n,
    to: 18n,
    column: 0,
    max: 7n,
    columns: values,
    salts: [8n, 8n, ...Array(14).fill(0n)],
    siblings: path.siblings.slice(4),
  };
  for (const name of ['partitionId', 'pseq', 'ts', 'colsCommit'])
    input[name] = Array.from(
      { length: 16 },
      (_, i) => rows[16 + i]?.[name] ?? 0n,
    );
  const run = (data) => calc.calculateWitness(data, true);
  const witness = await run(input);
  assert.deepEqual(witness.slice(1, 12), [
    2n,
    2n,
    17n,
    16n,
    2n,
    19n,
    18n,
    17n,
    16n,
    19n,
    18n,
  ]);
  for (const patch of [
    { root: path.root + 1n },
    { start: 15 },
    { count: 18 },
    { max: 6n },
    { column: 8 },
    { to: 16n },
    { salts: Array(16).fill(0n) },
    { siblings: path.siblings.slice(4).reverse() },
    { pseq: [17n, 19n, ...input.pseq.slice(2)] },
    { columns: [Array(8).fill(0n), ...values.slice(1)] },
  ]) {
    await assert.rejects(run({ ...input, ...patch }));
  }
  console.log('threshold16: valid partial block and 10 rejected mutations');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
