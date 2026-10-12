import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const pkg = readJson('package.json');
const portable = readJson('plugin/plugin.json');
const claude = readJson('plugin/.claude-plugin/plugin.json');
const marketplace = readJson('.claude-plugin/marketplace.json');

assert.equal(pkg.name, 'orbit-thread');
assert.equal(portable.name, pkg.name);
assert.equal(portable.version, pkg.version);
assert.equal(claude.name, pkg.name);
assert.equal(claude.version, pkg.version);
assert.equal(marketplace.name, pkg.name);
assert.equal(marketplace.plugins[0].name, pkg.name);
assert.equal(marketplace.plugins[0].version, pkg.version);
assert.equal(claude.skills, './skills/');
assert.equal(pkg.scripts?.postinstall, undefined);
assert.equal(pkg.dependencies, undefined);
assert.equal(portable.extensions['com.openai'].onboardingSkill, './skills/orbit-setup/SKILL.md');

for (const skill of ['handoff', 'orbit-setup', 'orbit-resume']) {
  const dir = path.join(root, 'plugin/skills', skill);
  const markdown = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  assert.match(markdown, new RegExp(`^---\\nname: ${skill}\\ndescription: .+\\n---`, 's'));
  assert.doesNotMatch(markdown, /disable-model-invocation:/);
  const metadata = fs.readFileSync(path.join(dir, 'agents/openai.yaml'), 'utf8');
  assert.match(metadata, /allow_implicit_invocation: true/);
}

assert.equal(fs.existsSync(path.join(root, 'plugin/skills/handoff/scripts/write_handoff.sh')), true);
assert.equal(fs.existsSync(path.join(root, 'plugin/skills/orbit-setup/scripts/setup_project.mjs')), true);
assert.equal(fs.existsSync(path.join(root, 'plugin/skills/orbit-setup/scripts/project_config.mjs')), true);
assert.equal(fs.existsSync(path.join(root, 'plugin/skills/orbit-resume/agents/openai.yaml')), true);
assert.equal(fs.existsSync(path.join(root, 'bin/orbit-thread.mjs')), true);

const listing = portable.extensions['com.openai'].interface;
for (const [key, limit] of Object.entries({ displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 })) {
  assert.ok(typeof listing[key] === 'string' && listing[key].length > 0 && listing[key].length <= limit, key);
}

assert.ok(Array.isArray(listing.defaultPrompt) && listing.defaultPrompt.length >= 1 && listing.defaultPrompt.length <= 3, 'defaultPrompt count');
for (const prompt of listing.defaultPrompt) assert.ok(prompt.length > 0 && prompt.length <= 128, `defaultPrompt over 128 characters: ${prompt}`);
assert.equal(listing.termsOfServiceURL, 'https://github.com/shab1h-gh/orbit-thread/blob/main/TERMS.md');
assert.equal(fs.existsSync(path.join(root, 'TERMS.md')), true);
assert.ok(portable.extensions['com.openai'].publication.release_notes.includes(pkg.version), 'release notes mention current version');

// Orbit Next (remote MCP) integration: plugin config, tool contract and dependency isolation.
const mcp = readJson('plugin/.mcp.json');
const server = mcp.mcpServers?.['orbit-next'];
assert.ok(server, 'plugin/.mcp.json must define orbit-next');
assert.equal(server.type, 'http');
assert.match(server.url, /^\$\{ORBIT_NEXT_URL:-https:\/\/[a-z0-9.-]+\/mcp\}$/, 'MCP url must be https and end in /mcp');
assert.equal(Object.keys(mcp.mcpServers).length, 1);
assert.equal(JSON.stringify(mcp).match(/authorization|bearer|token|secret|key/i), null, 'MCP config must not carry credentials');
assert.equal(claude.mcpServers, './.mcp.json');
assert.equal(portable.mcpServers, './.mcp.json');
const workerPkg = readJson('worker/package.json');
assert.equal(workerPkg.version, pkg.version, 'worker version matches package version');
assert.equal(workerPkg.scripts?.postinstall, undefined);
assert.equal(pkg.files.some(f => f.startsWith('worker')), false, 'worker/ must not ship in the npm package');
const toolSource = fs.readFileSync(path.join(root, 'worker/src/tools.ts'), 'utf8');
const toolNames = [...toolSource.matchAll(/registerTool\('([a-z_]+)'/g)].map(m => m[1]).sort();
assert.deepEqual(toolNames, ['assess_release_readiness', 'diagnose_ci_failure', 'get_project_next_actions']);
assert.match(toolSource, new RegExp(`version: '${pkg.version.replace(/\./g, '\\.')}'`), 'MCP server version matches package version');
for (const name of toolNames) assert.ok(toolSource.includes(`readOnlyHint`), `${name} read-only annotation`);
assert.ok(portable.extensions['com.openai'].interface.longDescription.includes('Orbit Next'), 'listing describes Orbit Next');

console.log('Orbit Thread skills, onboarding metadata, config, implicit invocation and Orbit Next MCP wiring validated.');
