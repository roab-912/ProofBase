// Emit only aggregate times and memory; never copy a witness or circuit input.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2] ?? '.local/spike';
const snapshot =
  existsSync(root) && statSync(root).isFile()
    ? JSON.parse(readFileSync(root, 'utf8'))
    : undefined;
console.log(
  '| Moteur | N | Preuve médiane / p95 (s) | Vérification médiane / p95 (s) | Pic (Mio) |',
);
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const [label, file] of [
  ['Groth16 natif', 'native'],
  ['Groth16 WASM', 'measurement'],
  ['UltraHonk natif', 'noir'],
  ['PLONK WASM', 'plonk'],
]) {
  for (const size of [16, 64, 256]) {
    const path = join(root, String(size), file + '.json');
    const sample = snapshot
      ? snapshot[file]?.[size]
      : existsSync(path)
        ? JSON.parse(readFileSync(path, 'utf8'))
        : undefined;
    if (!sample) {
      console.log(`| ${label} | ${size} | — | — | — |`);
      continue;
    }
    const { results } = sample;
    const timeout = (r) =>
      file === 'plonk' &&
      size === 64 &&
      r.status === 'timeout' &&
      r.deadlineMs === 60000;
    if (
      results.length !== 3 ||
      results
        .filter((r) => !timeout(r))
        .some((r) =>
          ['proveMs', 'verifyMs', 'peakKiB'].some(
            (k) => !Number.isFinite(r[k]) || r[k] <= 0,
          ),
        )
    )
      throw new Error('incomplete_measurement');
    if (results.some(timeout)) {
      const values = results
        .map((r) => (timeout(r) ? Infinity : r.proveMs / 1000))
        .sort((a, b) => a - b);
      const format = (v) => (Number.isFinite(v) ? v.toFixed(3) : '>60');
      console.log(
        `| ${label} | ${size} | ${format(values[1])} / ${format(values[2])} | — | — |`,
      );
      continue;
    }
    const stats = (k) =>
      results
        .map((r) => r[k] / 1000)
        .sort((a, b) => a - b)
        .slice(1)
        .map((x) => x.toFixed(3))
        .join(' / ');
    console.log(
      `| ${label} | ${size} | ${stats('proveMs')} | ${stats('verifyMs')} | ${Math.ceil(Math.max(...results.map((r) => r.peakKiB)) / 1024)} |`,
    );
  }
}
