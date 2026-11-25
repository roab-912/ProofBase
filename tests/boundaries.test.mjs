import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBoundaries } from '../tools/check-boundaries.mjs';

test('repository preserves platform/client boundaries', () =>
  assert.deepEqual(checkBoundaries(process.cwd()), []));
function fixture(t, source, deps = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'proofbase-boundaries-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'packages'));
  mkdirSync(join(dir, 'apps/api/src'), { recursive: true });
  writeFileSync(
    join(dir, 'apps/api/package.json'),
    JSON.stringify({
      name: '@proofbase/api',
      proofbase: { domain: 'platform' },
      dependencies: deps,
    }),
  );
  writeFileSync(join(dir, 'apps/api/src/index.ts'), source);
  return dir;
}
for (const source of [
  "import '@proofbase/sdk';",
  "await import('@proofbase/prover');",
  "require('libsodium-wrappers-sumo');",
  "import '../../../packages/sdk/src/index.js';",
  'await import(moduleName);',
]) {
  test('guard rejects forbidden source boundary: ' + source, (t) =>
    assert.ok(checkBoundaries(fixture(t, source)).length),
  );
}
test('guard rejects a forbidden dependency even without source imports', (t) =>
  assert.ok(
    checkBoundaries(
      fixture(t, 'export {};', { '@proofbase/sdk': 'workspace:*' }),
    ).length,
  ));
test('guard follows transitive workspace dependencies', (t) => {
  const dir = fixture(t, 'export {};', { '@proofbase/core': 'workspace:*' });
  mkdirSync(join(dir, 'packages/core/src'), { recursive: true });
  writeFileSync(join(dir, 'packages/core/src/index.ts'), 'export {};');
  writeFileSync(
    join(dir, 'packages/core/package.json'),
    JSON.stringify({
      name: '@proofbase/core',
      proofbase: { domain: 'public' },
      dependencies: { '@proofbase/sdk': 'workspace:*' },
    }),
  );
  assert.ok(
    checkBoundaries(dir).some((issue) => issue.startsWith('@proofbase/api:')),
  );
});
