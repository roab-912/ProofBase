import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareThresholdOpenings } from '../packages/prover/src/threshold-openings.ts';
import {
  createRecordEncryption,
  deriveRecordKey,
  recordAad,
} from '../packages/sdk/src/record-encryption.ts';
import { createCommitmentAdapter } from '../packages/sdk/src/commitment.ts';
import { encodeColumn } from '../packages/sdk/src/encoding.ts';

const cipher = await createRecordEncryption(),
  hash = await createCommitmentAdapter();
const context = {
  tenantId: crypto.randomUUID(),
  collectionId: crypto.randomUUID(),
  keyId: crypto.randomUUID(),
  partitionId: 9n,
  colsCommit: hash.commit([1n << 63n], 1n),
};
const key = await deriveRecordKey(
  crypto.getRandomValues(new Uint8Array(32)),
  context,
);
const bytes = new TextEncoder().encode(
  JSON.stringify({
    eventTime: '0',
    partitionLabel: 'site',
    salt: 'AAAAAAAAAAAAAAAAAAAAAQ',
    schemaVersion: '1',
    values: ['0'],
  }),
);
async function row(ctx = context) {
  return {
    ...ctx,
    pseq: 1n,
    ts: 10n,
    envelope: await cipher.encrypt(bytes, recordAad(ctx), key),
  };
}
const query = {
  tenantId: context.tenantId,
  collectionId: context.collectionId,
  partitionId: 9n,
  from: 10n,
  to: 11n,
  column: 0,
  max: 1n << 63n,
};
const schema = { version: '1', columns: [{ type: 'int64' }] };
const ports = {
  open: (r) => cipher.decrypt(r.envelope, recordAad(r), key),
  commit: hash.commit,
  encode: encodeColumn,
};
const block = { start: 0, count: 2 };
test('opens only matching ciphertexts and pads the last block', async () => {
  const inside = await row();
  const outside = { ...inside, pseq: 2n, ts: 11n, envelope: undefined };
  const witness = await prepareThresholdOpenings(
    block,
    [inside, outside],
    query,
    schema,
    ports,
  );
  assert.equal(witness.columns.length, 16);
  assert.deepEqual(witness.columns[0], [1n << 63n, ...Array(7).fill(0n)]);
  assert.deepEqual(witness.salts, [1n, ...Array(15).fill(0n)]);
  assert.equal(witness.inScopeCount, 1);
});
test('rejects a failed tag, inconsistent commitment, and false predicate', async () => {
  const item = await row();
  item.envelope.ciphertext[0] ^= 1;
  const run = (r, q = query) =>
    prepareThresholdOpenings({ start: 0, count: 1 }, [r], q, schema, ports);
  await assert.rejects(run(item), { message: 'invalid_envelope' });
  await assert.rejects(run(await row({ ...context, colsCommit: 1n })), {
    message: 'commitment_mismatch',
  });
  await assert.rejects(run(await row(), { ...query, max: 0n }), {
    message: 'predicate_not_satisfied',
  });
});
test('rejects omitted occupied rows and unaligned blocks', async () => {
  await assert.rejects(
    prepareThresholdOpenings(block, [await row()], query, schema, ports),
  );
  await assert.rejects(
    prepareThresholdOpenings(
      { start: 1, count: 2 },
      [await row()],
      query,
      schema,
      ports,
    ),
  );
});
