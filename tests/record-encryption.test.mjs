import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRecordEncryption,
  deriveRecordKey,
  recordAad,
} from '../packages/sdk/src/record-encryption.ts';

const ctx = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  collectionId: '00000000-0000-4000-8000-000000000002',
  keyId: '00000000-0000-4000-8000-000000000003',
  partitionId: 1n,
  colsCommit: 2n,
};
const root = crypto.getRandomValues(new Uint8Array(32));
const key = await deriveRecordKey(root, ctx);
const adapter = await createRecordEncryption();
test('AAD matches the fixed-width wire format', () => {
  assert.equal(
    Buffer.from(recordAad(ctx)).toString('hex'),
    Buffer.from('PB1:RECORD').toString('hex') +
      [ctx.tenantId, ctx.collectionId, ctx.keyId]
        .map((x) => x.replaceAll('-', ''))
        .join('') +
      '1'.padStart(16, '0') +
      '2'.padStart(64, '0'),
  );
});
test('encrypt/decrypt canonical payload bytes at each padding boundary', async () => {
  for (const [n, padded] of [
    [1, 256],
    [252, 256],
    [253, 1024],
    [1021, 4096],
    [4093, 8192],
    [65532, 65536],
  ]) {
    const input = new Uint8Array(n).fill(65);
    const envelope = await adapter.encrypt(input, recordAad(ctx), key);
    assert.equal(envelope.ciphertext.length, padded + 16);
    assert.equal(envelope.nonce.length, 24);
    assert.deepEqual(
      await adapter.decrypt(envelope, recordAad(ctx), key),
      input,
    );
  }
  await assert.rejects(
    adapter.encrypt(new Uint8Array(65533), recordAad(ctx), key),
  );
});
test('fresh nonce, context binding, wrong keys and tampering', async () => {
  const data = new TextEncoder().encode('private fixture');
  const aad = recordAad(ctx);
  const envelope = await adapter.encrypt(data, aad, key);
  assert.notDeepEqual(
    (await adapter.encrypt(data, aad, key)).nonce,
    envelope.nonce,
  );
  for (const patch of [
    { tenantId: ctx.collectionId },
    { collectionId: ctx.keyId },
    { keyId: ctx.tenantId },
    { partitionId: 2n },
    { colsCommit: 3n },
  ]) {
    await assert.rejects(
      adapter.decrypt(envelope, recordAad({ ...ctx, ...patch }), key),
    );
  }
  const wrongKey = await deriveRecordKey(
    crypto.getRandomValues(new Uint8Array(32)),
    ctx,
  );
  await assert.rejects(adapter.decrypt(envelope, aad, wrongKey));
  for (const field of ['nonce', 'ciphertext']) {
    const changed = envelope[field].slice();
    changed[changed.length - 1] ^= 1;
    await assert.rejects(
      adapter.decrypt({ ...envelope, [field]: changed }, aad, key),
      { message: 'invalid_envelope' },
    );
  }
});
