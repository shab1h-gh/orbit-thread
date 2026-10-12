import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const handoffPath = root => path.join(root, 'HANDOFF-STATE.md');
const secret = /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret|authorization|bearer)\b\s*[:=]\s*[^\s,;]+/gi;

function scrub(value) {
  const safe = value.slice(0, 500)
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u009b[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
  if (/\b(?:password|passphrase|token|secret|credential|private\s+key|api[_ -]?key|authorization|bearer)\b/i.test(safe)) {
    return '[redacted sensitive-looking handoff line]';
  }
  return safe.replace(secret, '$1=[redacted]');
}

function readHandoff(root) {
  const file = handoffPath(root);
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return { state: 'invalid', reason: 'not a regular local file' };
    if (stat.size > 32768) return { state: 'invalid', reason: 'larger than the 32 KB safety limit' };
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    if (lines.length > 51) return { state: 'invalid', reason: 'over the 50-line limit' };
    if (!/^# Handoff State\s*$/m.test(text)) return { state: 'invalid', reason: 'missing the Handoff State heading' };
    const updated = text.match(/^Updated:\s*(\d{2})-(\d{2})-(\d{4})(?:\s+\d{2}:\d{2})?\s*$/m);
    const objective = section(text, 'Current objective');
    if (!updated || !objective.length) return { state: 'invalid', reason: 'missing a valid update date or current objective' };
    const date = new Date(Number(updated[3]), Number(updated[2]) - 1, Number(updated[1]));
    if (Number.isNaN(date.valueOf()) || date.getDate() !== Number(updated[1]) || date.getMonth() !== Number(updated[2]) - 1) {
      return { state: 'invalid', reason: 'invalid update date' };
    }
    return {
      state: 'valid', text, updated: `${updated[3]}-${updated[2]}-${updated[1]}`,
      fields: {
        objective,
        completed: section(text, 'Completed milestones'),
        unfinished: section(text, 'In progress'),
        risks: section(text, 'Open issues / risks'),
        verification: section(text, 'Verification'),
        next: section(text, 'Immediate next steps'),
      },
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing' };
    throw error;
  }
}

function section(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^##\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s+|\\s*$)`, 'm'));
  if (!match) return [];
  return match[1].split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^<!--/.test(line)).slice(0, 6).map(line => scrub(line));
}

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch { return null; }
}

function currentGit(root) {
  const branch = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']) ?? (git(root, ['rev-parse', '--short', 'HEAD']) ? 'detached HEAD' : null);
  const status = git(root, ['status', '--short', '--untracked-files=normal']);
  const commitDate = git(root, ['log', '-1', '--format=%cs']);
  const changed = (status ?? '').split(/\r?\n/).filter(Boolean);
  const safeChanged = changed.filter(line => !/(^|\s)(?:\.env(?:\.|\s|$)|\.dev\.vars(?:\s|$)|.*(?:secret|credential|private[_-]?key|id_rsa|id_ed25519|\.pem|\.key|\.netrc|\.npmrc|\.pypirc).*)/i.test(line));
  return { branch, status, changed: safeChanged.slice(0, 8), count: changed.length, commitDate };
}

