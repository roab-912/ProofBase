#!/bin/sh
set -eu
binary=$1 dir=$2 tmp=$3
export OMP_NUM_THREADS=4
taskset -c "${SPIKE_CPUS:-0-3}" "${GNU_TIME:-/usr/bin/time}" -f '%e %M' -o "$tmp/resources" "$binary" "$dir/dev.zkey" "$tmp/client.wtns" "$tmp/proof.json" "$tmp/public.json" >/dev/null
awk '{printf "{\"proveMs\":%.2f,\"peakKiB\":%d}\n", $1*1000, $2}' "$tmp/resources"
