// Isolated stand-in for the encrypted storage contract. No SDK or prover imports.
import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(0, 'utf8'));
const allowed = [
  'profile',
  'tenantId',
  'collectionId',
  'keyId',
  'partitionId',
  'colsCommit',
  'ts',
  'pseq',
  'envelope',
];
const profileFields = Object.keys(
  JSON.parse(readFileSync('config/protocol.json', 'utf8')),
);
function exact(obj, fields) {
  return (
    Object.keys(obj).length === fields.length &&
    fields.every((k) => Object.hasOwn(obj, k))
  );
}
if (
  !Array.isArray(rows) ||
  !rows.every(
    (r) =>
      exact(r, allowed) &&
      exact(r.profile, profileFields) &&
      exact(r.envelope, ['suiteId', 'keyId', 'nonce', 'ciphertext']),
  )
)
  throw new Error('invalid_storage_material');
// The spike simulates storage and readback. This output is the complete dump.
process.stdout.write(JSON.stringify(rows));
