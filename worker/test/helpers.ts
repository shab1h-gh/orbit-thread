import { GitHubClient } from '../src/github.js';

export const SHA = 'a'.repeat(40);
export const OLD = 'b'.repeat(40);
export const NOW = Date.parse('2026-10-12T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
export { day };

export type Routes = Record<string, unknown | ((url: URL) => Response | unknown)>;

/** Mock fetch for api.github.com and raw.githubusercontent.com. Records every request. */
export function mockGitHub(routes: Routes) {
  const calls: { url: string; method: string; headers: Headers }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    calls.push({ url: u.href, method: init?.method ?? 'GET', headers: new Headers(init?.headers) });
    const key = u.host === 'api.github.com' ? u.pathname + u.search : `raw:${u.pathname}`;
    const hit = Object.entries(routes).find(([k]) => key === k) ?? Object.entries(routes).find(([k]) => k.endsWith('*') && key.startsWith(k.slice(0, -1)));
    if (!hit) return new Response('{"message":"Not Found"}', { status: 404 });
    const v = typeof hit[1] === 'function' ? (hit[1] as (u: URL) => unknown)(u) : hit[1];
    if (v instanceof Response) return v;
    return new Response(typeof v === 'string' ? v : JSON.stringify(v), { status: 200 });
  }) as typeof fetch;
  const client = (opts = {}) => new GitHubClient({ fetchImpl, cache: null, ...opts });
  return { calls, fetchImpl, client };
}

export const repoMeta = (extra = {}) => ({ private: false, archived: false, default_branch: 'main', ...extra });
