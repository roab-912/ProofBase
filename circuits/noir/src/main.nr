use poseidon::poseidon::bn254::{hash_1, hash_3, hash_5, hash_9};

global N: u32 = 16;
global LOG_N: u32 = 4;
fn node(a: Field, b: Field) -> Field {
    hash_3([0x5042313a4e4f4445, a, b])
}

fn main(
    root: pub Field,
    start: pub u32,
    count: pub u32,
    target: pub u64,
    from: pub u64,
    to: pub u64,
    column: pub u8,
    max: pub u64,
    partitionId: [u64; N],
    pseq: [u64; N],
    ts: [u64; N],
    colsCommit: [Field; N],
    columns: [[Field; 8]; N],
    salts: [u128; N],
    siblings: [Field; 20 - LOG_N],
) -> pub [Field; 11] {
    assert(start < count);
    assert(count <= 1048576);
    assert(start % N == 0);
    assert(from < to);
    assert(column < 8);
    let mut zeros = [0; 21];
    zeros[0] = hash_1([0x5042313a454d505459]);
    for h in 0..20 {
        zeros[h + 1] = node(zeros[h], zeros[h]);
    }
    let mut heap = [0; 2 * N];
    let mut out = [0; 11];
    out[1] = partitionId[0] as Field;
    out[2] = pseq[0] as Field;
    out[3] = ts[0] as Field;
    let mut seen = false;
    for i in 0..N {
        let present = start + i < count;
        assert((pseq[i] != 0) == present);
        if i > 0 {
            let prev = if i > 0 { i - 1 } else { 0 };
            if present {
                assert(partitionId[prev] <= partitionId[i]);
                if partitionId[prev] == partitionId[i] {
                    assert((pseq[i] as Field) == (pseq[prev] as Field) + 1);
                    assert(ts[i] >= ts[prev]);
                }
            }
        }
        let matches = present & (partitionId[i] == target);
        let selected = matches & (from <= ts[i]) & (ts[i] < to);
        let mut opening = [0; 9];
        for j in 0..8 {
            opening[j] = columns[i][j];
        }
        opening[8] = salts[i] as Field;
        let digest = hash_9(opening);
        if selected {
            assert(digest == colsCommit[i]);
            let value = columns[i][column as u32];
            let bounded = value as u64;
            assert(value == (bounded as Field));
            assert(bounded <= max);
            out[0] = out[0] + 1;
        }
        if present {
            out[4] = partitionId[i] as Field;
            out[5] = pseq[i] as Field;
            out[6] = ts[i] as Field;
        }
        if matches {
            if !seen {
                out[7] = pseq[i] as Field;
                out[8] = ts[i] as Field;
            }
            seen = true;
            out[9] = pseq[i] as Field;
            out[10] = ts[i] as Field;
        }
        let leaf = hash_5([
            0x5042313a4c454146,
            partitionId[i] as Field,
            pseq[i] as Field,
            ts[i] as Field,
            colsCommit[i],
        ]);
        heap[N + i] = if present { leaf } else { zeros[0] };
    }
    for k in 1..N {
        let i = N - k;
        heap[i] = node(heap[2 * i], heap[2 * i + 1]);
    }
    let mut digest = heap[1];
    for h in LOG_N..20 {
        let idx = start >> h;
        let sibling = siblings[h - LOG_N];
        if ((idx ^ 1) << h) >= count {
            assert(sibling == zeros[h]);
        }
        digest = if idx % 2 == 0 {
            node(digest, sibling)
        } else {
            node(sibling, digest)
        };
    }
    assert(root == digest);
    out
}
