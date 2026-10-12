import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));

test('Claude-compatible MCP config stays separate, credential-free and non-empty', () => {
  const cfg = json('plugin/.mcp.json');
  assert.deepEqual(Object.keys(cfg), ['mcpServers']);
  assert.deepEqual(Object.keys(cfg.mcpServers), ['orbit-next']);
  const s = cfg.mcpServers['orbit-next'];
  assert.equal(s.type, 'http');
  assert.match(s.url, /^\$\{ORBIT_NEXT_URL:-https:\/\/[^\s"]+\/mcp\}$/);
  assert.deepEqual(Object.keys(s).sort(), ['type', 'url']);
});

test('portable plugin/mcp.json follows Agent Plugins 1.0', () => {
  const cfg = json('plugin/mcp.json');
  assert.deepEqual(Object.keys(cfg).sort(), ['$schema', 'mcpServers']);
  assert.equal(cfg.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(Object.keys(cfg.mcpServers), ['orbit-next']);
  const s = cfg.mcpServers['orbit-next'];
  assert.deepEqual(Object.keys(s).sort(), ['type', 'url']);
  assert.equal(s.type, 'streamable-http');
  const url = new URL(s.url);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.username + url.password + url.hash, '', 'no userinfo or fragment');
  assert.ok(url.pathname.endsWith('/mcp'));
  assert.doesNotMatch(s.url, /\$\{|\$[A-Z_]|%24/, 'remote URLs are never expanded in portable config');
  assert.doesNotMatch(url.hostname, /\.workers\.dev$/, 'no account-derived hostname');
});

test('portable manifest declares no mcpServers; only the Claude manifest does', () => {
  const portable = json('plugin/plugin.json');
  assert.equal('mcpServers' in portable, false);
  assert.equal(JSON.stringify(portable).includes('.mcp.json'), false);
  const claude = json('plugin/.claude-plugin/plugin.json');
  assert.equal(claude.mcpServers, './.mcp.json');
  assert.equal(claude.skills, './skills/');
  for (const s of ['handoff', 'orbit-setup', 'orbit-resume']) assert.ok(fs.existsSync(path.join(root, 'plugin/skills', s, 'SKILL.md')));
});

test('npm test script is Node 20 compatible (unquoted glob expanded by the shell)', () => {
  const script = json('package.json').scripts.test;
  assert.doesNotMatch(script, /["']/, 'quoted globs are passed literally by Node 20');
  const files = spawnSync('sh', ['-c', `ls ${script.replace(/^node --test /, '')}`], { cwd: root, encoding: 'utf8' });
  assert.equal(files.status, 0, files.stderr);
  assert.ok(files.stdout.split('\n').filter(Boolean).length >= 5, 'glob expands to every test file');
});

test('the dependency-free CLI stays isolated from the MCP worker', () => {
  const pkg = json('package.json');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.ok(!pkg.files.some(f => f.startsWith('worker')));
  const w = json('worker/package.json');
  assert.equal(w.private, true);
  assert.ok(w.dependencies['@modelcontextprotocol/sdk']);
  assert.equal(w.scripts.postinstall, undefined);
  for (const v of Object.values({ ...w.dependencies, ...w.devDependencies })) assert.match(v, /^\d/, 'worker dependencies are pinned exactly');
});

test('worker source is read-only by construction', () => {
  const dir = path.join(root, 'worker/src');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i, `${f} must not issue mutating requests`);
    assert.doesNotMatch(src, /\bauthorization\b/i, `${f} must not send credentials`);
    assert.doesNotMatch(src, /\beval\(|new Function\(|child_process/, `${f} must not execute retrieved content`);
    assert.doesNotMatch(src, /HANDOFF-STATE/, `${f} must not reference the local handoff file`);
  }
});

test('npm pack contents exclude the worker and include both MCP configs', () => {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const parsed = JSON.parse(r.stdout);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed['orbit-thread'];
  const files = entry.files.map(f => f.path);
  assert.ok(files.includes('plugin/.mcp.json'));
  assert.ok(files.includes('plugin/mcp.json'));
  assert.ok(!files.some(f => f.startsWith('worker/') || f.includes('node_modules')));
  assert.ok(files.includes('bin/orbit-thread.mjs'));
});
