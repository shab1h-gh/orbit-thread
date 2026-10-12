import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureProjectConfig, readProjectConfig, renderSubagentBlock } from './project_config.mjs';

const begin = '<!-- orbit-thread:start -->';
const end = '<!-- orbit-thread:end -->';
const legacyBegin = '<!-- orbit-handoff:start -->';
const legacyEnd = '<!-- orbit-handoff:end -->';
const ignoreBegin = '# orbit-thread:start';
const ignoreEnd = '# orbit-thread:end';
const legacyIgnoreBegin = '# orbit-handoff:start';
const legacyIgnoreEnd = '# orbit-handoff:end';

const agentsBlock = config => `${begin}
## Orbit Thread workflow

- Durable truth is the tracked source plus current living docs. \`HANDOFF-STATE.md\` is concise execution state only, never project history.
- Before substantial work, inspect current Git state and load context selectively:
  - product behaviour, scope or copy → \`PRODUCT.md\`;
  - UI/UX → \`DESIGN.md\`;
  - runtime, data flow, infrastructure or integrations → \`ARCHITECTURE.md\`;
  - auth, tenancy, secrets, public entry points or other security-sensitive work → \`SECURITY.md\`;
  - future planning only → \`ROADMAP.md\`.
  Use the matching file in \`docs/\` or the project root. For cross-cutting work, read only the additional docs it actually touches.
- Inspect only source files needed for the task. Do not broadly scan generated, vendor, dependency, build, coverage or cache directories, and do not reread unchanged context without a reason.
- Living docs describe CURRENT truth. After verified work changes that truth, update affected existing sections in place during the same milestone. Never append session diaries or duplicate superseded sections; Git is history. Never rewrite an applied migration.
- Run the smallest relevant verification before claiming a milestone or task complete. Never claim a test, deployment, commit, push or external action that did not run.
- Start each new coding task in a fresh chat and invoke \`$orbit-resume\` once at session start. Do this automatically where the host supports it; otherwise the reliable fallback is to invoke it manually. Do not repeat Resume in the same session unless the user asks for a fresh recovery.
- Run the installed \`handoff\` skill after a meaningful verified milestone that changed repository state or durable project truth, and after each completed coding task with such changes before the final reply. Also checkpoint before \`/clear\`, session end, or a usage/context stop when warning is available. Skip read-only questions and trivial edits. Intermediate checkpoints must not stop unfinished work.
- Each checkpoint overwrites \`HANDOFF-STATE.md\`. Resume reads the handoff once if present, checks current Git state, then reads only task-relevant living docs and source. Do not reconstruct old conversation history or repeat completed work.
${renderSubagentBlock(config)}
- Read-only Git inspection is allowed. Commit, push, merge, rebase, reset, branch deletion or other Git writes require explicit authority in the current request. Never force-push or destructively clean without explicit authority.
- Never place secrets, credentials, environment values, private keys, recovery codes, personal data or sensitive production data in living docs or \`HANDOFF-STATE.md\`.
${end}
`;

