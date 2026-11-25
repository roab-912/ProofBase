import { lstatSync, readFileSync } from 'node:fs';

// Test oracle only. Never import this module into a platform application.
// The caller keeps sentinels in the isolated client/test process.
export function scanZeroClear({ artifacts, sentinels, requiredKinds }) {
  if (!sentinels?.length || !requiredKinds?.length || !artifacts?.length)
    throw new Error('Incomplete zero-clear evidence');
  const needles = sentinels.flatMap((value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (bytes.length < 16)
      throw new Error('Sentinels must contain at least 16 bytes');
    const text = bytes.toString('utf8');
    return [
      bytes,
      Buffer.from(bytes.toString('hex')),
      Buffer.from(bytes.toString('hex').toUpperCase()),
      Buffer.from(bytes.toString('base64')),
      Buffer.from(bytes.toString('base64url')),
      Buffer.from(JSON.stringify(text).slice(1, -1)),
      Buffer.from(encodeURIComponent(text)),
      Buffer.from(text, 'utf16le'),
    ];
  });
  for (const kind of requiredKinds)
    if (!artifacts.some((artifact) => artifact.kind === kind))
      throw new Error('Missing required evidence category');
  for (const [index, artifact] of artifacts.entries()) {
    const stat = lstatSync(artifact.path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0)
      throw new Error('Invalid or empty evidence file');
    const content = readFileSync(artifact.path);
    if (needles.some((needle) => content.includes(needle)))
      throw new Error(`Zero-clear violation in artifact ${index}`);
  }
  return { scanned: artifacts.length, status: 'pass' };
}
