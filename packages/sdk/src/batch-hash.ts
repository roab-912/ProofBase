import { buildPoseidon } from 'circomlibjs';

/** Domain tags are unsigned big-endian ASCII integers in proofbase/1. */
const domains = new Map([
  ['PB1:EMPTY', { tag: 0x5042313a454d505459n, arity: 0 }],
  ['PB1:NODE', { tag: 0x5042313a4e4f4445n, arity: 2 }],
  ['PB1:LEAF', { tag: 0x5042313a4c454146n, arity: 4 }],
]);
export async function createBatchHash() {
  const hash = await buildPoseidon();
  return {
    id: 'poseidon-circomlib-bn254/1',
    async digest(domain: string, inputs: readonly bigint[]): Promise<bigint> {
      const spec = domains.get(domain);
      if (
        !spec ||
        inputs.length !== spec.arity ||
        inputs.some(
          (x) =>
            typeof x !== 'bigint' ||
            x < 0n ||
            x >=
              21888242871839275222246405745257275088548364400416034343698204186575808495617n,
        )
      )
        throw new RangeError('invalid_batch_hash_input');
      return hash.F.toObject(hash([spec.tag, ...inputs]));
    },
  };
}
