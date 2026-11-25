import type {
  ArtifactRef,
  ProofEnvelope,
  ProtocolProfile,
} from '@proofbase/core';

/** Client-only capabilities. Witness representation remains engine-specific. */
export interface ProofSystem<Witness, CompiledCircuit, ProvingKey> {
  readonly id: string;
  compile(
    source: Uint8Array,
    profile: ProtocolProfile,
  ): Promise<CompiledCircuit>;
  setup(
    circuit: CompiledCircuit,
    ceremony: ArtifactRef['ceremony'],
  ): Promise<ProvingKey>;
  prove(input: {
    readonly witness: Witness;
    readonly publicInputs: readonly string[];
    readonly provingKey: ProvingKey;
    readonly artifact: ArtifactRef;
    readonly profile: ProtocolProfile;
    readonly signal?: AbortSignal;
  }): Promise<ProofEnvelope>;
}
export { prepareThresholdOpenings } from './threshold-openings.js';
