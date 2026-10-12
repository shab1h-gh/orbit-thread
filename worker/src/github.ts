/**
 * Read-only GitHub client.
 *  - GET only; no caller-supplied URLs. Hosts are fixed: api.github.com and raw.githubusercontent.com.
 *  - Paths are built from validated owner/repo and numeric ids only.
 *  - Responses are size-bounded; every request has a timeout; responses are cached briefly.
 *  - No credentials are sent. Unauthenticated GitHub limits apply and are surfaced clearly.
 */
import type { RepoRef } from './validate.js';

export class GitHubError extends Error {
  constructor(public kind: 'not_found' | 'rate_limited' | 'forbidden' | 'upstream' | 'too_large' | 'budget', message: string, public retryAfterSec?: number) {
    super(message);
  }
}

export interface ClientOptions {
  fetchImpl?: typeof fetch;
  cache?: Pick<Cache, 'match' | 'put'> | null;
  timeoutMs?: number;
  maxJsonBytes?: number;
  maxTextBytes?: number;
  maxRequests?: number;
  cacheTtlSec?: number;
}

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const ENC = encodeURIComponent;

/** Paths that may ever be fetched as file content. Fixed allowlist: nothing is derived from repository content. */
export const READABLE_PATHS = [
  'package.json', 'plugin/plugin.json', '.claude-plugin/plugin.json', 'plugin/.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'ROADMAP.md', 'docs/ROADMAP.md',
] as const;
export type ReadablePath = (typeof READABLE_PATHS)[number];

export class GitHubClient {
  private readonly f: typeof fetch;
  private readonly cache: ClientOptions['cache'];
  private readonly timeoutMs: number;
  private readonly maxJson: number;
  private readonly maxText: number;
  private readonly maxRequests: number;
  private readonly ttl: number;
  requests = 0;

  constructor(opts: ClientOptions = {}) {
    this.f = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.cache = opts.cache === undefined ? (typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null) : opts.cache;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.maxJson = opts.maxJsonBytes ?? 1_000_000;
    this.maxText = opts.maxTextBytes ?? 200_000;
    this.maxRequests = opts.maxRequests ?? 14;
    this.ttl = opts.cacheTtlSec ?? 300;
  }

  /** GET a JSON document from api.github.com. `path` must start with "/repos/". */
  async json<T = unknown>(path: string): Promise<T> {
    if (!path.startsWith('/repos/')) throw new GitHubError('upstream', 'Internal: unexpected API path.');
    const text = await this.get(`${API}${path}`, 'application/vnd.github+json', this.maxJson);
    try { return JSON.parse(text) as T; } catch { throw new GitHubError('upstream', 'GitHub returned a response that was not valid JSON.'); }
  }

  /** Like json() but a 404 yields null. */
  async jsonOrNull<T = unknown>(path: string): Promise<T | null> {
    try { return await this.json<T>(path); } catch (e) { if (e instanceof GitHubError && e.kind === 'not_found') return null; throw e; }
  }

  /** Fetch one allowlisted tracked file at a pinned commit from raw.githubusercontent.com. Null if absent. */
  async file({ owner, repo }: RepoRef, ref: string, path: ReadablePath): Promise<string | null> {
    if (!READABLE_PATHS.includes(path)) throw new GitHubError('upstream', 'Internal: path not allowlisted.');
    if (!/^[0-9a-f]{40}$/.test(ref)) throw new GitHubError('upstream', 'Internal: ref must be a full commit SHA.');
    try {
      return await this.get(`${RAW}/${ENC(owner)}/${ENC(repo)}/${ref}/${path.split('/').map(ENC).join('/')}`, 'text/plain', this.maxText, true);
    } catch (e) { if (e instanceof GitHubError && e.kind === 'not_found') return null; throw e; }
  }

  private async get(url: string, accept: string, maxBytes: number, truncate = false): Promise<string> {
    const cached = await this.cache?.match(new Request(url)).catch(() => undefined);
    if (cached) return cached.text();
    if (this.requests >= this.maxRequests) throw new GitHubError('budget', 'Per-call GitHub request budget exceeded.');
    this.requests++;
    let res: Response;
    try {
      res = await this.f(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept, 'user-agent': 'orbit-thread-mcp (+https://github.com/shab1h-gh/orbit-thread)', 'x-github-api-version': '2022-11-28' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new GitHubError('upstream', timeout ? 'GitHub did not respond in time.' : 'Could not reach GitHub.');
    }
    if (res.status >= 300 && res.status < 400) { await res.body?.cancel(); throw new GitHubError('upstream', 'GitHub returned an unexpected redirect (the repository may have been renamed or transferred; use its current name).'); }
    if (res.status === 404) { await res.body?.cancel(); throw new GitHubError('not_found', 'Not found (the resource does not exist or is not public).'); }
    if (res.status === 403 || res.status === 429) {
      await res.body?.cancel();
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const retryHeader = Number(res.headers.get('retry-after'));
      if (res.status === 429 || remaining === '0' || Number.isFinite(retryHeader) && retryHeader > 0) {
        const wait = retryHeader > 0 ? retryHeader : Number.isFinite(reset) && reset > 0 ? Math.max(1, reset - Math.floor(Date.now() / 1000)) : undefined;
        throw new GitHubError('rate_limited', `GitHub's unauthenticated rate limit is exhausted${wait ? `; retry in about ${Math.ceil(wait / 60)} minute(s)` : ''}.`, wait);
      }
      throw new GitHubError('forbidden', 'GitHub refused the request (the resource may be private or restricted).');
    }
    if (res.status === 451) { await res.body?.cancel(); throw new GitHubError('forbidden', 'Repository is unavailable for legal reasons.'); }
    if (!res.ok) { await res.body?.cancel(); throw new GitHubError('upstream', `GitHub returned HTTP ${res.status}.`); }
    const body = await readBounded(res, maxBytes, truncate);
    // Cache only successful bodies, briefly.
    if (this.cache) {
      const put = new Response(body, { headers: { 'cache-control': `public, max-age=${this.ttl}` } });
      await this.cache.put(new Request(url), put).catch(() => undefined);
    }
    return body;
  }
}

async function readBounded(res: Response, max: number, truncate: boolean): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      if (truncate) { chunks.push(value.subarray(0, value.byteLength - (total - max))); break; }
      throw new GitHubError('too_large', 'GitHub response exceeded the size limit.');
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(buf);
}

export const urls = {
  repo: ({ owner, repo }: RepoRef) => `https://github.com/${ENC(owner)}/${ENC(repo)}`,
  pull: (r: RepoRef, n: number) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/pull/${n}`,
  issue: (r: RepoRef, n: number) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/issues/${n}`,
  commit: (r: RepoRef, sha: string) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/commit/${sha}`,
  run: (r: RepoRef, id: number) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/actions/runs/${id}`,
  job: (r: RepoRef, run: number, job: number) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/actions/runs/${run}/job/${job}`,
  file: (r: RepoRef, ref: string, path: string) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/blob/${ref}/${path}`,
  tag: (r: RepoRef, tag: string) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/releases/tag/${ENC(tag)}`,
  releases: (r: RepoRef) => `https://github.com/${ENC(r.owner)}/${ENC(r.repo)}/releases`,
};
