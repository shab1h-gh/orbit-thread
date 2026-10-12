import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { setupProject, checkProject, removeProjectConfig, resolveProjectRoot } from '../plugin/skills/orbit-setup/scripts/setup_project.mjs';
import { configureProject, readProjectConfig } from '../plugin/skills/orbit-setup/scripts/project_config.mjs';
import { resumeProject } from './resume.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const skillsRoot = path.join(packageRoot, 'plugin/skills');
const marker = '.orbit-thread.json';
const legacyMarker = '.orbit-handoff.json';
const agents = ['codex', 'claude'];
const skills = ['handoff', 'orbit-setup', 'orbit-resume'];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const exists = p => { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };

function safePath(p) {
  let cursor = path.resolve(p);
  while (true) {
    if (exists(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Refusing symlink: ${cursor}`);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

function atomicWrite(p, content) {
  safePath(p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const temporary = path.join(path.dirname(p), `.orbit-thread-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode: exists(p) ? fs.statSync(p).mode & 0o777 : 0o644 });
    fs.renameSync(temporary, p);
  } finally { if (exists(temporary)) fs.unlinkSync(temporary); }
}

function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
    return entry.isDirectory() ? files(path.join(dir, entry.name), relative) : [relative];
  }).sort();
}

function skillSource(skill) { return path.join(skillsRoot, skill); }
function bundled(skill) { return Object.fromEntries(files(skillSource(skill)).map(name => [name, fs.readFileSync(path.join(skillSource(skill), name))])); }
function agentSkillsRoot(agent, scope, root) { return path.join(scope === 'user' ? os.homedir() : root, agent === 'codex' ? '.agents/skills' : '.claude/skills'); }
function location(agent, scope, root, skill) { return path.join(agentSkillsRoot(agent, scope, root), skill); }

function ownershipPath(dir) {
  safePath(dir);
  const current = path.join(dir, marker);
  const legacy = path.join(dir, legacyMarker);
  if (exists(current) && exists(legacy)) throw new Error(`Both Orbit Thread and legacy Orbit Handoff ownership files exist at ${dir}; reconcile them before continuing.`);
  if (exists(current)) return current;
  if (exists(legacy)) return legacy;
  return null;
}

