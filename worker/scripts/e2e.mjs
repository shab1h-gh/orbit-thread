// End-to-end check of a deployed Orbit Next endpoint using the official MCP client.
// Usage: node scripts/e2e.mjs https://<worker-host>/mcp [owner repo]
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const [endpoint, owner = 'shab1h-gh', repo = 'orbit-thread'] = process.argv.slice(2);
assert.ok(endpoint?.startsWith('https://') && endpoint.endsWith('/mcp'), 'Usage: node scripts/e2e.mjs https://<host>/mcp [owner repo]');

const client = new Client({ name: 'orbit-next-e2e', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
console.log('initialize ok:', client.getServerVersion()?.name, client.getServerVersion()?.version);

const { tools } = await client.listTools();
assert.deepEqual(tools.map(t => t.name).sort(), ['assess_release_readiness', 'diagnose_ci_failure', 'get_project_next_actions']);
assert.ok(tools.every(t => t.annotations?.readOnlyHint === true));
console.log('tools/list ok:', tools.map(t => t.name).join(', '));

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  console.log(`${name} ${JSON.stringify(args)} -> ${res.isError ? 'ERROR' : 'ok'} (${text.length} chars)`);
  return { res, text };
};

let rateLimited = false;
const note = ({ res, text }) => { if (res.isError && /rate limit/i.test(text)) rateLimited = true; return { res, text }; };

const next = note(await call('get_project_next_actions', { owner, repo }));
const release = note(await call('assess_release_readiness', { owner, repo }));
const ci = note(await call('diagnose_ci_failure', { owner, repo }));
for (const [name, r] of Object.entries({ next, release, ci })) {
  if (!rateLimited) assert.ok(!r.res.isError, `${name} failed: ${r.text}`);
}

for (const [label, name, args] of [
  ['invalid owner', 'get_project_next_actions', { owner: '../etc', repo }],
  ['invalid repo', 'assess_release_readiness', { owner, repo: 'a/b' }],
  ['invalid run_id', 'diagnose_ci_failure', { owner, repo, run_id: -1 }],
  ['missing repo', 'get_project_next_actions', { owner, repo: 'this-repo-does-not-exist-orbit-next' }],
]) {
  const r = await client.callTool({ name, arguments: args }).catch(e => ({ isError: true, content: [{ text: String(e.message) }] }));
  assert.equal(r.isError, true, `${label} should be rejected`);
  console.log(`rejects ${label}: ok`);
}

const bad = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
assert.equal(bad.status, 403);
const get = await fetch(endpoint, { method: 'GET' });
assert.equal(get.status, 405);
console.log('origin + method hardening: ok');
if (rateLimited) console.log('NOTE: GitHub unauthenticated rate limit was hit; tool results were rate-limit errors (handled correctly).');
await client.close();
console.log('E2E PASSED');
