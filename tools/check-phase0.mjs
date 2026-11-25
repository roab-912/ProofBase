import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { filesIn } from './check-boundaries.mjs';

export function specificationDigest() {
  const hash = createHash('sha256');
  for (const path of [...filesIn('docs/spec'), ...filesIn('docs/adr')].sort()) {
    hash.update(relative(process.cwd(), path).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(path));
  }
  return hash.digest('hex');
}

if (process.argv.includes('--digest')) console.log(specificationDigest());
else {
  const status = JSON.parse(readFileSync('docs/phase-0-status.json', 'utf8'));
  const failures = [];
  if (
    status.specifications.status !== 'reviewed' ||
    !status.specifications.reviewer ||
    status.specifications.sourceDigest !== specificationDigest()
  )
    failures.push('Specification review absent or stale');
  if (
    status.remoteCi.status !== 'passed' ||
    !/^https:\/\/github\.com\/roab-912\/ProofBase\/actions\/runs\/\d+$/.test(
      status.remoteCi.runUrl || '',
    ) ||
    !/^[a-f0-9]{40}$/.test(status.remoteCi.commit || '')
  )
    failures.push('Passing remote CI evidence missing');
  if (!status.nextPhaseAllowed) failures.push('Phase 1 remains closed');
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Phase 0 acceptance evidence: PASS');
}