function readOwnership(dir) {
  const p = ownershipPath(dir);
  if (!p) return null;
  const state = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!['orbit-handoff', 'orbit-thread'].includes(state.product) || state.schema !== 1 || typeof state.version !== 'string' || !state.files || typeof state.files !== 'object' || Array.isArray(state.files)) throw new Error(`Invalid ownership file: ${p}`);
  for (const [name, hash] of Object.entries(state.files)) {
    if (!name || name === marker || name === legacyMarker || path.posix.isAbsolute(name) || name.includes('\\') || name.split('/').some(part => ['.', '..', ''].includes(part)) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid ownership entry: ${p}`);
  }
  return state;
}

function preflight(dir, skill, updating) {
  const state = readOwnership(dir);
  if (exists(dir) && !state) throw new Error(`An unmanaged ${skill} skill already exists at ${dir}; move it aside yourself before installing.`);
  if (updating && !state) return true;
  if (state) {
    for (const [name, hash] of Object.entries(state.files)) {
      const p = path.join(dir, name); safePath(p);
      if (!exists(p) || digest(fs.readFileSync(p)) !== hash) throw new Error(`Managed file was edited or removed: ${p}. Preserve your changes before updating.`);
    }
    for (const name of Object.keys(bundled(skill))) if (exists(path.join(dir, name)) && !Object.hasOwn(state.files, name)) throw new Error(`Unrelated file conflicts with this release: ${path.join(dir, name)}`);
  }
  return true;
}

function installSkill(dir, skill) {
  const previousPath = ownershipPath(dir);
  const previous = readOwnership(dir);
  const content = bundled(skill);
  for (const [name, data] of Object.entries(content)) atomicWrite(path.join(dir, name), data);
  for (const name of Object.keys(previous?.files ?? {})) if (!Object.hasOwn(content, name) && exists(path.join(dir, name))) fs.unlinkSync(path.join(dir, name));
  atomicWrite(path.join(dir, marker), JSON.stringify({ product: 'orbit-thread', schema: 1, version: pkg.version, skill,
    files: Object.fromEntries(Object.entries(content).map(([name, data]) => [name, digest(data)])) }, null, 2) + '\n');
  if (previousPath && previousPath.endsWith(legacyMarker) && exists(previousPath)) fs.unlinkSync(previousPath);
}

function prune(dir, boundary) {
  while (dir !== boundary && exists(dir) && fs.readdirSync(dir).length === 0) { fs.rmdirSync(dir); dir = path.dirname(dir); }
}

function uninstallSkill(dir) {
  const ownerFile = ownershipPath(dir);
  const state = readOwnership(dir);
  if (!state) { if (exists(dir)) console.log(`Unmanaged skill preserved: ${dir}`); return; }
  const retained = {};
  for (const [name, hash] of Object.entries(state.files)) {
    const p = path.join(dir, name); safePath(p);
    if (!exists(p)) continue;
    if (digest(fs.readFileSync(p)) === hash) { fs.unlinkSync(p); prune(path.dirname(p), dir); }
    else { retained[name] = hash; console.log(`Preserved edited file: ${p}`); }
  }
  if (Object.keys(retained).length) atomicWrite(ownerFile, JSON.stringify({ ...state, files: retained }, null, 2) + '\n');
  else if (ownerFile && exists(ownerFile)) fs.unlinkSync(ownerFile);
  prune(dir, path.dirname(dir));
}

function skillStatus(root, selected, scope) {
  let complete = true;
  for (const agent of selected) {
    for (const skill of skills) {
      const dir = location(agent, scope, root, skill);
      const state = readOwnership(dir);
      let label = exists(dir) ? 'unmanaged skill' : 'not installed';
      if (state) {
        const contents = bundled(skill);
        const intact = Object.entries(state.files).every(([name, hash]) => { const p = path.join(dir, name); return exists(p) && digest(fs.readFileSync(p)) === hash; });
        const current = intact && Object.keys(state.files).length === Object.keys(contents).length && Object.entries(contents).every(([name, data]) => state.files[name] === digest(data));
        label = !intact ? `v${state.version}, locally modified` : current ? `v${state.version}, current` : `v${state.version}, update available in this package`;
        if (!current) complete = false;
      } else complete = false;
      console.log(`${agent}/${skill} (${scope}): ${label} — ${dir}`);
    }
  }
  return complete;
}

const help = `Orbit Thread ${pkg.version}

Usage: orbit-thread <command> [options]

Commands:
  install       Install the Orbit Thread skills.
  setup         Prepare/upgrade the current project workflow and living docs.
  resume        Show concise project continuity and current Git state (read-only).
  configure     Set project subagent preferences.
  doctor        Check installed skills and project continuity health.
  update        Upgrade unchanged managed skill files to this package version.
  uninstall     Remove managed skills and instruction blocks.
  init          Alias for setup.
  check         Check managed skill installation (legacy-compatible).

Common options:
  --agent codex|claude|both
  --scope project|user
  --yes, -y

Configure options:
  --model, --subagent-model <name>
  --reasoning, --effort <level>
  --max-subagents 0|1|2
  --reset-subagents
  --show

Examples:
  npx orbit-thread install
  npx orbit-thread setup
  npx orbit-thread configure --agent claude --model "Claude Sonnet 5.5" --effort low
  npx orbit-thread configure --agent codex --model "GPT-6.1 Sol" --reasoning high
  npx orbit-thread doctor
  npx orbit-thread@latest update --agent both --scope project --yes
`;

function parseOptions(rest) {
  const options = { yes: false, show: false, resetSubagents: false };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const take = () => {
      const value = rest[++i];
      if (value === undefined) throw new Error(`Missing value for ${flag}`);
      return value;
    };
    if (flag === '--yes' || flag === '-y') options.yes = true;
    else if (flag === '--agent') options.agent = take();
    else if (flag === '--scope') options.scope = take();
    else if (flag === '--model' || flag === '--subagent-model') options.model = take();
    else if (flag === '--reasoning' || flag === '--effort') options.reasoning = take();
    else if (flag === '--max-subagents') options.maxSubagents = take();
    else if (flag === '--reset-subagents') options.resetSubagents = true;
    else if (flag === '--show') options.show = true;
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

function selectedAgents(value = 'both') {
  if (!['codex', 'claude', 'both'].includes(value)) throw new Error('Agent must be codex, claude or both');
  return value === 'both' ? agents : [value];
}

export async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || !argv.length) { console.log(help); return; }
  if (argv.includes('--version') || argv.includes('-v')) { console.log(pkg.version); return; }

  let [command, ...rest] = argv;
  if (command === 'init') command = 'setup';
  if (!['install', 'setup', 'resume', 'configure', 'check', 'doctor', 'update', 'uninstall'].includes(command)) throw new Error(`Unknown command: ${command}`);

  const options = parseOptions(rest);
  const scope = options.scope ?? 'project';
  if (!['project', 'user'].includes(scope)) throw new Error('Scope must be project or user');
  if (['setup', 'configure'].includes(command) && scope !== 'project') throw new Error(`${command} configures the current project; use --scope project`);
  if (process.platform === 'win32') throw new Error('Use a Linux environment in WSL; native Windows is not supported');

  let selected = selectedAgents(options.agent);
  const root = resolveProjectRoot(process.cwd());

  if (command === 'resume') {
    if (rest.length) throw new Error('resume does not accept options');
    resumeProject(root);
    return;
  }

  if (command === 'configure') {
    if (options.show) { console.log(JSON.stringify(readProjectConfig(root), null, 2)); return; }
    if ((options.model !== undefined || options.reasoning !== undefined) && selected.length !== 1) {
      throw new Error('Choose exactly one --agent when setting a subagent model or reasoning/effort preference.');
    }
    const config = configureProject(root, {
      agent: selected.length === 1 ? selected[0] : undefined,
      maxSubagents: options.maxSubagents,
      model: options.model,
      reasoning: options.reasoning,
      resetSubagents: options.resetSubagents,
    });
    console.log(`Orbit Thread: project subagent configuration updated (max ${config.subagents.max}).`);
    return;
  }

  if (command === 'check') {
    if (!skillStatus(root, selected, scope)) process.exitCode = 1;
    return;
  }

  if (command === 'doctor') {
    const installed = skillStatus(root, selected, scope);
    let healthy = installed;
    if (scope === 'project') {
      const result = checkProject(root, selected);
      result.messages.forEach(message => console.log(message));
      healthy = healthy && result.ok;
    }
    if (!healthy) process.exitCode = 1;
    return;
  }

  const interactive = !options.yes;
  if (interactive && !process.stdin.isTTY) throw new Error('Non-interactive input: pass --yes (and optionally --agent / --scope)');
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    let effectiveScope = scope;
    if (!options.agent && rl) {
      const answer = (await rl.question('Choose agent: 1) Codex  2) Claude Code  3) Both [3]: ')).trim() || '3';
      const chosen = { '1':'codex', '2':'claude', '3':'both' }[answer];
      if (!chosen) throw new Error('Choose 1, 2 or 3');
      selected = selectedAgents(chosen);
    }
    if (!options.scope && rl && command !== 'setup') {
      const answer = (await rl.question('Choose scope: 1) Current project  2) User/global [1]: ')).trim() || '1';
      effectiveScope = { '1':'project', '2':'user' }[answer];
      if (!effectiveScope) throw new Error('Choose 1 or 2');
    }

    if (command === 'setup') {
      console.log(`Will configure Orbit Thread project continuity in ${root}. Existing docs and unrelated instructions are preserved.`);
      if (rl && !['y','yes'].includes((await rl.question('Continue? [y/N]: ')).trim().toLowerCase())) { console.log('Cancelled.'); return; }
      const result = setupProject(root, selected);
      for (const item of [...result.managed, ...result.docs]) console.log(`${item.action}: ${item.name}`);
      console.log('Orbit Thread: setup complete. HANDOFF-STATE.md will be created at the first meaningful checkpoint.');
      return;
    }

    const targets = selected.flatMap(a => skills.map(skill => ({ agent:a, skill, dir:location(a, effectiveScope, root, skill) })));
    let eligible;
    if (command === 'install' || command === 'update') {
      if (command === 'update' && !targets.some(t => readOwnership(t.dir))) throw new Error('No managed Orbit Thread/legacy Orbit Handoff installation found; run install first');
      eligible = targets.map(t => preflight(t.dir, t.skill, command === 'update'));
    } else targets.forEach(t => readOwnership(t.dir));

    console.log(`Will ${command} Orbit Thread ${pkg.version} (${effectiveScope}):\n${targets.map(t => t.dir).join('\n')}`);
    if (rl && !['y','yes'].includes((await rl.question('Continue? [y/N]: ')).trim().toLowerCase())) { console.log('Cancelled.'); return; }

    if (command === 'uninstall') {
      targets.forEach(t => uninstallSkill(t.dir));
      if (effectiveScope === 'project') removeProjectConfig(root, selected);
    } else {
      targets.forEach((t, i) => { if (command === 'install' || eligible[i]) installSkill(t.dir, t.skill); });
    }
    const suffix = command === 'install' && effectiveScope === 'project' ? '\nRun `npx orbit-thread setup` to prepare this project.' : '';
    console.log(`Orbit Thread: ${command} complete.${suffix}`);
  } finally { rl?.close(); }
}
