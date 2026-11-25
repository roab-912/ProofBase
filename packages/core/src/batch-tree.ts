import type { HashPort, MerklePort } from './ports.js';

export interface BatchLeaf {
  readonly partitionId: bigint;
  readonly pseq: bigint;
  readonly ts: bigint;
  readonly colsCommit: bigint;
}

const depth = 20;
const capacity = 2 ** depth;
const field =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const uint = (x: bigint, bound: bigint) =>
  typeof x === 'bigint' && x >= 0n && x < bound;
const valid = (x: BatchLeaf) =>
  uint(x.partitionId, 1n << 64n) &&
  uint(x.pseq, 1n << 64n) &&
  x.pseq > 0n &&
  uint(x.ts, 1n << 64n) &&
  uint(x.colsCommit, field);
const compare = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

export async function createBatchTree(
  hash: HashPort<bigint, bigint>,
): Promise<MerklePort<BatchLeaf, bigint>> {
  if (hash.id !== 'poseidon-circomlib-bn254/1')
    throw new Error('unsupported_batch_hash');
  const id = 'poseidon-binary-depth20/1';
  const node = (left: bigint, right: bigint) =>
    hash.digest('PB1:NODE', [left, right]);
  const leaf = (x: BatchLeaf) =>
    hash.digest('PB1:LEAF', [x.partitionId, x.pseq, x.ts, x.colsCommit]);
  const empty = [await hash.digest('PB1:EMPTY', [])];
  for (let h = 0; h < depth; h++) empty.push(await node(empty[h]!, empty[h]!));

  async function build(rows: readonly BatchLeaf[], index: number) {
    if (rows.length === 0 || rows.length > capacity || index >= rows.length)
      throw new RangeError('invalid_batch_size_or_index');
    const sorted = rows.map((x) => ({ ...x }));
    if (!sorted.every(valid)) throw new RangeError('invalid_leaf');
    sorted.sort(
      (a, b) =>
        compare(a.partitionId, b.partitionId) || compare(a.pseq, b.pseq),
    );
    let level: bigint[] = [];
    for (const [i, x] of sorted.entries()) {
      const prev = sorted[i - 1];
      if (
        prev &&
        prev.partitionId === x.partitionId &&
        (prev.pseq + 1n !== x.pseq || prev.ts > x.ts)
      )
        throw new RangeError('invalid_partition_sequence');
      level.push(await leaf(x));
    }
    const siblings: bigint[] = [];
    for (let h = 0; h < depth; h++) {
      siblings.push(level[index ^ 1] ?? empty[h]!);
      const parents: bigint[] = [];
      for (let i = 0; i < level.length; i += 2)
        parents.push(await node(level[i]!, level[i + 1] ?? empty[h]!));
      level = parents;
      index >>= 1;
    }
    return { root: level[0]!, siblings };
  }
  return {
    id,
    depth,
    async root(rows) {
      return (await build(rows, 0)).root;
    },
    async inclusion(rows, index) {
      if (!uint(index, BigInt(capacity)))
        throw new RangeError('invalid_batch_index');
      return { treeId: id, index, ...(await build(rows, Number(index))) };
    },
    async verify(row, proof) {
      if (
        !valid(row) ||
        proof.treeId !== id ||
        !uint(proof.index, BigInt(capacity)) ||
        !uint(proof.root, field) ||
        proof.siblings.length !== depth
      )
        return false;
      let digest = await leaf(row);
      let index = Number(proof.index);
      for (const sibling of proof.siblings) {
        if (!uint(sibling, field)) return false;
        digest =
          index & 1 ? await node(sibling, digest) : await node(digest, sibling);
        index >>= 1;
      }
      return digest === proof.root;
    },
  };
}
