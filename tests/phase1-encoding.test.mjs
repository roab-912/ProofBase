import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeColumn } from '../packages/sdk/src/encoding.ts';

test('signed columns preserve order over the complete int64 domain', () => {
  assert.deepEqual(
    ['-9223372036854775808', '-1', '0', '9223372036854775807'].map((value) =>
      encodeColumn({ type: 'int64', value }),
    ),
    [0n, 2n ** 63n - 1n, 2n ** 63n, 2n ** 64n - 1n],
  );
});

test('decimal encoding is exact for signed values and the public threshold', () => {
  const decimal = (value) =>
    encodeColumn({ type: 'decimal', value, scale: 100n });
  assert.equal(decimal('4.25'), 2n ** 63n + 425n);
  assert.equal(decimal('-0.01'), 2n ** 63n - 1n);
  assert.equal(decimal('8.00'), 2n ** 63n + 800n);
  assert.throws(() => decimal('8.001'));
});

test('invalid values fail without exposing the input', () => {
  for (const value of [
    '+1',
    '-0',
    '01',
    '1e1',
    '9223372036854775808',
    'sensitive-label',
  ]) {
    assert.throws(() => encodeColumn({ type: 'int64', value }), {
      message: 'invalid_column',
    });
  }
  assert.throws(() => encodeColumn({ type: 'timestamp', value: '-1' }));
  assert.throws(() =>
    encodeColumn({ type: 'timestamp', value: '18446744073709551616' }),
  );
  assert.equal(
    encodeColumn({ type: 'timestamp', value: '18446744073709551615' }),
    2n ** 64n - 1n,
  );
  assert.equal(encodeColumn({ type: 'bool', value: false }), 0n);
});
