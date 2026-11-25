#!/bin/sh
set -eu
# Paths are resolved before changing to the package containing Prover.toml.
pkg=$1
tmp=$(realpath "$2")
bb=$(realpath "${BB:-.local/spike/bb}")
nargo=$(realpath "${NARGO:-.local/spike/nargo}")
timer=$(realpath "${GNU_TIME:-/usr/bin/time}")
export HARDWARE_CONCURRENCY=4
cd "$pkg"
umask 077
witness=$(basename "$tmp")
trap 'rm -f "target/$witness.gz"' EXIT
"$nargo" execute "$witness" -p "$tmp/Prover" >/dev/null 2>&1 || { echo 'witness generation failed' >&2; exit 1; }
"$bb" write_vk -b target/threshold.json -o "$tmp/vk" -t evm >&2
for i in 1 2 3; do
  taskset -c "${SPIKE_CPUS:-0-3}" "$timer" -f '%e %M' -o "$tmp/prove-time" "$bb" prove -b target/threshold.json -w "target/$witness.gz" -k "$tmp/vk/vk" -o "$tmp" -t evm >/dev/null 2>&1 || { echo 'proof generation failed' >&2; exit 1; }
  taskset -c "${SPIKE_CPUS:-0-3}" "$timer" -f '%e' -o "$tmp/verify-time" "$bb" verify -k "$tmp/vk/vk" -p "$tmp/proof" -i "$tmp/public_inputs" -t evm >&2
  paste -d' ' "$tmp/prove-time" "$tmp/verify-time"
done
# Bind the verifier to the independently expected public root.
cp "$tmp/public_inputs" "$tmp/altered-inputs"
perl -0777 -i -pe 'substr($_,31,1) = chr(ord(substr($_,31,1)) ^ 1)' "$tmp/altered-inputs"
if "$bb" verify -k "$tmp/vk/vk" -p "$tmp/proof" -i "$tmp/altered-inputs" -t evm >/dev/null 2>&1; then
  echo 'mutated public input accepted' >&2
  exit 1
fi
