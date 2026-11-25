export { encodeColumn, type ScalarColumn } from './encoding.js';

/** Secret-bearing contracts live only in this client package. */
export interface EncryptionPort<KeyHandle> {
  readonly id: string;
  encrypt(
    plaintext: Uint8Array,
    aad: Uint8Array,
    key: KeyHandle,
  ): Promise<EncryptedEnvelope>;
  decrypt(
    envelope: EncryptedEnvelope,
    aad: Uint8Array,
    key: KeyHandle,
  ): Promise<Uint8Array>;
}

export interface EncryptedEnvelope {
  readonly suiteId: string;
  readonly keyId: string;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
}

export interface VaultPort<KeyHandle, UnlockInput> {
  unlock(wrapped: Uint8Array, input: UnlockInput): Promise<KeyHandle>;
  wrap(key: KeyHandle, input: UnlockInput): Promise<Uint8Array>;
  lock(key: KeyHandle): Promise<void>;
}
export {
  createCommitmentAdapter,
  type ColumnsCommitmentPort,
} from './commitment.js';
