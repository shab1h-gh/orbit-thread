import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/orbit-thread.mjs', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'orbit resume '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: root });
  return root;
}
function run(root, ...args) { return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }); }
function commit(root, filename = 'tracked.txt') {
  fs.writeFileSync(path.join(root, filename), 'verified source\n');
  spawnSync('git', ['add', filename], { cwd: root });
  return spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'verified milestone'], { cwd: root });
}
const handoff = (updated = '01-01-2020 10:00') => `# Handoff State\n\nUpdated: ${updated}\n\n## Current objective\n- Finish the sample feature.\n\n## Completed milestones\n- Added the base route.\n\n## In progress\n- Preserve the local edit.\n\n## Open issues / risks\n- Browser verification remains.\n\n## Immediate next steps\n1. Finish the handler.\n2. Run focused checks.\n\n## Verification\n- Unit suite passed.\n`;

test('resume prints concise fields and preserves handoff and dirty Git changes', t => {
  const root = fixture(t);
  commit(root);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff('11-10-2026 10:00'));
  fs.writeFileSync(path.join(root, 'unfinished.txt'), 'keep this edit');
  const before = fs.readFileSync(path.join(root, 'HANDOFF-STATE.md'), 'utf8');
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr + result.stdout);
  for (const text of ['Objective:', 'Finish the sample feature', 'Completed milestones:', 'Unfinished work:', 'Preserve the local edit', 'Risks:', 'Browser verification remains', 'Verification:', 'Unit suite passed', 'Branch:', 'Working tree: dirty', 'Finish the handler']) assert.match(result.stdout, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(fs.readFileSync(path.join(root, 'HANDOFF-STATE.md'), 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(root, 'unfinished.txt'), 'utf8'), 'keep this edit');
});

test('missing and invalid handoffs fall back without inventing context', t => {
  const root = fixture(t);
  const missing = run(root, 'resume');
  assert.equal(missing.status, 0, missing.stderr);
  assert.match(missing.stdout, /Handoff: missing/);
  assert.match(missing.stdout, /Objective:[\s\S]*Unknown/);
  assert.match(missing.stdout, /No handoff exists yet/);

  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), '# This is not a valid handoff\n');
  const invalid = run(root, 'resume');
  assert.equal(invalid.status, 0, invalid.stderr);
  assert.match(invalid.stdout, /Handoff: invalid/);
  assert.match(invalid.stdout, /Objective:[\s\S]*Unknown/);
  assert.doesNotMatch(invalid.stdout, /invented objective/i);
});

test('older handoff is marked stale and its next steps are not presented as current', t => {
  const root = fixture(t);
  assert.equal(commit(root).status, 0);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff());
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: possibly outdated/);
  assert.match(result.stdout, /Current Git and tracked docs override stale handoff details/);
  assert.match(result.stdout, /Next steps:[\s\S]*Inspect current Git changes/);
  assert.doesNotMatch(result.stdout, /Next steps:[\s\S]*Finish the handler/);
});

test('recorded branch mismatch marks the handoff outdated', t => {
  const root = fixture(t);
  assert.equal(commit(root).status, 0);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff('11-10-2026 10:00').replace('## Current objective', 'Current branch: old-feature\n\n## Current objective'));
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: possibly outdated — recorded branch old-feature differs from current branch/);
});

test('branch metadata cannot inject terminal controls into Resume output', t => {
  const root = fixture(t);
  assert.equal(commit(root).status, 0);
  const controls = `feature\u001b[2J\u001b]52;c;clipboard\u0007`;
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff('11-10-2026 10:00').replace('## Current objective', `Branch: ${controls}\n\n## Current objective`));
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: possibly outdated/);
  assert.doesNotMatch(result.stdout, /[\u001b\u0007\u009b]|52;c;clipboard/);
});

test('future-dated handoff is marked outdated', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff('01-01-2099 10:00'));
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: possibly outdated — handoff date is in the future/);
  assert.match(result.stdout, /Treat the handoff as a lead/);
});

test('resume rejects options and redacts secret-like assignments', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), handoff('11-10-2026 10:00').replace('Finish the sample feature.', 'Set API_KEY=supersecret now.'));
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /supersecret/);
  assert.equal(run(root, 'resume', '--yes').status, 1);
});

test('secret-looking untracked paths are omitted from Git details', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.env'), 'API_KEY=must-not-appear');
  fs.writeFileSync(path.join(root, '.dev.vars'), 'TOKEN=also-private');
  const result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /must-not-appear|also-private|\.env|\.dev\.vars/);
  assert.match(result.stdout, /sensitive-looking path\(s\) omitted/);
});

test('oversized and symlink handoffs are rejected without reading their target', t => {
  const root = fixture(t);
  const target = path.join(root, 'outside.md');
  fs.writeFileSync(target, handoff('11-10-2026 10:00'));
  fs.symlinkSync(target, path.join(root, 'HANDOFF-STATE.md'));
  let result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: invalid — not a regular local file/);
  fs.unlinkSync(path.join(root, 'HANDOFF-STATE.md'));
  fs.writeFileSync(path.join(root, 'HANDOFF-STATE.md'), 'x'.repeat(32769));
  result = run(root, 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Handoff: invalid — larger than the 32 KB safety limit/);
});
