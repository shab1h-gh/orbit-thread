import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handle } from '../src/index.js';
import { mockGitHub, repoMeta, SHA } from './helpers.js';

const R = '/repos/o/r';
const routes = {
  [R]: repoMeta(),
  [`${R}/commits?sha=main&per_page=10`]: [{ sha: SHA, commit: { committer: { date: new Date().toISOString() } } }],
  [`${R}/pulls?state=open&sort=updated&direction=desc&per_page=30`]: [],
  [`${R}/issues?state=open&sort=updated&direction=desc&per_page=50`]: [{ number: 7, title: 'Crash', labels: [{ name: 'bug' }] }],
  [`${R}/actions/runs?branch=main&per_page=10&exclude_pull_requests=true`]: { workflow_runs: [] },
};
const env = {};

/** A real MCP SDK client talking to the Worker handler through fetch (no network). */
async function connect(extraRoutes = {}) {
  const gh = mockGitHub({ ...routes, ...extraRoutes });
  const fetchToWorker = (async (input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input as string, init), env, { client: () => gh.client() })) as typeof fetch;
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://worker.test/mcp'), { fetch: fetchToWorker }));
  return { client, gh };
}

describe('MCP endpoint (real SDK client)', () => {
  it('initializes, lists three read-only tools and calls one', async () => {
    const { client } = await connect();
    expect(client.getServerVersion()?.name).toBe('orbit-next');
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['assess_release_readiness', 'diagnose_ci_failure', 'get_project_next_actions']);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(JSON.stringify(t).length).toBeLessThan(1500);
    }
    const res: any = await client.callTool({ name: 'get_project_next_actions', arguments: { owner: 'o', repo: 'r' } });
    expect(res.isError).toBeFalsy();
    const body = JSON.parse(res.content[0].text);
    expect(body.actions[0].id).toBe('issue-00000007');
    expect(body.unknowns.length).toBeGreaterThan(0);
  });
  it('returns tool errors (not protocol crashes) for invalid, private and missing inputs', async () => {
    const { client } = await connect({ '/repos/o/priv': repoMeta({ private: true }) });
    for (const args of [{ owner: '../x', repo: 'r' }, { owner: 'o', repo: 'a/b' }, { owner: 'o', repo: 'priv' }, { owner: 'o', repo: 'nope' }]) {
      const res: any = await client.callTool({ name: 'assess_release_readiness', arguments: args }).catch(e => ({ thrown: e }));
      expect(res.isError === true || res.thrown).toBeTruthy();
    }
    const bad: any = await client.callTool({ name: 'diagnose_ci_failure', arguments: { owner: 'o', repo: 'r', run_id: -5 } }).catch(e => ({ thrown: e }));
    expect(bad.isError === true || bad.thrown).toBeTruthy();
  });
  it('reports rate limiting clearly', async () => {
    const { client } = await connect({ [`${R}/pulls?state=open&sort=updated&direction=desc&per_page=30`]: () => new Response('{}', { status: 429 }) });
    const res: any = await client.callTool({ name: 'get_project_next_actions', arguments: { owner: 'o', repo: 'r' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/rate limit/i);
  });
});

describe('HTTP hardening', () => {
  const post = (body: unknown, headers: Record<string, string> = {}, e = env) => handle(new Request('https://w.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), e);
  it('rejects non-POST methods, wrong content types, oversize bodies and foreign origins', async () => {
    for (const method of ['GET', 'DELETE', 'PUT']) expect((await handle(new Request('https://w.test/mcp', { method }), env)).status).toBe(405);
    expect((await post('{}', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post('x'.repeat(40_000))).status).toBe(413);
    expect((await post({}, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://claude.ai' })).headers.get('access-control-allow-origin')).toBe('https://claude.ai');
  });
  it('returns JSON-RPC errors for malformed JSON and unknown tools', async () => {
    expect((await post('{not json')).status).toBe(400);
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'delete_everything', arguments: {} } }, {});
    const text = await res.text();
    expect(text).toMatch(/not found|unknown|error/i);
  });
  it('serves health, root and 404s, with security headers and no sessions', async () => {
    const h = await handle(new Request('https://w.test/health'), env);
    expect(h.status).toBe(200);
    expect(h.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await handle(new Request('https://w.test/anything'), env)).status).toBe(404);
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
    expect(init.status).toBe(200);
    expect(init.headers.get('mcp-session-id')).toBeNull();
  });
  it('applies the rate limiter binding', async () => {
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, {}, { LIMITER: { limit: async () => ({ success: false }) } } as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
  });
});
