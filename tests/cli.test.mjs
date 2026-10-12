import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/orbit-handoff.mjs', import.meta.url));
const source = fileURLToPath(new URL('../plugin/skills/handoff/', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'orbit installer '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: root });
  return root;
}
function run(root, ...args) { return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }); }
function ok(result) { assert.equal(result.status, 0, result.stderr + result.stdout); }
const read = (root, name) => fs.readFileSync(path.join(root, name), 'utf8');
const location = (root, agent) => path.join(root, agent === 'codex' ? '.agents' : '.claude', 'skills/handoff');
const resumeLocation = (root, agent) => path.join(root, agent === 'codex' ? '.agents' : '.claude', 'skills/orbit-resume');
function assertSkill(dir) {
  for (const name of ['SKILL.md', 'agents/openai.yaml', 'scripts/write_handoff.sh']) assert.deepEqual(fs.readFileSync(path.join(dir, name)), fs.readFileSync(path.join(source, name)));
}

for (const agent of ['codex', 'claude', 'both']) {
  test(`${agent} project install, reinstall, check, update and uninstall`, t => {
    const root = fixture(t);
    const selected = agent === 'both' ? ['codex', 'claude'] : [agent];
    ok(run(root, 'install', '--agent', agent, '--yes'));
    selected.forEach(a => assertSkill(location(root, a)));
    selected.forEach(a => assert.equal(fs.existsSync(path.join(resumeLocation(root, a), 'SKILL.md')), true));
    ok(run(root, 'install', '--agent', agent, '--yes'));
    ok(run(root, 'check', '--agent', agent));
    selected.forEach(a => fs.writeFileSync(path.join(location(root, a), 'personal-note.md'), 'keep me'));
    selected.forEach(a => fs.mkdirSync(path.join(location(root, a), 'personal-empty-folder')));
    ok(run(root, 'update', '--agent', agent, '--yes'));
    selected.forEach(a => assertSkill(location(root, a)));
    selected.forEach(a => assert.equal(fs.existsSync(path.join(resumeLocation(root, a), 'SKILL.md')), true));
    ok(run(root, 'uninstall', '--agent', agent, '--yes'));
    selected.forEach(a => {
      assert.equal(read(location(root, a), 'personal-note.md'), 'keep me');
      assert.equal(fs.existsSync(path.join(location(root, a), 'personal-empty-folder')), true);
      assert.equal(fs.existsSync(path.join(location(root, a), 'SKILL.md')), false);
      assert.equal(fs.existsSync(path.join(location(root, a), '.orbit-thread.json')), false);
    });
    ok(run(root, 'uninstall', '--agent', agent, '--yes'));
  });
}

test('Codex and Claude copies including ownership metadata are byte-identical', t => {
  const root = fixture(t);
  ok(run(root, 'install', '--yes'));
  for (const name of ['SKILL.md', 'agents/openai.yaml', 'scripts/write_handoff.sh', '.orbit-thread.json']) assert.deepEqual(fs.readFileSync(path.join(location(root, 'codex'), name)), fs.readFileSync(path.join(location(root, 'claude'), name)));
  for (const name of ['SKILL.md', 'agents/openai.yaml', '.orbit-thread.json']) assert.deepEqual(fs.readFileSync(path.join(resumeLocation(root, 'codex'), name)), fs.readFileSync(path.join(resumeLocation(root, 'claude'), name)));
});

test('doctor requires the Resume skill for configured agents', t => {
  const root = fixture(t);
  ok(run(root, 'install', '--agent', 'both', '--yes'));
  ok(run(root, 'setup', '--agent', 'both', '--yes'));
  ok(run(root, 'doctor', '--agent', 'both'));
  fs.rmSync(resumeLocation(root, 'claude'), { recursive: true });
  assert.equal(run(root, 'doctor', '--agent', 'both').status, 1);
  ok(run(root, 'update', '--agent', 'both', '--yes'));
  assert.equal(fs.existsSync(path.join(resumeLocation(root, 'claude'), 'SKILL.md')), true);
});

