import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const compose = (...args) =>
  execFileSync('docker', ['compose', 'exec', '-T', ...args], {
    encoding: 'utf8',
    timeout: 10000,
  }).trim();
assert.equal(
  compose(
    'postgres',
    'sh',
    '-c',
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT 1"',
  ),
  '1',
);
assert.equal(compose('redis', 'redis-cli', 'ping'), 'PONG');
console.log('PostgreSQL and Redis: PASS');