const claudeBlock = `${begin}
## Orbit Thread

Read and follow \`AGENTS.md\` for project workflow, selective context loading, subagents and checkpoints. Start each new coding task in a fresh chat and invoke \`/orbit-resume\` once at session start, automatically where supported. If automatic invocation is unavailable, manually run \`/orbit-resume\` (or \`/orbit-thread:orbit-resume\` from the marketplace plugin). Do not repeat Resume in the same session unless the user asks for a fresh recovery.
${end}
`;
const templates = {
  'PRODUCT.md': `# Product

> Living current-state document. Replace placeholders as product truth becomes known; do not append session history.

## Purpose
- TODO: what the product does and who it serves.

## Core workflows
- TODO: the main user-visible workflows.

## Scope and non-goals
- TODO: what is in scope and explicitly out of scope.

## Current constraints
- TODO: material product limits that affect implementation.
`,
  'ARCHITECTURE.md': `# Architecture

> Living current-state document. Update existing sections in place when the system changes.

## System shape
- TODO: major runtime components and responsibilities.

## Boundaries and data flow
- TODO: important trust, service and module boundaries.

## Persistence and integrations
- TODO: databases, storage, queues and external services.

## Operational constraints
- TODO: deployment, runtime and reliability constraints.
`,
  'SECURITY.md': `# Security

> Living current-state document. Record actual controls, invariants and known risks only.

## Trust boundaries
- TODO: authentication, authorisation, tenancy and public-entry boundaries.

## Data and secrets
- TODO: sensitive data handling, encryption, secret storage and logging rules.

## Abuse and failure controls
- TODO: rate limits, anti-abuse, validation and fail-closed behaviour.

## Known risks
- TODO: unresolved security limitations or verification still required.
`,
  'ROADMAP.md': `# Roadmap

> Forward-looking current plan only. Replace completed or superseded items instead of appending history.

## Current phase
- TODO: the active project phase and outcome.

## Next
1. TODO: highest-priority next milestone.

## Later
- TODO: worthwhile later work.

## Explicitly deferred
- TODO: work intentionally not being done now.
`,
  'DESIGN.md': `# Design

> Living current-state design truth. Keep this concise and update it in place.

## Direction
- TODO: visual/product design direction.

## System
- TODO: typography, colour, spacing, components and interaction conventions.

## Accessibility and responsive behaviour
- TODO: current accessibility and device rules.

## Surface-specific decisions
- TODO: only durable decisions that affect future UI work.
`,
};

const exists = p => {
  try { fs.lstatSync(p); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};
const read = p => exists(p) ? fs.readFileSync(p, 'utf8') : '';

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
  } finally {
    if (exists(temporary)) fs.unlinkSync(temporary);
  }
}

export function resolveProjectRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return path.resolve(cwd);
  }
}

function statePath(root) {
  return path.join(root, '.orbit-thread/state.json');
}

function legacyStatePath(root) {
  return path.join(root, '.orbit-handoff/state.json');
}

function loadState(root) {
  const current = statePath(root);
  const legacy = legacyStatePath(root);
  if (exists(current) && exists(legacy)) throw new Error('Both Orbit Thread and legacy Orbit Handoff state files exist; reconcile them before setup.');
  const source = exists(current) ? current : exists(legacy) ? legacy : null;
  if (!source) return { state: { product: 'orbit-thread', schema: 3, configuredAgents: [], additions: {} }, source: null };

  const parsed = JSON.parse(read(source));
  if (!parsed.additions || typeof parsed.additions !== 'object' || Array.isArray(parsed.additions)) throw new Error(`Invalid Orbit Thread state: ${source}`);
  for (const [name, addition] of Object.entries(parsed.additions)) {
    if (!['AGENTS.md', 'CLAUDE.md', '.gitignore'].includes(name) || typeof addition.inserted !== 'string' || typeof addition.created !== 'boolean') {
      throw new Error(`Invalid Orbit Thread ownership entry: ${source}`);
    }
  }

  if (parsed.product === 'orbit-thread' && parsed.schema === 3) {
    if (!Array.isArray(parsed.configuredAgents) || parsed.configuredAgents.some(agent => !['codex', 'claude'].includes(agent))) throw new Error(`Invalid Orbit Thread state: ${source}`);
    return { state: parsed, source };
  }

  if (parsed.product === 'orbit-handoff' && [1, 2].includes(parsed.schema)) {
    const configuredAgents = parsed.schema === 1
      ? [...(parsed.additions['AGENTS.md'] ? ['codex'] : []), ...(parsed.additions['CLAUDE.md'] ? ['claude'] : [])]
      : parsed.configuredAgents;
    if (!Array.isArray(configuredAgents) || configuredAgents.some(agent => !['codex', 'claude'].includes(agent))) throw new Error(`Invalid legacy Orbit Handoff state: ${source}`);
    return {
      state: { product: 'orbit-thread', schema: 3, configuredAgents: [...new Set(configuredAgents)], additions: parsed.additions },
      source,
    };
  }

  throw new Error(`Unsupported Orbit Thread state: ${source}`);
}

