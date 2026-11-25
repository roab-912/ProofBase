import assert from 'node:assert/strict';
import { proveBlock } from '../../packages/prover/src/block-proof.ts';
import { verifyThresholdBlock } from '../../packages/verifier/src/threshold.ts';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
// ffjavascript sizes its worker pool from os.cpus().
const cores = os.cpus().slice(0, 4);
os.cpus = () => cores;
const snark = await import('snarkjs');
const plonk = process.env.SPIKE_ENGINE === 'plonk';
const engine = plonk ? snark.plonk : snark.groth16;
const [dir, tmp] = process.argv.slice(2);
const expected = JSON.parse(readFileSync(join(tmp, 'expected.json'), 'utf8'));
const installed = plonk ? join(dir, 'plonk') : dir;
const bytes = readFileSync(join(installed, 'vkey.json'));
const catalog = {
  ...JSON.parse(readFileSync(join(installed, 'catalog.json'), 'utf8')),
  key: bytes,
};
const { profile, artifact } = catalog;
const vk = JSON.parse(bytes);
let proveMs, peakKiB;
async function prove(provingKey, witness) {
  const start = performance.now();
  let proof, publicSignals;
  if (process.env.RAPIDSNARK) {
    const args = [
      'sh',
      'tools/spike/native.sh',
      process.env.RAPIDSNARK,
      ...[dir, tmp].map((p) =>
        relative(process.cwd(), p).replaceAll('\\', '/'),
      ),
    ];
    const cmd =
      process.platform === 'win32'
        ? ['wsl', ['-d', 'Debian', '--', ...args]]
        : [args[0], args.slice(1)];
    ({ proveMs, peakKiB } = JSON.parse(
      execFileSync(cmd[0], cmd[1], { encoding: 'utf8' }),
    ));
    proof = JSON.parse(readFileSync(join(tmp, 'proof.json'), 'utf8'));
    publicSignals = JSON.parse(readFileSync(join(tmp, 'public.json'), 'utf8'));
  } else {
    process.send?.('proving');
    ({ proof, publicSignals } = await engine.prove(provingKey, witness));
    proveMs = performance.now() - start;
    process.send?.('proved');
    peakKiB = process.resourceUsage().maxRSS;
  }
  return { publicSignals, proof: Buffer.from(JSON.stringify(proof)) };
}
const envelope = await proveBlock(
  { id: plonk ? 'circom-plonk-bn254/dev1' : 'circom-groth16-bn254/1', prove },
  join(installed, plonk ? 'plonk.zkey' : 'dev.zkey'),
  join(tmp, 'client.wtns'),
  expected,
  profile,
  artifact,
);
const before = performance.now();
const query = {
  root: BigInt(expected[11]),
  start: 0,
  count: Number(expected[13]),
  target: 2n,
  from: 0n,
  to: BigInt(expected[13]),
  column: 0,
  max: BigInt(expected[18]),
};
const verifier = {
  id: profile.proofSystemId,
  verify: (p, k) =>
    engine.verify(
      JSON.parse(Buffer.from(k).toString()),
      p.publicInputs,
      JSON.parse(Buffer.from(p.proof).toString()),
    ),
};
await verifyThresholdBlock(envelope, catalog, query, verifier);
const verifyMs = performance.now() - before;
const changed = [...expected];
changed[11] = (BigInt(changed[11]) + 1n).toString();
assert.equal(
  await engine.verify(vk, changed, JSON.parse(envelope.proof)),
  false,
);
console.log(JSON.stringify({ proveMs, verifyMs, peakKiB }));
process.exit(0);
