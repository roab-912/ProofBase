import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCommitmentAdapter } from '../packages/sdk/src/commitment.ts';

const adapter = await createCommitmentAdapter();
const vector = JSON.parse(
  readFileSync('circuits/vectors/commitment.json', 'utf8'),
);
const values = vector.columns.map(BigInt);
test('SDK matches the Circom Poseidon(9) witness', () => {
  assert.equal(
    adapter.commit(values, BigInt(vector.salt)).toString(),
    vector.commitment,
  );
  assert.notEqual(
    adapter.commit(values, BigInt(vector.salt) - 1n).toString(),
    vector.commitment,
  );
});

test('invalid commitment inputs fail before hashing', () => {
  const modulus =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  for (const [columns, salt] of [
    [[], 1n],
    [Array(9).fill(0n), 1n],
    [[modulus], 1n],
    [[-1n], 1n],
    [[0n], -1n],
    [[0n], 1n << 128n],
  ]) {
    assert.throws(() => adapter.commit(columns, salt), {
      message: 'invalid_commitment_input',
    });
  }
});
