/** Public contracts only: no plaintext, vault secret or witness type here. */
export type Hex = `0x${string}`;
export type ChainId = 11155111 | 421614;
export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Persisted with records/artifacts/bundles; adapters must reject unknown profiles. */
export interface ProtocolProfile {
  readonly protocolId: string;
  readonly encodingId: string;
  readonly recordHashId: string;
  readonly batchTreeId: string;
  readonly anchorTreeId: string;
  readonly proofSystemId: string;
  readonly encryptionSuiteId: string;
}

/** Input/output representations belong to an adapter; no implicit field reduction. */
export interface HashPort<Input, Digest> {
  readonly id: string;
  digest(domain: string, inputs: readonly Input[]): Promise<Digest>;
}

export interface MerkleProof<Digest> {
  readonly treeId: string;
  readonly root: Digest;
  readonly index: bigint;
  readonly siblings: readonly Digest[];
}

export interface MerklePort<Leaf, Digest> {
  readonly id: string;
  readonly depth: number;
  root(leaves: readonly Leaf[]): Promise<Digest>;
  inclusion(
    leaves: readonly Leaf[],
    index: bigint,
  ): Promise<MerkleProof<Digest>>;
  verify(leaf: Leaf, proof: MerkleProof<Digest>): Promise<boolean>;
}

export interface ArtifactRef {
  readonly id: string;
  readonly sha256: Hex;
  readonly protocolId: string;
  readonly circuitVersion: string;
  readonly proofSystemId: string;
  readonly ceremony: 'development' | 'production';
}

export interface ProofEnvelope {
  readonly protocol: ProtocolProfile;
  readonly artifact: ArtifactRef;
  readonly publicInputs: readonly string[];
  readonly proof: Uint8Array;
}

/** Cryptographic verification only; chain binding and completeness are separate checks. */
export interface ProofVerifier {
  readonly id: string;
  verify(proof: ProofEnvelope, verificationKey: Uint8Array): Promise<boolean>;
}

export interface ChainSnapshot {
  readonly chainId: ChainId;
  readonly blockNumber: bigint;
  readonly blockHash: Hex;
}

export interface ChainReader {
  readonly chainId: ChainId;
  snapshot(tag: 'latest' | 'safe' | 'finalized'): Promise<ChainSnapshot>;
  call(to: Hex, data: Hex, at: ChainSnapshot): Promise<Hex>;
  isCanonical(snapshot: ChainSnapshot): Promise<boolean>;
}

export interface UnsignedTransaction {
  readonly chainId: ChainId;
  readonly to: Hex;
  readonly data: Hex;
  readonly value: bigint;
  readonly nonce: bigint;
  readonly gas: bigint;
  readonly maxFeePerGas: bigint;
  readonly maxPriorityFeePerGas: bigint;
}

/** Operational wallet signer, unrelated to tenant encryption keys. */
export interface TransactionSigner {
  readonly address: Hex;
  sign(transaction: UnsignedTransaction): Promise<Hex>;
}

export interface ChainWriter {
  readonly chainId: ChainId;
  broadcast(signedTransaction: Hex): Promise<Hex>;
}
