import { buildPoseidon } from 'circomlibjs';

export interface ColumnsCommitmentPort {
  readonly id: string;
  commit(columns: readonly bigint[], salt: bigint): bigint;
}

const modulus =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export async function createCommitmentAdapter(): Promise<ColumnsCommitmentPort> {
  const hash = await buildPoseidon();
  return {
    id: 'poseidon-circomlib-bn254/1',
    commit(columns, salt) {
      const inputs = Array.from(columns);
      if (
        inputs.length < 1 ||
        inputs.length > 8 ||
        inputs.some((x) => typeof x !== 'bigint' || x < 0n || x >= modulus) ||
        typeof salt !== 'bigint' ||
        salt < 0n ||
        salt >= 1n << 128n
      )
        throw new RangeError('invalid_commitment_input');
      while (inputs.length < 8) inputs.push(0n);
      return hash.F.toObject(hash([...inputs, salt]));
    },
  };
}
