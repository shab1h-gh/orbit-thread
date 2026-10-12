import { describe, expect, it } from 'vitest';
import { GitHubClient, GitHubError, resetGitHubState } from '../src/github.js';
import { mockGitHub, SHA } from './helpers.js';

describe('GitHub client', () => {
  it('only issues GET requests to fixed hosts, with no credentials', async () => {
    const m = mockGitHub({ '/repos/o/r': { ok: 1 }, [`raw:/o/r/${SHA}/package.json`]: '{"version":"1.0.0"}' });
    const c = m.client();
    await c.json('/repos/o/r');
    await c.file({ owner: 'o', repo: 'r' }, SHA, 'package.json');
    expect(m.calls.map(x => new URL(x.url).host)).toEqual(['api.github.com', 'raw.githubusercontent.com']);
    for (const call of m.calls) {
      expect(call.method).toBe('GET');
      expect(call.headers.get('authorization')).toBeNull();
      expect(call.headers.get('cookie')).toBeNull();
    }
  });
  it('refuses paths outside /repos/, non-allowlisted files and non-SHA refs', async () => {
    const c = mockGitHub({}).client();
    await expect(c.json('/user')).rejects.toBeInstanceOf(GitHubError);
    await expect(c.json('https://evil.test/repos/x')).rejects.toBeInstanceOf(GitHubError);
    await expect(c.file({ owner: 'o', repo: 'r' }, SHA, 'HANDOFF-STATE.md' as never)).rejects.toBeInstanceOf(GitHubError);
    await expect(c.file({ owner: 'o', repo: 'r' }, SHA, '../.env' as never)).rejects.toBeInstanceOf(GitHubError);
    await expect(c.file({ owner: 'o', repo: 'r' }, 'main', 'package.json')).rejects.toBeInstanceOf(GitHubError);
  });
  it('maps 404, rate limits and server errors', async () => {
    const rl = () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) } });
    const m = mockGitHub({ '/repos/o/rl': rl, '/repos/o/five': () => new Response('x', { status: 502 }), '/repos/o/priv': () => new Response('{}', { status: 403 }), '/repos/o/many': () => new Response('{}', { status: 429 }) });
    const c = m.client();
    await expect(c.json('/repos/o/missing')).rejects.toMatchObject({ kind: 'not_found' });
    await expect(c.jsonOrNull('/repos/o/missing')).resolves.toBeNull();
    await expect(c.json('/repos/o/rl')).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(c.json('/repos/o/many')).rejects.toMatchObject({ kind: 'rate_limited' });
    resetGitHubState(); // a known-exhausted quota intentionally fails fast
    await expect(c.json('/repos/o/priv')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(c.json('/repos/o/five')).rejects.toMatchObject({ kind: 'upstream' });
  });
  it('never follows redirects', async () => {
    const m = mockGitHub({ '/repos/o/moved': () => new Response(null, { status: 301, headers: { location: 'https://evil.test/' } }) });
    await expect(m.client().json('/repos/o/moved')).rejects.toMatchObject({ kind: 'upstream', message: expect.stringMatching(/redirect/) });
    expect(m.calls).toHaveLength(1);
    expect((await m.fetchImpl('https://api.github.com/repos/o/moved', { redirect: 'manual' })).status).toBe(301);
  });
  it('bounds response sizes and request counts', async () => {
    const m = mockGitHub({ '/repos/o/big': 'x'.repeat(5000), [`raw:/o/r/${SHA}/CHANGELOG.md`]: 'y'.repeat(5000) });
    const c = m.client({ maxJsonBytes: 1000, maxTextBytes: 1000, maxRequests: 3 });
    await expect(c.json('/repos/o/big')).rejects.toMatchObject({ kind: 'too_large' });
    expect((await c.file({ owner: 'o', repo: 'r' }, SHA, 'CHANGELOG.md'))!.length).toBe(1000);
    await c.jsonOrNull('/repos/o/a');
    await expect(c.json('/repos/o/b')).rejects.toMatchObject({ kind: 'budget' });
  });
  it('turns network failures and timeouts into clean errors', async () => {
    const c = new GitHubClient({ cache: null, fetchImpl: (async () => { throw new Error('secret internal detail'); }) as typeof fetch });
    await expect(c.json('/repos/o/r')).rejects.toThrow('Could not reach GitHub.');
  });
  it('uses the cache for repeated reads', async () => {
    const store = new Map<string, string>();
    const cache = { match: async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined), put: async (r: Request, res: Response) => { store.set(r.url, await res.text()); } };
    const m = mockGitHub({ '/repos/o/r': { a: 1 } });
    const c = m.client({ cache });
    await c.json('/repos/o/r'); await c.json('/repos/o/r');
    expect(m.calls).toHaveLength(1);
  });
});
