import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parse, parseAllDocuments } from 'yaml';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
test('tool versions and all workspace dependencies are locked', () => {
  const root = json('package.json');
  const versions = json('tools/versions.json');
  assert.equal(root.engines.node, versions.node.version);
  assert.equal(readFileSync('.node-version', 'utf8').trim(), root.engines.node);
  assert.equal(
    root.packageManager,
    `pnpm@${versions.npm.find((p) => p.name === 'pnpm').version}`,
  );
  for (const [name, version] of Object.entries(root.devDependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(version, versions.npm.find((p) => p.name === name).version);
  }
  const documents = parseAllDocuments(readFileSync('pnpm-lock.yaml', 'utf8'));
  for (const document of documents) assert.deepEqual(document.errors, []);
  const lock = documents
    .map((doc) => doc.toJS())
    .find((doc) => doc.importers?.['.']?.devDependencies);
  assert.ok(
    lock,
    'pnpm 12 may use multiple YAML documents; inspect the dependency document',
  );
  for (const [name, version] of Object.entries(root.devDependencies))
    assert.equal(lock.importers['.'].devDependencies[name].specifier, version);
  for (const group of [
    'apps/api',
    'apps/web',
    'apps/admin',
    'apps/worker',
    'packages/core',
    'packages/sdk',
    'packages/prover',
    'packages/verifier',
  ]) {
    assert.ok(existsSync(`${group}/src/index.ts`));
    assert.ok(Object.hasOwn(lock.importers, group));
  }
});

test('infrastructure has PostgreSQL/Redis only, immutable images and loopback ports', () => {
  const compose = parse(readFileSync('compose.yaml', 'utf8'));
  assert.deepEqual(Object.keys(compose.services).sort(), ['postgres', 'redis']);
  for (const service of Object.values(compose.services)) {
    assert.match(
      service.image,
      /:\d+\.\d+(?:\.\d+)?[^@]*@sha256:[a-f0-9]{64}$/,
    );
    assert.ok(service.healthcheck?.test.length);
    for (const port of service.ports) assert.match(port, /^127\.0\.0\.1:/);
  }
});

test('only Sepolia and Arbitrum Sepolia are configured; profile is explicit', () => {
  const networks = json('config/networks.json');
  assert.deepEqual(
    Object.values(networks)
      .map((n) => n.chainId)
      .sort((a, b) => a - b),
    [421614, 11155111],
  );
  for (const network of Object.values(networks))
    assert.equal(new URL(network.publicRpcUrl).protocol, 'https:');
  const profile = json('config/protocol.json');
  for (const field of [
    'protocolId',
    'encodingId',
    'recordHashId',
    'batchTreeId',
    'anchorTreeId',
    'proofSystemId',
    'encryptionSuiteId',
  ])
    assert.ok(profile[field]);
});

test('CI pins official actions and runs acceptance checks without wallet secrets', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const versions = json('tools/versions.json');
  assert.deepEqual(ci.permissions, { contents: 'read' });
  const runs = [];
  for (const job of Object.values(ci.jobs))
    for (const step of job.steps) {
      if (step.uses) {
        const [name, sha] = step.uses.split('@');
        assert.equal(sha, versions.actions.find((a) => a.name === name).sha);
      }
      if (step.run) runs.push(step.run);
    }
  for (const command of [
    'pnpm install --frozen-lockfile',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'pnpm test:infra',
    'pnpm test:chains',
  ])
    assert.ok(runs.includes(command), command);
  assert.ok(!JSON.stringify(ci).includes('PRIVATE_KEY'));
});

test('all Phase 0 specifications and decisions exist', () => {
  for (const spec of [
    'leaf-format',
    'encryption-vault',
    'trees',
    'completeness',
    'two-level-anchoring',
    'bundle',
    'api',
    'zero-clear',
  ])
    assert.ok(readFileSync(`docs/spec/${spec}.md`, 'utf8').length > 1000);
  for (const adr of [
    '001-client-proof-system',
    '002-networks-finality',
    '003-encryption-vault',
    '004-protocol-completeness',
    '005-tooling-phase-gates',
    '006-testnets-and-ports',
  ])
    assert.ok(existsSync(`docs/adr/${adr}.md`));
});
