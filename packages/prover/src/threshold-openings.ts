import type { BatchLeaf } from '@proofbase/core';

type Column =
  | { type: 'int64' | 'timestamp' }
  | { type: 'decimal'; scale: bigint }
  | { type: 'bool' };
type Input =
  | { type: 'int64' | 'timestamp'; value: string }
  | { type: 'decimal'; scale: bigint; value: string }
  | { type: 'bool'; value: boolean };
interface Material extends BatchLeaf {
  readonly tenantId: string;
  readonly collectionId: string;
}
interface Scope {
  readonly tenantId: string;
  readonly collectionId: string;
  readonly partitionId: bigint;
  readonly from: bigint;
  readonly to: bigint;
  readonly column: number;
  readonly max: bigint;
}
interface OpeningPorts<R> {
  open(record: R): Promise<Uint8Array>;
  encode(input: Input): bigint;
  commit(columns: readonly bigint[], salt: bigint): bigint;
}
const u64 = (x: bigint) => typeof x === 'bigint' && x >= 0n && x < 1n << 64n;
const empty = (): bigint[] => Array<bigint>(8).fill(0n);

function decode(
  bytes: Uint8Array,
  version: string,
  types: readonly Column[],
  encode: OpeningPorts<never>['encode'],
) {
  try {
    const source = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const { eventTime, partitionLabel, salt, schemaVersion, values } =
      JSON.parse(source);
    if (
      typeof eventTime !== 'string' ||
      !/^(0|[1-9][0-9]{0,19})$/.test(eventTime) ||
      !u64(BigInt(eventTime)) ||
      typeof partitionLabel !== 'string' ||
      partitionLabel.normalize('NFC') !== partitionLabel ||
      new TextEncoder().encode(partitionLabel).length > 1024 ||
      schemaVersion !== version ||
      typeof salt !== 'string' ||
      !/^[A-Za-z0-9_-]{21}[AQgw]$/.test(salt) ||
      salt.length !== 22 ||
      !Array.isArray(values) ||
      values.length !== types.length ||
      JSON.stringify({
        eventTime,
        partitionLabel,
        salt,
        schemaVersion,
        values,
      }) !== source
    )
      throw new Error();
    const columns = types.map((col, i) => {
      const value: unknown = values[i];
      if (col.type === 'bool' && typeof value === 'boolean')
        return encode({ type: 'bool', value });
      if (col.type !== 'bool' && typeof value === 'string')
        return encode({ ...col, value });
      throw new Error();
    });
    let scalar = 0n;
    for (const char of atob(
      salt.replaceAll('-', '+').replaceAll('_', '/') + '==',
    ))
      scalar = (scalar << 8n) + BigInt(char.charCodeAt(0));
    while (columns.length < 8) columns.push(0n);
    return { columns, salt: scalar };
  } catch {
    throw new Error('invalid_private_record');
  }
}

/** Private openings only. The circuit must authenticate positions and enforce scope independently. */
export async function prepareThresholdOpenings<R extends Material>(
  block: { start: number; count: number },
  rows: readonly R[],
  query: Scope,
  schema: { version: string; columns: readonly Column[] },
  ports: OpeningPorts<R>,
) {
  const { start, count } = block;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 2 ** 20 ||
    !Number.isInteger(start) ||
    start < 0 ||
    start >= count ||
    start % 16 !== 0 ||
    rows.length !== Math.min(16, count - start)
  )
    throw new Error('invalid_block');
  if (
    !u64(query.from) ||
    !u64(query.to) ||
    query.from >= query.to ||
    !u64(query.max) ||
    !u64(query.partitionId) ||
    !Number.isInteger(query.column) ||
    query.column < 0 ||
    query.column >= schema.columns.length ||
    schema.columns.length > 8 ||
    schema.columns[query.column]?.type === 'bool'
  )
    throw new Error('invalid_threshold');
  const columns = Array.from({ length: 16 }, empty);
  const salts = Array<bigint>(16).fill(0n);
  let inScopeCount = 0;
  for (const [i, row] of rows.entries()) {
    if (
      row.tenantId !== query.tenantId ||
      !u64(row.partitionId) ||
      !u64(row.ts) ||
      !u64(row.pseq) ||
      row.pseq === 0n
    )
      throw new Error('invalid_material');
    const prev = rows[i - 1];
    if (
      prev &&
      (row.partitionId < prev.partitionId ||
        (row.partitionId === prev.partitionId &&
          (row.pseq !== prev.pseq + 1n || row.ts < prev.ts)))
    )
      throw new Error('invalid_partition_sequence');
    if (
      row.partitionId !== query.partitionId ||
      row.ts < query.from ||
      row.ts >= query.to
    )
      continue;
    if (row.collectionId !== query.collectionId)
      throw new Error('invalid_material');
    const bytes = await ports.open(row);
    try {
      const opened = decode(
        bytes,
        schema.version,
        schema.columns,
        ports.encode,
      );
      if (ports.commit(opened.columns, opened.salt) !== row.colsCommit)
        throw new Error('commitment_mismatch');
      if (opened.columns[query.column]! > query.max)
        throw new Error('predicate_not_satisfied');
      columns[i] = opened.columns;
      salts[i] = opened.salt;
      inScopeCount++;
    } finally {
      bytes.fill(0);
    }
  }
  return { columns, salts, inScopeCount };
}