test('init preserves existing content, adds a single block, ignores only intended state, and uninstall restores bytes', t => {
  const root = fixture(t);
  const originals = { 'AGENTS.md': '# Project instructions\nKeep these.\n', 'CLAUDE.md': '# Team conventions\r\nKeep these too.', '.gitignore': '# Existing rules\nnode_modules/\n' };
  for (const [name, content] of Object.entries(originals)) fs.writeFileSync(path.join(root, name), content);
  ok(run(root, 'init', '--yes'));
  const first = Object.fromEntries(Object.keys(originals).map(name => [name, read(root, name)]));
  ok(run(root, 'init', '--yes'));
  for (const [name, content] of Object.entries(originals)) {
    assert.equal(read(root, name), first[name]);
    assert.equal(read(root, name).startsWith(content), true);
    assert.equal((read(root, name).match(/orbit-thread:start/g) ?? []).length, 1);
  }
  assert.equal(spawnSync('git', ['check-ignore', 'HANDOFF-STATE.md'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['check-ignore', 'HANDOFF-STATE-other.md'], { cwd: root }).status, 1);
  ok(run(root, 'uninstall', '--yes'));
  for (const [name, content] of Object.entries(originals)) assert.equal(read(root, name), content);
  assert.equal(fs.existsSync(path.join(root, '.orbit-handoff')), false);
});

test('init never creates HANDOFF-STATE.md; selected uninstall preserves the other agent configuration', t => {
  const root = fixture(t);
  ok(run(root, 'init', '--yes'));
  assert.equal(fs.existsSync(path.join(root, 'HANDOFF-STATE.md')), false);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), 'keep local evidence');
  ok(run(root, 'uninstall', '--agent', 'codex', '--yes'));
  // AGENTS.md remains while Claude is still configured because it carries the shared Orbit workflow rules.
  assert.equal(read(root, 'AGENTS.md').includes('Orbit Thread workflow'), true);
  assert.equal(read(root, 'CLAUDE.md').includes('Orbit Thread'), true);
  assert.equal(read(root, '.gitignore').includes('HANDOFF-STATE.md'), true);
  ok(run(root, 'uninstall', '--agent', 'claude', '--yes'));
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
  assert.equal(read(root, 'HANDOFF-STATE.md'), 'keep local evidence');
});

test('existing user-authored ignore rule is neither duplicated nor removed', t => {
  const root = fixture(t);
  const original = '# Local state\nHANDOFF-STATE.md\n';
  fs.writeFileSync(path.join(root, '.gitignore'), original);
  ok(run(root, 'init', '--yes'));
  assert.equal(read(root, '.gitignore').startsWith(original), true);
  assert.equal(read(root, '.gitignore').includes('.orbit-thread/state.json'), true);
  assert.equal((read(root, '.gitignore').match(/orbit-thread:start/g) ?? []).length, 1);
  ok(run(root, 'uninstall', '--yes'));
  assert.equal(read(root, '.gitignore'), original);
});

test('unmanaged skill and symlink targets are refused without changes', t => {
  const root = fixture(t);
  const dir = location(root, 'claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), 'unrelated skill');
  assert.equal(run(root, 'install', '--yes').status, 1);
  assert.equal(read(dir, 'SKILL.md'), 'unrelated skill');
  assert.equal(fs.existsSync(location(root, 'codex')), false);
  ok(run(root, 'uninstall', '--yes'));
  assert.equal(read(dir, 'SKILL.md'), 'unrelated skill');
  const elsewhere = path.join(root, 'elsewhere');
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(root, '.agents'));
  assert.equal(run(root, 'install', '--agent', 'codex', '--yes').status, 1);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});

test('edited installed skill is preserved on update, reinstall and uninstall', t => {
  const root = fixture(t);
  ok(run(root, 'install', '--agent', 'codex', '--yes'));
  const dir = location(root, 'codex');
  fs.appendFileSync(path.join(dir, 'SKILL.md'), '\nPersonal change\n');
  const edited = read(dir, 'SKILL.md');
  assert.equal(run(root, 'update', '--agent', 'codex', '--yes').status, 1);
  assert.equal(run(root, 'install', '--agent', 'codex', '--yes').status, 1);
  assert.equal(run(root, 'check', '--agent', 'codex').status, 1);
  ok(run(root, 'uninstall', '--agent', 'codex', '--yes'));
  assert.equal(read(dir, 'SKILL.md'), edited);
});

test('edited managed instructions survive uninstall; init refuses duplication', t => {
  const root = fixture(t);
  ok(run(root, 'init', '--yes'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), read(root, 'AGENTS.md').replace('Durable truth is', 'My durable truth is'));
  const edited = read(root, 'AGENTS.md');
  assert.equal(run(root, 'init', '--yes').status, 1);
  assert.equal(read(root, 'AGENTS.md'), edited);
  ok(run(root, 'uninstall', '--yes'));
  assert.equal(read(root, 'AGENTS.md'), edited);
});

test('unowned or malformed block prevents all init mutations', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '<!-- orbit-handoff:start -->\nprivate rules');
  assert.equal(run(root, 'init', '--yes').status, 1);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
});

test('later unrelated instructions survive uninstall', t => {
  const root = fixture(t);
  ok(run(root, 'init', '--yes'));
  fs.appendFileSync(path.join(root, 'AGENTS.md'), '\n# More instructions\nKeep me.\n');
  ok(run(root, 'uninstall', '--yes'));
  assert.equal(read(root, 'AGENTS.md'), '\n# More instructions\nKeep me.\n');
});

