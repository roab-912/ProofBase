import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { installCatalog } from './catalog.mjs';
const [engine, n] = process.argv.slice(2);
const size = Number(n);
if (![16, 64, 256].includes(size)) throw new Error('unsupported_block_size');
const base = resolve(process.env.SPIKE_DIR ?? '.local/spike');
const log = Math.log2(size);
const begin = performance.now();
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', ...options });
if (engine === 'noir') {
  const dir = join(base, 'noir' + n);
  mkdirSync(join(dir, 'src'), { recursive: true });
  let manifest = readFileSync('circuits/noir/Nargo.toml', 'utf8');
  if (process.env.NOIR_POSEIDON_PATH)
    manifest = manifest.replace(
      /poseidon = .*/,
      'poseidon = { path = ' +
        JSON.stringify(process.env.NOIR_POSEIDON_PATH) +
        ' }',
    );
  writeFileSync(join(dir, 'Nargo.toml'), manifest);
  writeFileSync(
    join(dir, 'src/main.nr'),
    readFileSync('circuits/noir/src/main.nr', 'utf8')
      .replace('N: u32 = 16;', `N: u32 = ${size};`)
      .replace('LOG_N: u32 = 4;', `LOG_N: u32 = ${log};`),
  );
  const nargo = process.env.NARGO ?? 'nargo';
  if (process.platform === 'win32')
    run('wsl', ['-d', 'Debian', '--', nargo, 'compile'], { cwd: dir });
  else run(nargo, ['compile'], { cwd: dir });
  await installCatalog(dir, size, engine);
  writeFileSync(
    join(dir, 'preparation.json'),
    JSON.stringify({ size, engine, compileMs: performance.now() - begin }),
  );
} else {
  if (!['groth16', 'plonk'].includes(engine) || !process.env.PTAU)
    throw new Error('specify groth16/plonk and PTAU');
  const dir = join(base, n, engine === 'plonk' ? 'plonk' : '');
  mkdirSync(dir, { recursive: true });
  const src = join(dir, 'threshold.circom');
  writeFileSync(
    src,
    `pragma circom 2.1.9; include "threshold-max.circom"; component main {public [root,start,count,target,from,to,column,max]} = ThresholdMax(${log});\n`,
  );
  run(process.env.CIRCOM ?? 'circom', [
    src,
    '-l',
    'circuits',
    '-l',
    'node_modules',
    engine === 'plonk' ? '--O1' : '--O2',
    '--wasm',
    '--r1cs',
    '-o',
    dir,
  ]);
  const cli = (args) =>
    run(process.execPath, ['node_modules/snarkjs/build/cli.cjs', ...args]);
  const compiled = performance.now();
  const key = join(dir, engine === 'plonk' ? 'plonk.zkey' : 'dev.zkey');
  const initial = engine === 'plonk' ? key : join(dir, 'initial.zkey');
  cli([
    engine,
    'setup',
    join(dir, 'threshold.r1cs'),
    process.env.PTAU,
    initial,
  ]);
  if (engine === 'groth16')
    run(process.execPath, ['tools/spike/contribute.mjs', initial, key]);
  cli(['zkey', 'export', 'verificationkey', key, join(dir, 'vkey.json')]);
  await installCatalog(dir, size, engine);
  writeFileSync(
    join(dir, 'preparation.json'),
    JSON.stringify({
      size,
      engine,
      compileMs: compiled - begin,
      setupMs: performance.now() - compiled,
    }),
  );
}
