import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { scanZeroClear } from '../tools/zero-clear.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'proofbase-zero-clear-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const requiredKinds = ['database', 'logs', 'queue', 'http'];
  const artifacts = requiredKinds.map((kind) => ({
    kind,
    path: join(dir, kind),
  }));
  for (const artifact of artifacts)
    writeFileSync(artifact.path, 'synthetic opaque artifact\n');
  return {
    requiredKinds,
    artifacts,
    sentinels: [
      Buffer.from(`tenant-value-${randomBytes(24).toString('hex')}`),
      randomBytes(32),
    ],
  };
}

test('zero-clear scanner accepts complete clean synthetic evidence', (t) => {
  assert.deepEqual(scanZeroClear(fixture(t)), { status: 'pass', scanned: 4 });
});
for (const kind of ['database', 'logs', 'queue', 'http']) {
  for (const encoding of ['raw', 'hex', 'base64', 'base64url', 'utf16le']) {
    test(`zero-clear rejects ${encoding} canary in ${kind} without printing it`, (t) => {
      const input = fixture(t);
      const sentinel = input.sentinels[encoding === 'utf16le' ? 0 : 1];
      const leak =
        encoding === 'raw'
          ? sentinel
          : encoding === 'utf16le'
            ? Buffer.from(sentinel.toString(), 'utf16le')
            : sentinel.toString(encoding);
      writeFileSync(input.artifacts.find((a) => a.kind === kind).path, leak);
      assert.throws(
        () => scanZeroClear(input),
        (error) =>
          error.message.startsWith('Zero-clear violation') &&
          !error.message.includes(sentinel.toString('hex')),
      );
    });
  }
}
test('zero-clear fails closed for missing, empty or absent artifacts and missing sentinels', (t) => {
  const input = fixture(t);
  assert.throws(() => scanZeroClear({ ...input, sentinels: [] }));
  assert.throws(() =>
    scanZeroClear({ ...input, artifacts: input.artifacts.slice(1) }),
  );
  writeFileSync(input.artifacts[0].path, '');
  assert.throws(() => scanZeroClear(input));
  rmSync(input.artifacts[0].path);
  assert.throws(() => scanZeroClear(input));
});