function persistState(root, state, source = null) {
  const p = statePath(root);
  if (Object.keys(state.additions).length || state.configuredAgents.length) {
    atomicWrite(p, JSON.stringify(state, null, 2) + '\n');
  } else if (exists(p)) {
    fs.unlinkSync(p);
    const dir = path.dirname(p);
    if (exists(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
  const legacy = legacyStatePath(root);
  if (source === legacy && exists(legacy)) {
    fs.unlinkSync(legacy);
    const dir = path.dirname(legacy);
    if (exists(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
}
function desiredIgnoreBlock(before) {
  const lines = before.split(/\r?\n/);
  const missing = [];
  if (!lines.includes('HANDOFF-STATE.md') && !lines.includes('/HANDOFF-STATE.md')) missing.push('HANDOFF-STATE.md');
  if (!lines.includes('.orbit-thread/state.json') && !lines.includes('/.orbit-thread/state.json')) missing.push('.orbit-thread/state.json');
  return missing.length ? `${ignoreBegin}\n${missing.join('\n')}\n${ignoreEnd}\n` : null;
}

function desiredBlock(name, config, before = '') {
  if (name === 'AGENTS.md') return agentsBlock(config);
  if (name === 'CLAUDE.md') return claudeBlock;
  if (name === '.gitignore') return desiredIgnoreBlock(before);
  throw new Error(`Unknown managed file: ${name}`);
}

function markersForInserted(name, inserted) {
  if (name === '.gitignore') {
    return inserted.includes(legacyIgnoreBegin) ? [legacyIgnoreBegin, legacyIgnoreEnd] : [ignoreBegin, ignoreEnd];
  }
  return inserted.includes(legacyBegin) ? [legacyBegin, legacyEnd] : [begin, end];
}

function hasAnyManagedMarker(name, text) {
  const values = name === '.gitignore'
    ? [ignoreBegin, ignoreEnd, legacyIgnoreBegin, legacyIgnoreEnd]
    : [begin, end, legacyBegin, legacyEnd];
  return values.some(value => text.includes(value));
}

function planManaged(root, state, name, config) {
  const p = path.join(root, name);
  safePath(p);
  const before = read(p);
  const owned = state.additions[name];

  if (owned) {
    if (!before.includes(owned.inserted) || before.indexOf(owned.inserted) !== before.lastIndexOf(owned.inserted)) {
      throw new Error(`Managed Orbit Thread block was edited or duplicated in ${name}; review it before running setup.`);
    }
    const [first, last] = markersForInserted(name, owned.inserted);
    if (before.split(first).length !== 2 || before.split(last).length !== 2) {
      throw new Error(`Managed Orbit Thread block was edited or duplicated in ${name}; review it before running setup.`);
    }
    const previousInserted = owned.inserted;
    const leading = previousInserted.match(/^(?:\r?\n)*/)?.[0] ?? '';
    const baseText = before.slice(0, before.indexOf(previousInserted)) + before.slice(before.indexOf(previousInserted) + previousInserted.length);
    const rawDesired = desiredBlock(name, config, baseText);
    if (!rawDesired) {
      delete state.additions[name];
      return { p, name, content: baseText, action: 'updated' };
    }
    const inserted = leading + rawDesired;
    if (inserted === previousInserted) return null;
    state.additions[name].inserted = inserted;
    return { p, name, content: before.replace(previousInserted, inserted), action: 'updated' };
  }


  if (hasAnyManagedMarker(name, before)) {
    throw new Error(`Unowned or malformed Orbit Thread/legacy block in ${name}; refusing to overwrite it.`);
  }

  const rawDesired = desiredBlock(name, config, before);
  if (!rawDesired) return null;
  const inserted = (before ? (before.endsWith('\n') ? '\n' : '\n\n') : '') + rawDesired;
  state.additions[name] = { inserted, created: !exists(p) };
  return { p, name, content: before + inserted, action: exists(p) ? 'updated' : 'created' };
}

function ensureDocs(root) {
  const results = [];
  for (const [name, template] of Object.entries(templates)) {
    const rootFile = path.join(root, name);
    const docsFile = path.join(root, 'docs', name);
    safePath(rootFile);
    safePath(docsFile);
    if (exists(rootFile)) {
      results.push({ name: path.relative(root, rootFile), action: 'preserved' });
      continue;
    }
    if (exists(docsFile)) {
      results.push({ name: path.relative(root, docsFile), action: 'preserved' });
      continue;
    }
    atomicWrite(docsFile, template);
    results.push({ name: path.relative(root, docsFile), action: 'created' });
  }
  return results;
}

export function setupProject(root, selected = ['codex', 'claude']) {
  root = path.resolve(root);
  safePath(root);
  const agents = [...new Set(selected)];
  if (!agents.length || agents.some(agent => !['codex', 'claude'].includes(agent))) throw new Error('Agent must be codex, claude or both');

  const loaded = loadState(root);
  const state = loaded.state;
  const config = readProjectConfig(root);
  state.configuredAgents = [...new Set([...state.configuredAgents, ...agents])].sort();

  const names = ['AGENTS.md', '.gitignore'];
  if (state.configuredAgents.includes('claude')) names.push('CLAUDE.md');

  const planned = names.map(name => planManaged(root, state, name, config)).filter(Boolean);
  const docs = ensureDocs(root);

  ensureProjectConfig(root);
  for (const change of planned) atomicWrite(change.p, change.content);
  persistState(root, state, loaded.source);

  return { root, managed: planned.map(({ name, action }) => ({ name, action })), docs };
}

function removeAddition(root, state, name) {
  const addition = state.additions[name];
  if (!addition) return { name, action: 'not-managed' };
  const p = path.join(root, name);
  safePath(p);
  if (!exists(p)) {
    delete state.additions[name];
    return { name, action: 'missing' };
  }

  const before = read(p);
  const index = before.indexOf(addition.inserted);
  if (index < 0 || index !== before.lastIndexOf(addition.inserted)) {
    return { name, action: 'preserved-edited' };
  }

  const after = before.slice(0, index) + before.slice(index + addition.inserted.length);
  if (!after && addition.created) fs.unlinkSync(p);
  else atomicWrite(p, after);
  delete state.additions[name];
  return { name, action: 'removed' };
}

export function removeProjectConfig(root, selected = ['codex', 'claude']) {
  root = path.resolve(root);
  const loaded = loadState(root);
  const state = loaded.state;
  const remove = new Set(selected);
  state.configuredAgents = state.configuredAgents.filter(agent => !remove.has(agent));

  const results = [];
  if (!state.configuredAgents.includes('claude')) results.push(removeAddition(root, state, 'CLAUDE.md'));
  if (!state.configuredAgents.length) {
    results.push(removeAddition(root, state, 'AGENTS.md'));
    results.push(removeAddition(root, state, '.gitignore'));
  }

  persistState(root, state, loaded.source);
  return results;
}

function gitTracked(root, relative) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relative], {
      cwd: root, stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

export function checkProject(root, selected = ['codex', 'claude']) {
  root = path.resolve(root);
  const loaded = loadState(root);
  const state = loaded.state;
  const messages = [];
  let ok = true;
  if (loaded.source === legacyStatePath(root)) { messages.push('project state: legacy Orbit Handoff state detected; run setup to migrate'); ok = false; }

  try {
    const config = readProjectConfig(root);
    messages.push(`config: valid (max subagents ${config.subagents.max})`);
    if (!exists(path.join(root, '.orbit-thread/config.json'))) {
      messages.push('config: default only; run setup to create .orbit-thread/config.json');
      ok = false;
    }
  } catch (error) {
    messages.push(`config: invalid (${error.message})`);
    ok = false;
  }

  for (const agent of selected) {
    const configured = state.configuredAgents.includes(agent);
    messages.push(`${agent}: ${configured ? 'project workflow configured' : 'project workflow not configured'}`);
    if (!configured) ok = false;
  }

  for (const name of ['AGENTS.md', ...(selected.includes('claude') ? ['CLAUDE.md'] : [])]) {
    const addition = state.additions[name];
    const intact = addition && read(path.join(root, name)).includes(addition.inserted);
    messages.push(`${name}: ${intact ? 'managed block intact' : 'managed block missing or edited'}`);
    if (!intact) ok = false;
  }

  const ignore = read(path.join(root, '.gitignore'));
  const ignoreLines = ignore.split(/\r?\n/);
  const handoffIgnored = ignoreLines.includes('HANDOFF-STATE.md') || ignoreLines.includes('/HANDOFF-STATE.md');
  const stateIgnored = ignoreLines.includes('.orbit-thread/state.json') || ignoreLines.includes('/.orbit-thread/state.json');
  messages.push(`HANDOFF-STATE.md: ${handoffIgnored ? 'ignored' : 'ignore rule missing'}`);
  messages.push(`.orbit-thread/state.json: ${stateIgnored ? 'ignored' : 'ignore rule missing'}`);
  if (!handoffIgnored || !stateIgnored) ok = false;

  if (gitTracked(root, 'HANDOFF-STATE.md')) {
    messages.push('HANDOFF-STATE.md: tracked by Git (should remain local)');
    ok = false;
  }

  for (const name of Object.keys(templates)) {
    const rootFile = exists(path.join(root, name));
    const docsFile = exists(path.join(root, 'docs', name));
    const present = rootFile || docsFile;
    messages.push(`${name}: ${present ? 'present' : 'missing'}${rootFile && docsFile ? ' (duplicate root/docs copies)' : ''}`);
    if (!present || (rootFile && docsFile)) ok = false;
  }

  const handoff = path.join(root, 'HANDOFF-STATE.md');
  if (exists(handoff)) {
    const text = read(handoff);
    const lines = text ? text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0) : 0;
    messages.push(`handoff: ${lines} line${lines === 1 ? '' : 's'}`);
    if (!text || lines > 50) ok = false;
  } else {
    messages.push('handoff: not created yet');
  }

  return { ok, messages };
}
function parseAgent(value) {
  if (value === 'both') return ['codex', 'claude'];
  if (['codex', 'claude'].includes(value)) return [value];
  throw new Error('Agent must be codex, claude or both');
}

async function runCli(argv) {
  let command = 'setup';
  let agent = 'both';
  if (argv[0] && !argv[0].startsWith('-')) command = argv.shift();
  while (argv.length) {
    const flag = argv.shift();
    if (flag === '--agent') agent = argv.shift();
    else throw new Error(`Unknown option: ${flag}`);
  }

  const root = resolveProjectRoot();
  const selected = parseAgent(agent);

  if (command === 'setup') {
    const result = setupProject(root, selected);
    for (const item of [...result.managed, ...result.docs]) console.log(`${item.action}: ${item.name}`);
    console.log('Orbit Thread setup complete. HANDOFF-STATE.md will be created by the handoff skill at the first checkpoint.');
    return;
  }
  if (command === 'check') {
    const result = checkProject(root, selected);
    result.messages.forEach(message => console.log(message));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === 'remove') {
    removeProjectConfig(root, selected).forEach(item => console.log(`${item.action}: ${item.name}`));
    return;
  }
  throw new Error(`Unknown setup command: ${command}`);
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (direct) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
