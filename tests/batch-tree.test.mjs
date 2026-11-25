import test from 'node:test';
import assert from 'node:assert/strict';
import { createBatchTree } from '../packages/core/src/batch-tree.ts';
import { createBatchHash } from '../packages/sdk/src/batch-hash.ts';

const hash = await createBatchHash();
const tree = await createBatchTree(hash);
const a = { partitionId: 2n, pseq: 3n, ts: 9n, colsCommit: 0n };
const b = { ...a, pseq: 4n };
const c = { ...a, partitionId: 12n };
test('sorted batch proofs bind the index, sibling order, root and metadata', async () => {
  const proof = await tree.inclusion([c, b, a], 1n);
  assert.equal(proof.root, await tree.root([a, b, c]));
  assert.equal(proof.siblings.length, 20);
  assert.equal(await tree.verify(b, proof), true);
  for (const changed of [
    { index: 0n },
    { index: 1n << 20n },
    { siblings: proof.siblings.slice(1) },
    { siblings: [...proof.siblings].reverse() },
    { root: proof.root + 1n },
    { treeId: 'unknown' },
  ]) {
    assert.equal(await tree.verify(b, { ...proof, ...changed }), false);
  }
  assert.equal(await tree.verify({ ...b, ts: 10n }, proof), false);
  await assert.rejects(tree.inclusion([a], 1n));
});
test('single leaf path uses canonical empty hashes at every height', async () => {
  const proof = await tree.inclusion([a], 0n);
  let empty = await hash.digest('PB1:EMPTY', []);
  let root = await hash.digest('PB1:LEAF', [2n, 3n, 9n, 0n]);
  for (const sibling of proof.siblings) {
    assert.equal(sibling, empty);
    root = await hash.digest('PB1:NODE', [root, empty]);
    empty = await hash.digest('PB1:NODE', [empty, empty]);
  }
  assert.equal(proof.root, root);
});
test('invalid batches are rejected before a root is returned', async () => {
  for (const rows of [
    [],
    [a, a],
    [a, { ...b, pseq: 5n }],
    [a, { ...b, ts: 8n }],
    [{ ...a, pseq: 0n }],
    [{ ...a, colsCommit: -1n }],
    [{ ...a, partitionId: 1n << 64n }],
  ])
    await assert.rejects(tree.root(rows));
});
