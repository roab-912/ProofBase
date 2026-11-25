import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const networks = JSON.parse(
  readFileSync(new URL('../config/networks.json', import.meta.url), 'utf8'),
);
for (const [name, network] of Object.entries(networks)) {
  try {
    const endpoint = process.env[network.rpcEnv] || network.publicRpcUrl;
    assert.equal(new URL(endpoint).protocol, 'https:');
    async function rpc(method, params = []) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.error, undefined);
      return body.result;
    }
    assert.equal(Number(BigInt(await rpc('eth_chainId'))), network.chainId);
    const block = await rpc('eth_getBlockByNumber', ['latest', false]);
    assert.ok(BigInt(block.number) > 0n);
    assert.match(block.hash, /^0x[0-9a-f]{64}$/);
    const stable = await rpc('eth_getBlockByNumber', [
      network.finalityTag || network.checkpointSourceTag,
      false,
    ]);
    assert.ok(BigInt(stable.number) <= BigInt(block.number));
    assert.match(stable.hash, /^0x[0-9a-f]{64}$/);
    console.log(`${name}: chain ${network.chainId}, canonical RPC reads PASS`);
  } catch {
    // RPC URLs may contain API credentials. Never print the underlying exception.
    console.error(
      `${name}: testnet check failed (configuration, connectivity or chain mismatch)`,
    );
    process.exitCode = 1;
  }
}
