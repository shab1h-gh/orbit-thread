import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tarballs = fs.readdirSync(root).filter(name => /^orbit-thread-\d+\.\d+\.\d+\.tgz$/.test(name));
assert.equal(tarballs.length, 1, `Expected one Orbit Thread tarball, found ${tarballs.length}`);

const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'orbit-thread-pack-'));
try {
  const prefix = path.join(temp, 'prefix');
  const project = path.join(temp, 'project');
  fs.mkdirSync(project);
  const git = spawnSync('git', ['init', '-q'], { cwd: project, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);

  const install = spawnSync('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    '--prefix', prefix, path.join(root, tarballs[0]),
  ], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr + install.stdout);

  const cli = path.join(prefix, 'node_modules/orbit-thread/bin/orbit-thread.mjs');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' });
  const ok = result => assert.equal(result.status, 0, result.stderr + result.stdout);

  ok(run('--version'));
  ok(run('install', '--agent', 'both', '--scope', 'project', '--yes'));
  ok(run('setup', '--agent', 'both', '--yes'));
  ok(run('configure', '--agent', 'claude', '--model', 'Fixture Claude', '--effort', 'low'));
  ok(run('configure', '--agent', 'codex', '--model', 'Fixture Codex', '--reasoning', 'high'));
  ok(run('doctor', '--agent', 'both', '--scope', 'project'));
  ok(run('resume'));
  ok(run('update', '--agent', 'both', '--scope', 'project', '--yes'));

  for (const agentDir of ['.agents', '.claude']) {
    for (const skill of ['handoff', 'orbit-setup', 'orbit-resume']) {
      const skillDir = path.join(project, agentDir, 'skills', skill);
      assert.equal(fs.existsSync(path.join(skillDir, 'SKILL.md')), true);
      assert.equal(fs.existsSync(path.join(skillDir, '.orbit-thread.json')), true);
      assert.equal(fs.existsSync(path.join(skillDir, '.orbit-handoff.json')), false);
    }
  }
  for (const doc of ['PRODUCT.md', 'DESIGN.md', 'ARCHITECTURE.md', 'SECURITY.md', 'ROADMAP.md']) {
    assert.equal(fs.existsSync(path.join(project, 'docs', doc)), true);
  }
  assert.equal(fs.existsSync(path.join(project, '.orbit-thread/config.json')), true);
  assert.equal(fs.existsSync(path.join(project, 'HANDOFF-STATE.md')), false);
  const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Fixture Claude/);
  assert.match(agents, /Fixture Codex/);

  ok(run('uninstall', '--agent', 'both', '--scope', 'project', '--yes'));
  assert.equal(fs.existsSync(path.join(project, 'docs', 'ARCHITECTURE.md')), true);
  assert.equal(fs.existsSync(path.join(project, '.orbit-thread/config.json')), true);

  console.log('Packed Orbit Thread smoke test passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
