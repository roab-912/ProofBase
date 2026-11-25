import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Installed by the development setup, read independently by the verifier.
function artifacts(engine) {
  if (engine === 'noir') return ['target/threshold.json'];
  return [
    'threshold_js/threshold.wasm',
    engine === 'plonk' ? 'plonk.zkey' : 'dev.zkey',
    'vkey.json',
  ];
}
async function digest(path) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return '0x' + hash.digest('hex');
}
export async function installCatalog(dir, size, engine) {
  const profile = JSON.parse(readFileSync('config/protocol.json', 'utf8'));
  if (engine === 'plonk') profile.proofSystemId = 'circom-plonk-bn254/dev1';
  if (engine === 'noir') profile.proofSystemId = 'noir-ultrahonk-bn254/dev1';
  const files = {};
  for (const name of artifacts(engine))
    files[name] = await digest(join(dir, name));
  const artifact = {
    id: 'threshold_max/' + size,
    circuitVersion: '1',
    protocolId: profile.protocolId,
    proofSystemId: profile.proofSystemId,
    ceremony: 'development',
    sha256: files[engine === 'noir' ? 'target/threshold.json' : 'vkey.json'],
  };
  writeFileSync(
    join(dir, 'catalog.json'),
    JSON.stringify({ profile, artifact, blockSize: size, files }, null, 2),
  );
}

export async function checkInstalled(dir, size, engine, profile) {
  const catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'));
  if (
    catalog.blockSize !== size ||
    Object.keys(profile).some((k) => catalog.profile[k] !== profile[k])
  )
    throw new Error('incompatible_artifact_profile');
  for (const name of artifacts(engine))
    if ((await digest(join(dir, name))) !== catalog.files?.[name])
      throw new Error('invalid_installed_artifact');
}
