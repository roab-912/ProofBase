import { randomBytes } from 'node:crypto';
import { zKey } from 'snarkjs';
const [initial, final] = process.argv.slice(2);
await zKey.contribute(
  initial,
  final,
  'development-only',
  randomBytes(64).toString('hex'),
);
process.exit(0);
