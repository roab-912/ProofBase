import type {
  ArtifactRef,
  ProofEnvelope,
  ProofVerifier,
  ProtocolProfile,
} from '@proofbase/core';

export interface ThresholdCatalogEntry {
  readonly profile: ProtocolProfile;
  readonly artifact: ArtifactRef;
  readonly blockSize: 16 | 64 | 256;
  readonly key: Uint8Array;
}
export interface ThresholdStatement {
  readonly root: bigint;
  readonly start: number;
  readonly count: number;
  readonly target: bigint;
  readonly from: bigint;
  readonly to: bigint;
  readonly column: number;
  readonly max: bigint;
}
const scalar =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function reject(): never {
  throw new Error('invalid_threshold_proof');
}
export function validateThresholdQuery({
  target,
  from,
  to,
  column,
  max,
}: Omit<ThresholdStatement, 'root' | 'start' | 'count'>): void {
  if (
    !Number.isInteger(column) ||
    column < 0 ||
    column > 7 ||
    from >= to ||
    [target, from, to, max].some(
      (x) => typeof x !== 'bigint' || x < 0n || x >= 1n << 64n,
    )
  )
    reject();
}
function matches<T extends object>(trusted: T, received: T) {
  return (
    Object.keys(trusted).every(
      (k) => trusted[k as keyof T] === received[k as keyof T],
    ) && Object.keys(trusted).length === Object.keys(received).length
  );
}

/** Catalog and statement are supplied independently of the prover.
 * This verifies a single block; complete inventory and chain checks belong to the bundle. */
export async function verifyThresholdBlock(
  proof: ProofEnvelope,
  entry: ThresholdCatalogEntry,
  statement: ThresholdStatement,
  verifier: ProofVerifier,
) {
  if (
    verifier.id !== entry.profile.proofSystemId ||
    entry.artifact.proofSystemId !== verifier.id ||
    entry.artifact.protocolId !== entry.profile.protocolId ||
    !matches(entry.profile, proof.protocol) ||
    !matches(entry.artifact, proof.artifact)
  )
    reject();
  const key = new Uint8Array(entry.key);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', key));
  if (
    '0x' +
      Array.from(digest, (x) => x.toString(16).padStart(2, '0')).join('') !==
    entry.artifact.sha256
  )
    reject();
  const { root, start, count, target, from, to, column, max } = statement;
  validateThresholdQuery(statement);
  if (
    ![16, 64, 256].includes(entry.blockSize) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 2 ** 20 ||
    !Number.isInteger(start) ||
    start < 0 ||
    start >= count ||
    start % entry.blockSize !== 0 ||
    root < 0n ||
    root >= scalar
  )
    reject();
  const signals = [...proof.publicInputs];
  if (
    signals.length !== 19 ||
    signals.some(
      (x) =>
        typeof x !== 'string' ||
        x.length > 77 ||
        !/^(0|[1-9][0-9]*)$/.test(x) ||
        x.trim() !== x ||
        BigInt(x) >= scalar,
    )
  )
    reject();
  if (
    ![root, start, count, target, from, to, column, max].every(
      (x, i) => String(x) === signals[11 + i],
    )
  )
    reject();
  const outputs = signals.slice(0, 11).map(BigInt);
  if (
    outputs[0]! > BigInt(Math.min(entry.blockSize, count - start)) ||
    outputs.some((x) => x >= 1n << 64n)
  )
    reject();
  if (!(await verifier.verify({ ...proof, publicInputs: signals }, key)))
    reject();
  return {
    matched: outputs[0]!,
    first: [outputs[1]!, outputs[2]!, outputs[3]!] as const,
    last: [outputs[4]!, outputs[5]!, outputs[6]!] as const,
    targetFirst: [outputs[7]!, outputs[8]!] as const,
    targetLast: [outputs[9]!, outputs[10]!] as const,
  };
}
