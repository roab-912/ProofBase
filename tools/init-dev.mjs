import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

try {
  writeFileSync(
    '.env',
    `POSTGRES_USER=proofbase\nPOSTGRES_DB=proofbase\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Local infrastructure configuration created; credentials are not printed.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