function relevantDocs(text, root) {
  const topics = [
    ['PRODUCT.md', /product|workflow|scope|user-facing|feature/i],
    ['DESIGN.md', /ui|ux|design|layout|visual|accessibility/i],
    ['ARCHITECTURE.md', /architecture|runtime|data flow|integration|database|storage|deploy/i],
    ['SECURITY.md', /auth|security|permission|secret|tenant|trust|privacy/i],
    ['ROADMAP.md', /roadmap|plan|milestone|later|defer/i],
  ];
  const matches = [];
  for (const [name, pattern] of topics) {
    if (!pattern.test(text)) continue;
    for (const file of [path.join(root, name), path.join(root, 'docs', name)]) {
      try {
        if (fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink()) { matches.push(path.relative(root, file)); break; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return [...new Set(matches)].slice(0, 3);
}

function printLines(label, lines, fallback) {
  console.log(`${label}:`);
  if (!lines.length) console.log(`  ${fallback}`);
  else lines.forEach(line => console.log(`  ${line}`));
}

export function resumeProject(root) {
  root = path.resolve(root);
  const handoff = readHandoff(root);
  const gitState = currentGit(root);
  let status = handoff.state;
  let reason = handoff.reason;
  const recordedBranch = handoff.state === 'valid' ? handoff.text.match(/^(?:current\s+)?branch:\s*([^\s]+)/im)?.[1] : null;
  if (recordedBranch && gitState.branch) {
    if (recordedBranch !== gitState.branch) { status = 'possibly outdated'; reason = `recorded branch ${recordedBranch} differs from current branch`; }
  }
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (handoff.state === 'valid' && handoff.updated && handoff.updated > todayDate) {
    status = 'possibly outdated';
    reason = 'handoff date is in the future';
  }
  if (handoff.state === 'valid' && gitState.commitDate && handoff.updated && gitState.commitDate > handoff.updated) {
    status = 'possibly outdated';
    reason = `Git has a commit dated ${gitState.commitDate}, after the handoff date`;
  }

  console.log('Orbit Resume (read-only)');
  console.log(`Project: ${scrub(path.basename(root))}`);
  console.log(`Handoff: ${status}${reason ? ` — ${scrub(reason)}` : ''}`);
  if (handoff.state === 'valid') {
    const usable = status === 'valid';
    printLines('Objective', usable ? handoff.fields.objective : [], usable ? 'Not recorded.' : 'Treat the handoff as a lead; current repository evidence takes precedence.');
    printLines('Completed milestones', usable ? handoff.fields.completed : [], 'No verified milestones recorded.');
    printLines('Unfinished work', usable ? handoff.fields.unfinished : [], 'No in-progress work recorded.');
    printLines('Risks', usable ? handoff.fields.risks : [], 'No risks recorded.');
    printLines('Verification', usable ? handoff.fields.verification : [], 'No verification recorded.');
  } else {
    printLines('Objective', [], 'Unknown; do not infer it from an absent or invalid handoff.');
    printLines('Completed milestones', [], 'No reliable handoff evidence.');
    printLines('Unfinished work', [], 'Check the current task and Git changes before proceeding.');
    printLines('Risks', [], handoff.state === 'invalid' ? 'Handoff was not used because it is invalid.' : 'No handoff exists yet.');
    printLines('Verification', [], 'No reliable handoff evidence.');
  }

  console.log('Git status:');
  if (!gitState.branch && gitState.status === null) console.log('  Git repository unavailable.');
  else {
    console.log(`  Branch: ${scrub(gitState.branch ?? 'unknown')}`);
    console.log(`  Working tree: ${gitState.count ? `dirty (${gitState.count} change${gitState.count === 1 ? '' : 's'})` : 'clean'}`);
    gitState.changed.forEach(line => console.log(`  ${scrub(line)}`));
    if (gitState.count > gitState.changed.length) console.log(`  ${gitState.count - gitState.changed.length} sensitive-looking path(s) omitted.`);
  }

  const trustedNext = handoff.state === 'valid' && status === 'valid' ? handoff.fields.next : [];
  const docs = relevantDocs([...(trustedNext.length ? trustedNext : []), ...(handoff.state === 'valid' ? handoff.fields.objective : [])].join(' '), root);
  printLines('Next steps', trustedNext, handoff.state === 'valid' && status === 'valid' ? 'No next step recorded; inspect current changes and choose one from repository evidence.' : 'Inspect current Git changes, then identify the next action from the user request and tracked project docs.');
  printLines('Relevant living docs', docs, 'None identified from the handoff; load a living doc only if the next action needs it.');
  console.log('Keep unfinished working changes. Do not reset or clean the repository. Current Git and tracked docs override stale handoff details.');
}
