import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { GitHubClient } from './github.js';
import { createServer, SERVER_INFO } from './tools.js';

export interface Env {
  ALLOWED_ORIGINS?: string;
  /** Optional Cloudflare secret: read-only GitHub token limited to public repositories. Never logged or returned. */
  GITHUB_TOKEN?: string;
  LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

const MAX_BODY = 16 * 1024;
const DEFAULT_ORIGINS = ['https://claude.ai', 'https://chatgpt.com'];
const SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'" };

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...SECURITY_HEADERS, ...extra } });
const rpcError = (status: number, code: number, message: string, extra: Record<string, string> = {}) =>
  json(status, { jsonrpc: '2.0', error: { code, message }, id: null }, extra);

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(',')).split(',').map(s => s.trim()).filter(Boolean);
}

export async function handle(request: Request, env: Env, deps: { client?: () => GitHubClient } = {}): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return request.method === 'GET' || request.method === 'HEAD' ? json(200, { ok: true, service: 'orbit-thread-mcp', version: SERVER_INFO.version }) : json(405, { error: 'method_not_allowed' }, { allow: 'GET, HEAD' });
  }
  if (url.pathname === '/') {
    return json(200, { service: 'orbit-thread-mcp', description: 'Orbit Next: read-only MCP server for public GitHub repositories.', mcp: '/mcp', transport: 'streamable-http (stateless, POST only)', docs: 'https://github.com/shab1h-gh/orbit-thread#orbit-next' });
  }
  if (url.pathname !== '/mcp') return json(404, { error: 'not_found' });

  // DNS-rebinding / cross-site protection: browsers send Origin; anything not allowlisted is refused.
  const origin = request.headers.get('origin');
  const origins = allowedOrigins(env);
  if (origin !== null && !origins.includes(origin)) return rpcError(403, -32000, 'Origin not allowed.');
  const cors: Record<string, string> = origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id', 'access-control-max-age': '600' } });
  }
  // Stateless server: no server-initiated streams and no sessions to terminate.
  if (request.method !== 'POST') return rpcError(405, -32000, 'Method not allowed. This stateless MCP endpoint accepts POST only.', { allow: 'POST, OPTIONS', ...cors });

  const ctype = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(ctype)) return rpcError(415, -32000, 'Content-Type must be application/json.', cors);
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) return rpcError(413, -32000, 'Request body too large.', cors);

  if (env.LIMITER) {
    const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
    try { if (!(await env.LIMITER.limit({ key })).success) return rpcError(429, -32000, 'Too many requests. Slow down and retry shortly.', { 'retry-after': '30', ...cors }); } catch { /* limiter unavailable: fail open, upstream limits still apply */ }
  }

  const server = createServer(deps.client ?? (() => new GitHubClient({ token: env.GITHUB_TOKEN })));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MAX_BODY });
  try {
    await server.connect(transport);
    const res = await transport.handleRequest(request);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...cors })) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return rpcError(500, -32603, 'Internal error.', cors);
  } finally {
    // Stateless: nothing is retained between requests.
    void server.close().catch(() => undefined);
  }
}

export default { fetch: (request: Request, env: Env) => handle(request, env) } satisfies ExportedHandler<Env>;
