/** Private scalar inputs for threshold and count templates. */
export type ScalarColumn =
  | { readonly type: 'int64' | 'timestamp'; readonly value: string }
  | { readonly type: 'decimal'; readonly value: string; readonly scale: bigint }
  | { readonly type: 'bool'; readonly value: boolean };

const bias = 1n << 63n;
const invalid = (): never => {
  throw new RangeError('invalid_column');
};

export function encodeColumn(column: ScalarColumn): bigint {
  if (column.type === 'bool') {
    if (typeof column.value !== 'boolean') return invalid();
    return column.value ? 1n : 0n;
  }
  const text = column.value;
  if (typeof text !== 'string' || text.length > 128) return invalid();
  let value: bigint;
  if (column.type === 'decimal') {
    const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(text);
    if (
      !match ||
      match[0] !== text ||
      typeof column.scale !== 'bigint' ||
      column.scale <= 0n
    )
      return invalid();
    const fraction = match[3] ?? '';
    const denominator = 10n ** BigInt(fraction.length);
    const numerator = BigInt(match[2]! + fraction) * column.scale;
    if (numerator % denominator !== 0n || (match[1] && numerator === 0n))
      return invalid();
    value = (match[1] ? -1n : 1n) * (numerator / denominator);
  } else {
    if (column.type !== 'int64' && column.type !== 'timestamp')
      return invalid();
    if (!/^(0|-?[1-9][0-9]*)$/.test(text) || text.trim() !== text)
      return invalid();
    value = BigInt(text);
  }
  const encoded = column.type === 'timestamp' ? value : value + bias;
  return encoded >= 0n && encoded < 2n * bias ? encoded : invalid();
}
