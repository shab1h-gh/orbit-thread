import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupProject, checkProject } from '../plugin/skills/orbit-setup/scripts/setup_project.mjs';
import { configureProject, readProjectConfig } from '../plugin/skills/orbit-setup/scripts/project_config.mjs';

function fixture(t, git = true) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'orbit setup '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (git) spawnSync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('setup creates living docs and managed project rules idempotently', t => {
  const root = fixture(t);
  setupProject(root, ['codex','claude']);
  for (const name of ['PRODUCT.md','ARCHITECTURE.md','SECURITY.md','ROADMAP.md','DESIGN.md']) assert.equal(fs.existsSync(path.join(root,'docs',name)), true);
  assert.match(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'), /Orbit Thread workflow/);
  assert.match(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'), /\$orbit-resume.*once at session start/);
  assert.match(fs.readFileSync(path.join(root,'CLAUDE.md'),'utf8'), /Read and follow `AGENTS.md`/);
  assert.match(fs.readFileSync(path.join(root,'CLAUDE.md'),'utf8'), /\/orbit-resume.*once at session start/);
  assert.match(fs.readFileSync(path.join(root,'CLAUDE.md'),'utf8'), /\/orbit-thread:orbit-resume/);
  assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'), /^# orbit-thread:start/m);
  assert.equal(fs.existsSync(path.join(root,'HANDOFF-STATE.md')), false);
  assert.equal(fs.existsSync(path.join(root,'.orbit-thread','config.json')), true);
  const before = fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
  setupProject(root, ['codex','claude']);
  assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'), before);
  assert.equal(checkProject(root,['codex','claude']).ok, true);
});

test('setup preserves existing docs and unrelated instructions', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root,'docs'));
  fs.writeFileSync(path.join(root,'docs','ARCHITECTURE.md'), '# Existing architecture\n');
  fs.writeFileSync(path.join(root,'AGENTS.md'), '# Existing rules\nKeep me.\n');
  setupProject(root,['codex']);
  assert.equal(fs.readFileSync(path.join(root,'docs','ARCHITECTURE.md'),'utf8'), '# Existing architecture\n');
  assert.match(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'), /^# Existing rules\nKeep me\./);
  assert.equal(fs.existsSync(path.join(root,'CLAUDE.md')), false);
});

test('setup works before git init using cwd as project root', t => {
  const root = fixture(t, false);
  setupProject(root,['codex']);
  assert.equal(fs.existsSync(path.join(root,'docs','PRODUCT.md')), true);
});


test('subagent preferences update config and the managed AGENTS block only', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# User rules\nKeep me.\n');
  setupProject(root, ['codex','claude']);
  configureProject(root, { agent: 'claude', model: 'Claude Sonnet 5.5', reasoning: 'low', maxSubagents: 1 });
  configureProject(root, { agent: 'codex', model: 'GPT-6.1 Sol', reasoning: 'high' });
  const config = readProjectConfig(root);
  assert.equal(config.subagents.max, 1);
  assert.equal(config.subagents.claude.model, 'Claude Sonnet 5.5');
  assert.equal(config.subagents.codex.reasoning, 'high');
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /^# User rules\nKeep me\./);
  assert.match(agents, /Claude Sonnet 5\.5/);
  assert.match(agents, /GPT-6\.1 Sol/);
  assert.equal(checkProject(root, ['codex','claude']).ok, true);
});

test('doctor flags duplicate root/docs living docs', t => {
  const root = fixture(t);
  setupProject(root, ['codex']);
  fs.writeFileSync(path.join(root, 'ARCHITECTURE.md'), '# duplicate\n');
  const result = checkProject(root, ['codex']);
  assert.equal(result.ok, false);
  assert.equal(result.messages.some(message => message.includes('duplicate root/docs copies')), true);
});


test('legacy Orbit Handoff project state migrates to Orbit Thread', t => {
  const root = fixture(t);
  setupProject(root, ['codex']);
  const current = path.join(root, '.orbit-thread', 'state.json');
  const legacy = path.join(root, '.orbit-handoff', 'state.json');
  const state = JSON.parse(fs.readFileSync(current, 'utf8'));
  state.product = 'orbit-handoff';
  state.schema = 2;
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, JSON.stringify(state));
  fs.unlinkSync(current);

  setupProject(root, ['codex']);
  assert.equal(fs.existsSync(current), true);
  assert.equal(fs.existsSync(legacy), false);
  assert.equal(JSON.parse(fs.readFileSync(current, 'utf8')).product, 'orbit-thread');
  assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /orbit-thread:start/);
});


test('resetting subagent preferences preserves the configured maximum', t => {
  const root = fixture(t);
  setupProject(root, ['codex','claude']);
  configureProject(root, { agent: 'claude', model: 'Claude Sonnet 5.5', reasoning: 'low', maxSubagents: 1 });
  configureProject(root, { agent: 'codex', model: 'GPT-6.1 Sol', reasoning: 'high' });
  configureProject(root, { resetSubagents: true });
  const config = readProjectConfig(root);
  assert.equal(config.subagents.max, 1);
  assert.deepEqual(config.subagents.claude, { model: null, reasoning: null });
  assert.deepEqual(config.subagents.codex, { model: null, reasoning: null });
});
