import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyThresholdHistory } from '../packages/verifier/src/history.ts';

// Inject the per-block verifier. Real cryptography is exercised by the spike.
const query = { target: 3n, from: 0n, to: 4n, column: 1, max: 9n };
const anchors = [1n, 2n, 3n].map((seq, i) => ({
  batchId: BigInt(i),
  root: seq + 90n,
  firstSeq: seq,
  lastSeq: seq,
}));
const result = (partition, pseq, ts) => ({
  matched: partition === 3n ? 1n : 0n,
  first: [partition, pseq, ts],
  last: [partition, pseq, ts],
  targetFirst: partition === 3n ? [pseq, ts] : [0n, 0n],
  targetLast: partition === 3n ? [pseq, ts] : [0n, 0n],
});
const batches = [
  result(3n, 1n, 0n),
  result(4n, 1n, 1n),
  result(3n, 2n, 2n),
].map((r, i) => ({ batchId: BigInt(i), blocks: [r] }));
const snapshot = {
  tenantId: 'fixture',
  chainId: 421614,
  registry: '0x' + '12'.repeat(20),
  blockNumber: 1n,
  blockHash: '0x' + 'ab'.repeat(32),
  batchCount: 3n,
};
const run = (items, inventory = anchors, change = {}, scope = query) => {
  const at = { ...snapshot, batchCount: BigInt(inventory.length) };
  return verifyThresholdHistory(
    { snapshot: at, anchors: inventory },
    { ...at, ...change },
    items,
    16,
    scope,
    async (r) => r,
  );
};
test('limits coverage to the independently supplied tenant snapshot, including its batch count', async () => {
  for (const change of [
    { tenantId: 'other' },
    { chainId: 11155111 },
    { registry: '0x' + '21'.repeat(20) },
    { blockNumber: 2n },
    { blockHash: '0x' + 'ba'.repeat(32) },
    { batchCount: 4n },
  ])
    await assert.rejects(run(batches, anchors, change));
  assert.equal(
    (await run(batches.slice(0, 1), anchors.slice(0, 1))).matched,
    1n,
  );
});
test('checks partition continuity across an absent batch and rejects missing coverage', async () => {
  assert.deepEqual(await run(batches), { status: 'valid', matched: 2n });
  await assert.rejects(run(batches.slice(1)));
  await assert.rejects(run([batches[0], batches[0], batches[2]]));
  await assert.rejects(
    run([
      batches[0],
      batches[1],
      { batchId: 2n, blocks: [result(3n, 3n, 2n)] },
    ]),
  );
  assert.deepEqual(await run([], []), { status: 'empty_scope', matched: 0n });
  await assert.rejects(run([], [], {}, { ...query, to: 0n }));
});
test('requires every aligned block and validates joins against the verified outputs', async () => {
  const anchor = { batchId: 0n, root: 99n, firstSeq: 1n, lastSeq: 17n };
  const head = {
    ...result(3n, 1n, 0n),
    last: [3n, 16n, 1n],
    targetLast: [16n, 1n],
    matched: 16n,
  };
  const blocks = [head, result(3n, 17n, 1n)];
  assert.equal((await run([{ batchId: 0n, blocks }], [anchor])).matched, 17n);
  await assert.rejects(run([{ batchId: 0n, blocks: [head] }], [anchor]));
  await assert.rejects(
    run([{ batchId: 0n, blocks: [head, result(2n, 17n, 1n)] }], [anchor]),
  );
});