test('nested command configures repository root, not the subdirectory', t => {
  const root = fixture(t);
  const nested = path.join(root, 'packages/example');
  fs.mkdirSync(nested, { recursive: true });
  ok(run(nested, 'install', '--yes'));
  ok(run(nested, 'init', '--yes'));
  assertSkill(location(root, 'codex'));
  assert.equal(fs.existsSync(path.join(nested, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), true);
});

test('user scope uses official home locations in a disposable home', t => {
  const root = fixture(t);
  const home = path.join(root, 'disposable home');
  fs.mkdirSync(home);
  const userRun = (...args) => spawnSync(process.execPath, ['--input-type=module', '-e', `import os from 'node:os'; os.homedir = () => ${JSON.stringify(home)}; const { main } = await import(${JSON.stringify(new URL('../lib/cli.mjs', import.meta.url).href)}); try { await main(${JSON.stringify(args)}); } catch (e) { console.error(e.message); process.exitCode=1; }`], { cwd: root, encoding: 'utf8' });
  ok(userRun('install', '--scope', 'user', '--yes'));
  assertSkill(location(home, 'codex'));
  assertSkill(location(home, 'claude'));
  ok(userRun('check', '--scope', 'user'));
  ok(userRun('update', '--scope', 'user', '--yes'));
  ok(userRun('uninstall', '--scope', 'user', '--yes'));
  assert.equal(fs.existsSync(location(home, 'codex')), false);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});

test('missing installations and invalid commands report failure', t => {
  const root = fixture(t);
  assert.equal(run(root, 'check').status, 1);
  assert.equal(run(root, 'update', '--yes').status, 1);
  for (const args of [['unknown'], ['install', '--agent', 'other', '--yes'], ['install', '--scope'], ['init', '--scope', 'user', '--yes'], ['install']]) assert.equal(run(root, ...args).status, 1);
  ok(run(root, '--help'));
  ok(run(root, '--version'));
});

test('malicious ownership paths cannot escape installation', t => {
  const root = fixture(t);
  ok(run(root, 'install', '--agent', 'codex', '--yes'));
  const dir = location(root, 'codex');
  const manifest = JSON.parse(read(dir, '.orbit-thread.json'));
  manifest.files['../../outside.txt'] = 'a'.repeat(64);
  fs.writeFileSync(path.join(dir, '.orbit-thread.json'), JSON.stringify(manifest));
  assert.equal(run(root, 'uninstall', '--agent', 'codex', '--yes').status, 1);
  assertSkill(dir);
});

test('update migrates unchanged files from an older managed package and preserves unrelated files', t => {
  const root = fixture(t);
  ok(run(root, 'install', '--agent', 'codex', '--yes'));
  const installed = location(root, 'codex');
  const currentMarker = path.join(installed, '.orbit-thread.json');
  const legacyMarker = path.join(installed, '.orbit-handoff.json');
  const legacyState = JSON.parse(fs.readFileSync(currentMarker, 'utf8'));
  legacyState.product = 'orbit-handoff';
  fs.writeFileSync(legacyMarker, JSON.stringify(legacyState));
  fs.unlinkSync(currentMarker);
  const newer = path.join(root, 'newer-package');
  fs.mkdirSync(newer);
  const repo = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['bin', 'lib', 'plugin']) fs.cpSync(path.join(repo, name), path.join(newer, name), { recursive: true });
  const pkg = JSON.parse(read(repo, 'package.json'));
  pkg.version = '1.0.1';
  fs.writeFileSync(path.join(newer, 'package.json'), JSON.stringify(pkg));
  fs.appendFileSync(path.join(newer, 'plugin/skills/handoff/SKILL.md'), '\nRelease fixture guidance.\n');
  fs.writeFileSync(path.join(location(root, 'codex'), 'my-notes.txt'), 'preserve');
  const result = spawnSync(process.execPath, [path.join(newer, 'bin/orbit-handoff.mjs'), 'update', '--agent', 'codex', '--yes'], { cwd: root, encoding: 'utf8' });
  ok(result);
  assert.equal(read(location(root, 'codex'), 'SKILL.md').endsWith('Release fixture guidance.\n'), true);
  assert.equal(JSON.parse(read(location(root, 'codex'), '.orbit-thread.json')).version, '1.0.1');
  assert.equal(fs.existsSync(path.join(location(root, 'codex'), '.orbit-handoff.json')), false);
  assert.equal(read(location(root, 'codex'), 'my-notes.txt'), 'preserve');
});

test('init upgrades an intact recorded managed block without changing surrounding instructions', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Keep existing content.\n');
  ok(run(root, 'init', '--agent', 'codex', '--yes'));
  const p = path.join(root, '.orbit-thread/state.json');
  const state = JSON.parse(fs.readFileSync(p, 'utf8'));
  const old = state.additions['AGENTS.md'].inserted.replace('Durable truth is', 'Legacy truth is');
  assert.notEqual(old, state.additions['AGENTS.md'].inserted);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), read(root, 'AGENTS.md').replace(state.additions['AGENTS.md'].inserted, old));
  state.additions['AGENTS.md'].inserted = old;
  fs.writeFileSync(p, JSON.stringify(state));
  ok(run(root, 'init', '--agent', 'codex', '--yes'));
  assert.equal(read(root, 'AGENTS.md').startsWith('Keep existing content.\n'), true);
  const upgradedState = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.notEqual(upgradedState.additions['AGENTS.md'].inserted, old);
  assert.equal(read(root, 'AGENTS.md').includes(upgradedState.additions['AGENTS.md'].inserted), true);
  assert.equal(read(root, 'AGENTS.md').split('orbit-thread:start').length, 2);
  ok(run(root, 'uninstall', '--agent', 'codex', '--yes'));
  assert.equal(read(root, 'AGENTS.md'), 'Keep existing content.\n');
});
