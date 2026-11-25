import {
  validateThresholdQuery,
  type verifyThresholdBlock,
  type ThresholdStatement,
} from './threshold.ts';

export interface BatchInventoryEntry {
  readonly batchId: bigint;
  readonly root: bigint;
  readonly firstSeq: bigint;
  readonly lastSeq: bigint;
}
export interface ThresholdSnapshot {
  readonly tenantId: string;
  readonly chainId: 421614;
  readonly registry: `0x${string}`;
  readonly blockNumber: bigint;
  readonly blockHash: `0x${string}`;
  readonly batchCount: bigint;
}
export interface ThresholdInventory {
  readonly snapshot: ThresholdSnapshot;
  readonly anchors: readonly BatchInventoryEntry[];
}
type Boundaries = Awaited<ReturnType<typeof verifyThresholdBlock>>;
type VerifyBlock<P> = (
  proof: P,
  statement: ThresholdStatement,
) => Promise<Boundaries>;

/** Trusted inventory must cover the entire tenant snapshot in contract order.
 * verifyBlock must validate each proof with the artifact for this blockSize. */
export async function verifyThresholdHistory<P>(
  trusted: ThresholdInventory,
  requested: ThresholdSnapshot,
  batches: readonly {
    readonly batchId: bigint;
    readonly blocks: readonly P[];
  }[],
  blockSize: 16 | 64 | 256,
  query: Omit<ThresholdStatement, 'start' | 'count' | 'root'>,
  verifyBlock: VerifyBlock<P>,
) {
  const invalid = (): never => {
    throw new Error('incomplete_threshold_history');
  };
  validateThresholdQuery(query);
  const inventory = trusted.anchors;
  const at = trusted.snapshot;
  if (
    at.chainId !== 421614 ||
    at.tenantId !== requested.tenantId ||
    at.chainId !== requested.chainId ||
    at.registry !== requested.registry ||
    at.blockNumber !== requested.blockNumber ||
    at.blockHash !== requested.blockHash ||
    at.batchCount !== requested.batchCount ||
    at.batchCount !== BigInt(inventory.length)
  )
    invalid();
  if (inventory.length !== batches.length || ![16, 64, 256].includes(blockSize))
    invalid();
  let nextSeq = 1n,
    nextPartitionSeq = 1n,
    lastTargetTime = 0n,
    matched = 0n;
  for (const [i, anchor] of inventory.entries()) {
    const batch = batches[i]!;
    const length = anchor.lastSeq - anchor.firstSeq + 1n;
    if (
      anchor.batchId !== BigInt(i) ||
      batch.batchId !== BigInt(i) ||
      anchor.firstSeq !== nextSeq ||
      anchor.lastSeq >= 1n << 64n ||
      length < 1n ||
      length > 1n << 20n
    )
      invalid();
    nextSeq = anchor.lastSeq + 1n;
    const count = Number(length);
    if (batch.blocks.length !== Math.ceil(count / blockSize)) invalid();
    let previous: Boundaries['last'] | undefined;
    for (const [j, proof] of batch.blocks.entries()) {
      const checked = await verifyBlock(proof, {
        ...query,
        root: anchor.root,
        count,
        start: j * blockSize,
      });
      const [part, seq, time] = checked.first;
      if (
        previous &&
        (part < previous[0]! ||
          (part === previous[0] &&
            (seq !== previous[1]! + 1n || time < previous[2]!)))
      )
        invalid();
      previous = checked.last;
      if (checked.targetFirst[0] !== 0n) {
        if (
          checked.targetFirst[0] !== nextPartitionSeq ||
          checked.targetFirst[1]! < lastTargetTime
        )
          invalid();
        nextPartitionSeq = checked.targetLast[0]! + 1n;
        lastTargetTime = checked.targetLast[1]!;
      }
      matched += checked.matched;
    }
  }
  return { status: matched === 0n ? 'empty_scope' : 'valid', matched } as const;
}
