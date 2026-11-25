import type {
  HashPort,
  ProofVerifier,
  ProofEnvelope,
  ChainId,
} from '../../packages/core/src/index.js';
import type { ProofSystem } from '../../packages/prover/src/index.js';

// Compile-time contract tests, never invoked as cryptographic implementations.
export function selectHash<Input, Digest>(
  adapters: readonly HashPort<Input, Digest>[],
  id: string,
): HashPort<Input, Digest> | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

export async function publicVerifierCannotProve(
  verifier: ProofVerifier,
  proof: ProofEnvelope,
  key: Uint8Array,
): Promise<boolean> {
  // @ts-expect-error Platform verification capability cannot generate a proof.
  verifier.prove(proof);
  return verifier.verify(proof, key);
}

export function proofEnginesAreInjectable<Witness, Circuit, Key>(
  engine: ProofSystem<Witness, Circuit, Key>,
): ProofSystem<Witness, Circuit, Key> {
  return engine;
}

export const allowedChains: readonly ChainId[] = [11155111, 421614];
// @ts-expect-error Production/mainnet chain IDs are not enabled.
export const forbiddenChain: ChainId = 1;
