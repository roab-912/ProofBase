import sodium from 'libsodium-wrappers-sumo';
import type { EncryptionPort } from './index.js';

export interface RecordContext {
  readonly tenantId: string;
  readonly collectionId: string;
  readonly keyId: string;
  readonly partitionId: bigint;
  readonly colsCommit: bigint;
}
export interface RecordKey {
  readonly id: string;
  readonly bytes: Uint8Array;
}
const suite = 'xchacha20poly1305-hkdfsha256/1';
const text = new TextEncoder();
const field =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function uuid(value: string) {
  if (
    typeof value !== 'string' ||
    value.length !== 36 ||
    !/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/.test(
      value,
    )
  )
    throw new Error('invalid_record_context');
  return Uint8Array.from(value.replaceAll('-', '').match(/../g)!, (x) =>
    Number.parseInt(x, 16),
  );
}
function join(...parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((size, p) => size + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    output.set(p, offset);
    offset += p.length;
  }
  return output;
}
function bigEndian(value: bigint, width: number, max: bigint) {
  if (typeof value !== 'bigint' || value < 0n || value >= max)
    throw new Error('invalid_record_context');
  const output = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) {
    output[i] = Number(value & 255n);
    value >>= 8n;
  }
  return output;
}
export function recordAad(context: RecordContext): Uint8Array {
  return join(
    text.encode('PB1:RECORD'),
    uuid(context.tenantId),
    uuid(context.collectionId),
    uuid(context.keyId),
    bigEndian(context.partitionId, 8, 1n << 64n),
    bigEndian(context.colsCommit, 32, field),
  );
}
export async function deriveRecordKey(
  root: Uint8Array,
  context: Pick<RecordContext, 'tenantId' | 'collectionId' | 'keyId'>,
): Promise<RecordKey> {
  if (root.length !== 32) throw new Error('invalid_root_key');
  const salt = uuid(context.tenantId);
  const info = join(
    text.encode('PB1:DATA'),
    uuid(context.collectionId),
    uuid(context.keyId),
  );
  const material = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(root),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      material,
      256,
    ),
  );
  return { id: context.keyId, bytes };
}
function paddedSize(length: number) {
  const size = length + 4;
  if (size > 65536) throw new Error('record_too_large');
  return size <= 256
    ? 256
    : size <= 1024
      ? 1024
      : 4096 * Math.ceil(size / 4096);
}

/** The caller supplies canonical record bytes and AAD from recordAad. */
export async function createRecordEncryption(): Promise<
  EncryptionPort<RecordKey>
> {
  await sodium.ready;
  return {
    id: suite,
    async encrypt(plaintext, aad, key) {
      const padded = sodium.randombytes_buf(paddedSize(plaintext.length));
      try {
        new DataView(padded.buffer, padded.byteOffset).setUint32(
          0,
          plaintext.length,
          false,
        );
        padded.set(plaintext, 4);
        const nonce = sodium.randombytes_buf(24);
        const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
          padded,
          aad,
          null,
          nonce,
          key.bytes,
        );
        return { suiteId: suite, keyId: key.id, nonce, ciphertext };
      } finally {
        sodium.memzero(padded);
      }
    },
    async decrypt(envelope, aad, key) {
      let padded: Uint8Array | undefined;
      try {
        if (
          envelope.suiteId !== suite ||
          envelope.keyId !== key.id ||
          envelope.nonce.length !== 24 ||
          envelope.ciphertext.length > 65552
        )
          throw new Error();
        padded = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          envelope.ciphertext,
          aad,
          envelope.nonce,
          key.bytes,
        );
        const size = new DataView(
          padded.buffer,
          padded.byteOffset,
          padded.byteLength,
        ).getUint32(0, false);
        if (paddedSize(size) !== padded.length) throw new Error();
        return padded.slice(4, size + 4);
      } catch {
        throw new Error('invalid_envelope');
      } finally {
        if (padded) sodium.memzero(padded);
      }
    },
  };
}
