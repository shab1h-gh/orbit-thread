// End-to-end acceptance check of a deployed Orbit Next endpoint using the official MCP client.
//
// Usage: node scripts/e2e.mjs https://<host>/mcp [--repo owner/repo] [--ci-repo owner/repo[,owner/repo...]] [--run-id N]
//
// Two independent phases with different guarantees:
//   A. PROTOCOL + SECURITY  (needs no GitHub quota; always conclusive)
//   B. FUNCTIONAL           (needs live GitHub data; each tool must return a real, structured, non-error result)
//
// Exit codes: 0 = everything passed.  1 = a check failed.  2 = INCONCLUSIVE: phase A passed but phase B could not
// obtain meaningful results (GitHub rate limit, or no failed CI run found). INCONCLUSIVE is never reported as success.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const argv = process.argv.slice(2);
const endpoint = argv.find(a => a.startsWith('https://') || a.startsWith('http://localhost') || a.startsWith('http://127.0.0.1'));
const opt = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
assert.ok(endpoint?.endsWith('/mcp'), 'Usage: node scripts/e2e.mjs https://<host>/mcp [--repo owner/repo] [--ci-repo owner/repo,...] [--run-id N]');
const [owner, repo] = (opt('repo') ?? 'shab1h-gh/orbit-thread').split('/');
const ciCandidates = (opt('ci-repo') ?? `${owner}/${repo},cli/cli,vercel/next.js`).split(',').map(s => s.split('/'));
const explicitRun = opt('run-id') ? Number(opt('run-id')) : undefined;

// The endpoint enforces a per-IP limit (30 requests/minute). Pace ourselves under it so the run measures the
// server's behaviour, not our own limiter. Use --no-pace only against a local server with no limiter.
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 24, stamps = [];
async function pfetch(input, init) {
  if (!argv.includes('--no-pace')) {
    for (;;) {
      const now = Date.now();
      while (stamps.length && now - stamps[0] > WINDOW_MS) stamps.shift();
      if (stamps.length < MAX_PER_WINDOW) break;
      await new Promise(r => setTimeout(r, WINDOW_MS - (now - stamps[0]) + 50));
    }
    stamps.push(Date.now());
  }
  return fetch(input, init);
}

const results = []; // { phase, name, status: PASS | FAIL | INCONCLUSIVE, detail }
const record = (phase, name, status, detail = '') => { results.push({ phase, name, status, detail }); console.log(`${status.padEnd(12)} [${phase}] ${name}${detail ? ` — ${detail}` : ''}`); };
async function check(phase, name, fn) {
  try { const out = await fn(); record(phase, name, out?.inconclusive ? 'INCONCLUSIVE' : 'PASS', out?.inconclusive ?? out?.detail ?? ''); }
  catch (e) { record(phase, name, 'FAIL', String(e.message ?? e).split('\n')[0]); }
}

const client = new Client({ name: 'orbit-next-e2e', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), { fetch: pfetch }));
const leaks = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|authorization|bearer\s+\S{8,}/i;

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args }).catch(e => ({ isError: true, content: [{ type: 'text', text: String(e.message) }], thrown: true }));
  const text = res.content?.[0]?.text ?? '';
  assert.ok(!leaks.test(text), `${name} output looks like it contains a credential or auth header`);
  return { res, text, rateLimited: !!res.isError && /rate limit is exhausted|too many requests/i.test(text) };
};
const rateLimitedNote = r => ({ inconclusive: `GitHub rate limit exhausted (${r.text.slice(0, 90)})` });

// ───────────────────────── Phase A: protocol + security ─────────────────────────
await check('A', 'initialize + server identity', async () => {
  const v = client.getServerVersion();
  assert.equal(v?.name, 'orbit-next');
  return { detail: `${v.name} ${v.version}` };
});

