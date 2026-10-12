import test from 'node:test';
import assert from 'node:assert/strict';
import { scanContent } from '../scripts/scan-rules.mjs';

const priv = ['con', 'vio'].join('');
const host = `mcp.orbit.${priv}.io`;
const flagged = s => scanContent(s);

test('exact public hostname is allowed in URLs, prose and configs', () => {
  for (const s of [`https://${host}/mcp`, `see ${host}.`, `"url": "https://${host}/health"`, `(${host})`, `HTTPS://${host.toUpperCase()}/mcp`])
    assert.deepEqual(flagged(s), [], s);
});

test('lookalike and variant hostnames are rejected', () => {
  for (const s of [
    `https://staging.${host}/mcp`, `https://x${host}/mcp`, `https://${host}.evil.example/mcp`,
    `https://${host}-evil.example`, `https://orbit.${priv}.io`, `https://app.${priv}.io`,
    `https://user@${host}`, `${priv}.io`, `my ${priv} project`, `https://${host}:8443.${priv}.io`,
  ]) assert.ok(flagged(s).includes('private project name'), s);
});

test('allowed host does not mask other violations on the same line', () => {
  assert.ok(flagged(`${host} and ${priv}`).includes('private project name'));
});

test('workers.dev account hosts are rejected', () => {
  assert.ok(flagged(`https://orbit-thread-mcp-staging.some-account.${'workers'}.dev/mcp`).includes('private workers.dev host'));
});

test('credentials and private paths are still detected', () => {
  assert.ok(flagged('ghp_' + 'a'.repeat(30)).includes('credential'));
  assert.ok(flagged('github_pat_' + 'A1'.repeat(15)).includes('credential'));
  assert.ok(flagged('token = ' + 'x'.repeat(24)).includes('credential assignment'));
  assert.ok(flagged('-----BEGIN ' + 'PRIVATE KEY-----').includes('private key'));
  assert.ok(flagged('/' + 'Users/someone/project').includes('machine home path'));
  assert.ok(flagged('/' + 'home/someone').includes('absolute Linux home'));
  assert.ok(flagged('account_id: ' + 'a'.repeat(32)).includes('cloudflare account id assignment'));
});
