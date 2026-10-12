import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient, resetGitHubState } from '../src/github.js';
import { handle } from '../src/index.js';
import { mockGitHub, repoMeta, SHA } from './helpers.js';

// Obviously fake, fixed test value (not a real credential).
const TOKEN = ['test', 'value', 'not', 'real', '0123456789'].join('-');
const secondsFromNow = (n: number) => String(Math.floor(Date.now() / 1000) + n);

beforeEach(() => resetGitHubState());
afterEach(() => vi.unstubAllGlobals());

describe('optional GitHub authentication', () => {
  it('stays unauthenticated when no token is configured', async () => {
    const m = mockGitHub({ '/repos/o/r': repoMeta() });
    await m.client().json('/repos/o/r');
    expect(m.calls[0].headers.get('authorization')).toBeNull();
  });

  it('sends the token only to api.github.com, never to raw.githubusercontent.com', async () => {
    const m = mockGitHub({ '/repos/o/r': repoMeta(), [`raw:/o/r/${SHA}/package.json`]: '{}' });
    const c = m.client({ token: TOKEN });
    await c.json('/repos/o/r');
    await c.file({ owner: 'o', repo: 'r' }, SHA, 'package.json');
    const [api, raw] = m.calls;
    expect(api.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(new URL(raw.url).host).toBe('raw.githubusercontent.com');
    expect(raw.headers.get('authorization')).toBeNull();
    for (const call of m.calls) expect(call.method).toBe('GET');
  });

  it('ignores malformed tokens instead of sending them', async () => {
    const m = mockGitHub({ '/repos/o/r': repoMeta() });
    await m.client({ token: 'bad token\r\nx-injected: 1' }).json('/repos/o/r');
    expect(m.calls[0].headers.get('authorization')).toBeNull();
  });

  it('falls back to unauthenticated access when the token is rejected, without leaking it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ok = mockGitHub({ '/repos/o/r': repoMeta() });
    const calls: string[] = [];
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Headers(init?.headers).get('authorization') ?? 'none');
      return new Headers(init?.headers).get('authorization') ? new Response(`{"message":"Bad credentials"}`, { status: 401 }) : ok.fetchImpl(input, init);
    }) as typeof fetch;
    const c = new GitHubClient({ fetchImpl: f, cache: null, token: TOKEN });
    await expect(c.json('/repos/o/r')).resolves.toMatchObject({ default_branch: 'main' });
    await c.json('/repos/o/r'); // cooldown: token is not retried
    expect(calls).toEqual([`Bearer ${TOKEN}`, 'none', 'none']);
    expect(warn).toHaveBeenCalledWith('github_token_rejected');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
    warn.mockRestore();
  });

  it('fails fast once a quota is exhausted, and reports it without token wording leaks', async () => {
    const exhausted = () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': secondsFromNow(600) } });
    const m = mockGitHub({ '/repos/o/r': exhausted });
    const c = m.client({ token: TOKEN });
    const first = (await c.json('/repos/o/r').catch(e => e)) as Error;
    expect(first).toMatchObject({ kind: 'rate_limited' });
    expect(first.message).not.toContain(TOKEN);
    expect(first.message).not.toMatch(/unauthenticated/);
    const second = await m.client({ token: TOKEN }).json('/repos/o/x').catch(e => e);
    expect(second).toMatchObject({ kind: 'rate_limited' });
    expect(m.calls).toHaveLength(1); // second call never reached GitHub
  });

  it('tracks authenticated and unauthenticated quotas separately', async () => {
    const exhausted = () => new Response('{}', { status: 429 });
    const m = mockGitHub({ '/repos/o/r': exhausted, '/repos/o/s': repoMeta() });
    await m.client().json('/repos/o/r').catch(() => undefined);
    await expect(m.client({ token: TOKEN }).json('/repos/o/s')).resolves.toBeTruthy();
    await expect(m.client().json('/repos/o/s')).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('bounds concurrent GitHub requests', async () => {
    let active = 0, peak = 0;
    const f = (async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; return new Response('{}'); }) as typeof fetch;
    const c = new GitHubClient({ fetchImpl: f, cache: null, maxConcurrency: 2, maxRequests: 20 });
    await Promise.all(Array.from({ length: 10 }, (_, i) => c.json(`/repos/o/r${i}`)));
    expect(peak).toBe(2);
  });

  it('never caches bodies that are marked private', async () => {
    const store = new Map<string, string>();
    const cache = { match: async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined), put: async (r: Request, res: Response) => { store.set(r.url, await res.text()); } };
    const m = mockGitHub({ '/repos/o/priv': repoMeta({ private: true }), '/repos/o/pub': repoMeta() });
    const c = m.client({ cache, token: TOKEN });
    await c.json('/repos/o/priv'); await c.json('/repos/o/pub');
    expect([...store.keys()].map(k => new URL(k).pathname)).toEqual(['/repos/o/pub']);
    expect([...store.values()].join()).not.toContain(TOKEN);
  });

  it('wires the GITHUB_TOKEN secret through the Worker and never returns it', async () => {
    const seen: (string | null)[] = [];
    const gh = mockGitHub({ '/repos/o/r': repoMeta(), '/repos/o/r/*': [] });
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => { seen.push(new Headers(init?.headers).get('authorization')); return gh.fetchImpl(input, init); }) as typeof fetch);
    const res = await handle(new Request('https://w.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'assess_release_readiness', arguments: { owner: 'o', repo: 'r' } } }) }), { GITHUB_TOKEN: TOKEN });
    const text = await res.text();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(h => h === `Bearer ${TOKEN}`)).toBe(true);
    expect(text).not.toContain(TOKEN);
    for (const [, v] of res.headers) expect(v).not.toContain(TOKEN);
  });

  it('keeps private repositories out of results even when authenticated', async () => {
    const gh = mockGitHub({ '/repos/o/priv': repoMeta({ private: true }) });
    vi.stubGlobal('fetch', gh.fetchImpl);
    const res = await handle(new Request('https://w.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_project_next_actions', arguments: { owner: 'o', repo: 'priv' } } }) }), { GITHUB_TOKEN: TOKEN });
    const body = JSON.parse(await res.text());
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/not public/);
    expect(gh.calls).toHaveLength(1); // nothing but the metadata check was fetched
  });
});
