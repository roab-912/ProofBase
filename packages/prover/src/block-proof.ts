import type {
  ArtifactRef,
  ProofEnvelope,
  ProtocolProfile,
} from '@proofbase/core';

/** Bind the engine's actual public signals to the client request before export. */
export interface BlockProver<Witness, Key> {
  readonly id: string;
  prove(
    key: Key,
    witness: Witness,
  ): Promise<{
    readonly publicSignals: readonly string[];
    readonly proof: Uint8Array;
  }>;
}

export async function proveBlock<Witness, Key>(
  engine: BlockProver<Witness, Key>,
  key: Key,
  witness: Witness,
  expected: readonly string[],
  protocol: ProtocolProfile,
  artifact: ArtifactRef,
): Promise<ProofEnvelope> {
  if (
    engine.id !== protocol.proofSystemId ||
    artifact.proofSystemId !== engine.id ||
    artifact.protocolId !== protocol.protocolId
  )
    throw new Error('incompatible_proof_profile');
  const { publicSignals, proof } = await engine.prove(key, witness);
  if (
    publicSignals.length !== expected.length ||
    expected.some((v, i) => publicSignals[i] !== v)
  )
    throw new Error('unexpected_public_signals');
  return { artifact, protocol, publicInputs: [...publicSignals], proof };
}