const { tools } = await client.listTools();
await check('A', 'tools/list exposes exactly the three tools', () => {
  assert.deepEqual(tools.map(t => t.name).sort(), ['assess_release_readiness', 'diagnose_ci_failure', 'get_project_next_actions']);
});
await check('A', 'every tool is annotated read-only and non-destructive', () => {
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} readOnlyHint`);
    assert.equal(t.annotations?.destructiveHint, false, `${t.name} destructiveHint`);
    assert.equal(t.annotations?.idempotentHint, true, `${t.name} idempotentHint`);
  }
});

const invalid = [
  ['owner path traversal', 'get_project_next_actions', { owner: '../etc', repo }],
  ['owner with scheme/host', 'get_project_next_actions', { owner: 'https://evil.example', repo }],
  ['repo with slash', 'assess_release_readiness', { owner, repo: 'a/b' }],
  ['repo ending .git', 'assess_release_readiness', { owner, repo: 'x.git' }],
  ['negative run_id', 'diagnose_ci_failure', { owner, repo, run_id: -1 }],
  ['non-integer run_id', 'diagnose_ci_failure', { owner, repo, run_id: 1.5 }],
  ['missing arguments', 'get_project_next_actions', {}],
];
for (const [label, name, args] of invalid) {
  await check('A', `rejects invalid input: ${label}`, async () => {
    const r = await call(name, args);
    assert.equal(r.res.isError, true, 'should be an error result');
    assert.ok(!r.rateLimited, 'rejection must come from validation, not from GitHub');
  });
}
await check('A', 'unknown tool is rejected', async () => {
  const r = await call('delete_everything', {});
  assert.equal(r.res.isError, true);
});

const post = (headers, body = '{}') => pfetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body });
await check('A', 'foreign Origin refused (403)', async () => assert.equal((await post({ origin: 'https://evil.example' })).status, 403));
await check('A', 'allowed Origin gets CORS, no wildcard', async () => {
  const r = await post({ origin: 'https://claude.ai' }, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://claude.ai');
});
await check('A', 'CORS preflight: allowed origin 204, foreign origin 403', async () => {
  const ok = await pfetch(endpoint, { method: 'OPTIONS', headers: { origin: 'https://claude.ai', 'access-control-request-method': 'POST' } });
  assert.equal(ok.status, 204);
  assert.equal((await pfetch(endpoint, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403);
});
await check('A', 'GET is refused (405) and no session id is issued', async () => {
  assert.equal((await pfetch(endpoint)).status, 405);
  const init = await post({}, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }));
  assert.equal(init.headers.get('mcp-session-id'), null);
});
await check('A', 'wrong content-type (415), oversize body (413), malformed JSON (400)', async () => {
  assert.equal((await post({ 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post({}, 'x'.repeat(40_000))).status, 413);
  assert.equal((await post({}, '{not json')).status, 400);
});
await check('A', 'security headers present', async () => {
  const r = await pfetch(new URL('/health', endpoint));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

// ───────────────────────── Phase B: functional (live GitHub) ─────────────────────────
const statuses = new Set(['PASS', 'WARN', 'BLOCKED', 'UNKNOWN']);
const githubUrl = u => typeof u === 'string' && /^https:\/\/github\.com\/[^\s]+$/.test(u);
const parse = r => JSON.parse(r.text);
let ciRun;

await check('B', `get_project_next_actions ${owner}/${repo} returns real prioritised data`, async () => {
  const r = await call('get_project_next_actions', { owner, repo });
  if (r.rateLimited) return rateLimitedNote(r);
  assert.ok(!r.res.isError, r.text.slice(0, 200));
  const d = parse(r);
  assert.equal(d.repo, `${owner}/${repo}`);
  assert.ok(d.facts.length > 0, 'expected at least one verified fact');
  assert.ok(Array.isArray(d.unknowns) && Array.isArray(d.actions));
  for (const a of d.actions) {
    assert.ok(['verified', 'heuristic'].includes(a.basis) && a.title && a.rationale, 'action shape');
    assert.ok(a.sources.length > 0 && a.sources.every(githubUrl), 'sources must be github.com links');
  }
  return { detail: `${d.actions.length} actions, ${d.facts.length} facts, ${d.unknowns.length} unknowns` };
});

await check('B', `assess_release_readiness ${owner}/${repo} returns evidence-backed checks`, async () => {
  const r = await call('assess_release_readiness', { owner, repo });
  if (r.rateLimited) return rateLimitedNote(r);
  assert.ok(!r.res.isError, r.text.slice(0, 200));
  const d = parse(r);
  assert.ok(statuses.has(d.technicalReadiness));
  assert.ok(d.checks.length >= 3, 'expected several checks');
  for (const c of d.checks) { assert.ok(statuses.has(c.status) && c.summary, 'check shape'); assert.ok(c.sources.every(githubUrl), 'check sources'); }
  assert.ok(d.checks.some(c => c.status !== 'UNKNOWN'), 'every check is UNKNOWN: no real evidence was obtained');
  assert.equal(d.humanApproval.status, 'UNKNOWN', 'human approval must never be asserted');
  assert.equal(d.publication.status, 'NOT_PERFORMED');
  return { detail: `${d.technicalReadiness}: ${d.checks.map(c => `${c.id}=${c.status}`).join(' ')}` };
});

await check('B', 'diagnose_ci_failure finds a genuine failed run and reports observed failures only', async () => {
  const tried = [];
  for (const [o, r0] of explicitRun ? [[owner, repo]] : ciCandidates) {
    const r = await call('diagnose_ci_failure', { owner: o, repo: r0, ...(explicitRun ? { run_id: explicitRun } : {}) });
    if (r.rateLimited) return rateLimitedNote(r);
    assert.ok(!r.res.isError, r.text.slice(0, 200));
    const d = parse(r);
    tried.push(`${o}/${r0}:${d.outcome}`);
    if (d.outcome !== 'failure_observed') { assert.ok(d.summary && Array.isArray(d.failures)); continue; }
    assert.match(d.rootCause, /^not determined/, 'must not claim a verified root cause');
    assert.ok(d.run.id > 0 && githubUrl(d.run.url));
    assert.ok(d.failures.length > 0 || d.unknowns.some(u => /no failed job/i.test(u)), 'failure without jobs must be explained as unknown');
    for (const f of d.failures) { assert.ok(githubUrl(f.url) && f.job); }
    assert.ok(d.unknowns.some(u => /logs/i.test(u)), 'must state that logs were not read');
    assert.ok(d.investigate.every(i => i.basis === 'heuristic'), 'investigation hints must be labelled heuristic');
    ciRun = { owner: o, repo: r0, id: d.run.id };
    return { detail: `${o}/${r0} run ${d.run.id}: ${d.failures.length} failed job(s), ${d.investigate.length} heuristic hint(s)` };
  }
  return { inconclusive: `no failed run found to diagnose (${tried.join(', ')}); pass --run-id or --ci-repo` };
});

await check('B', 'diagnose_ci_failure by explicit run_id returns the same run', async () => {
  if (!ciRun) return { inconclusive: 'no failed run available' };
  const r = await call('diagnose_ci_failure', { owner: ciRun.owner, repo: ciRun.repo, run_id: ciRun.id });
  if (r.rateLimited) return rateLimitedNote(r);
  assert.ok(!r.res.isError, r.text.slice(0, 200));
  const d = parse(r);
  assert.equal(d.run.id, ciRun.id);
  assert.equal(d.selected, 'requested');
});

await check('B', 'missing repository is a clear "not found or not public" error', async () => {
  const r = await call('get_project_next_actions', { owner, repo: 'this-repo-does-not-exist-orbit-next' });
  if (r.rateLimited) return rateLimitedNote(r);
  assert.equal(r.res.isError, true);
  assert.match(r.text, /not found or not public/i);
});
await check('B', 'unknown run_id is a clear error', async () => {
  const r = await call('diagnose_ci_failure', { owner, repo, run_id: 999999999999 });
  if (r.rateLimited) return rateLimitedNote(r);
  assert.equal(r.res.isError, true);
  assert.match(r.text, /not found/i);
});

await client.close();

// ───────────────────────── Summary ─────────────────────────
const count = s => results.filter(r => r.status === s).length;
const failed = count('FAIL'), inconclusive = count('INCONCLUSIVE');
console.log(`\nSummary: ${count('PASS')} passed, ${failed} failed, ${inconclusive} inconclusive`);
if (failed) { console.log('E2E FAILED'); process.exit(1); }
if (inconclusive) {
  console.log('E2E INCONCLUSIVE: protocol/security checks passed, but live GitHub results were not obtained for every tool. This is NOT an acceptance pass; re-run when GitHub quota allows (or configure the optional GITHUB_TOKEN secret).');
  process.exit(2);
}
console.log('E2E PASSED');
