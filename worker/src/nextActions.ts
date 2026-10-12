import { GitHubClient, urls } from './github.js';
import { clean } from './sanitize.js';
import { loadRepo, repoPath, daysSince, isSha, isId, UNTRUSTED_NOTICE } from './common.js';
import type { Basis, GhCommit, GhIssue, GhPull, GhRun, Severity } from './types.js';
import type { RepoRef } from './validate.js';
import { GitHubError } from './github.js';

export interface Action { id: string; severity: Severity; basis: Basis; title: string; rationale: string; sources: string[] }

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const FAILED = new Set(['failure', 'timed_out', 'startup_failure']);
const URGENT_LABEL = /^(?:bug|regression|security|vulnerability|blocker|critical|p0|p1|priority[:\s/-]*(?:high|critical|p0|p1)|severity[:\s/-]*(?:high|critical))$/i;
const STALE_PR_DAYS = 14;
const INACTIVE_DAYS = 90;
const MAX_ACTIONS = 12;

/** Deterministic ordering: severity, then verified before heuristic, then stable id. */
export function sortActions(actions: Action[]): Action[] {
  return [...actions].sort((a, b) =>
    RANK[a.severity] - RANK[b.severity] || (a.basis === b.basis ? 0 : a.basis === 'verified' ? -1 : 1) || a.id.localeCompare(b.id, 'en'));
}

/** Unchecked checklist items from a roadmap, taken only from a "Next"/"Now"/"In progress"/"Planned"/"Upcoming" style section. */
export function roadmapItems(markdown: string, max = 5): string[] {
  const out: string[] = [];
  let inScope = false;
  for (const line of markdown.split(/\r?\n/).slice(0, 2000)) {
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) { inScope = /\b(next|now|current|in progress|planned|upcoming|todo|backlog)\b/i.test(h[1]); continue; }
    const item = /^\s*[-*]\s+\[ \]\s+(.+)$/.exec(line);
    if (item && inScope) { const t = clean(item[1], 140); if (t) out.push(t); if (out.length >= max) break; }
  }
  return out;
}

export async function getNextActions(gh: GitHubClient, ref: RepoRef, now = Date.now()) {
  const { repo, branch } = await loadRepo(gh, ref);
  const base = repoPath(ref);
  const unknowns: string[] = [];
  const facts: string[] = [];
  const actions: Action[] = [];

  const settle = async <T>(label: string, p: Promise<T>): Promise<T | undefined> => {
    try { return await p; } catch (e) {
      if (e instanceof GitHubError && e.kind === 'rate_limited') throw e;
      unknowns.push(`${label} could not be read (${e instanceof GitHubError ? e.kind : 'error'}).`); return undefined;
    }
  };
  const [commits, pulls, issues, runsRes] = await Promise.all([
    settle('Recent commits', gh.json<GhCommit[]>(`${base}/commits?sha=${encodeURIComponent(branch)}&per_page=10`)),
    settle('Open pull requests', gh.json<GhPull[]>(`${base}/pulls?state=open&sort=updated&direction=desc&per_page=30`)),
    settle('Open issues', gh.json<GhIssue[]>(`${base}/issues?state=open&sort=updated&direction=desc&per_page=50`)),
    settle('GitHub Actions runs', gh.json<{ workflow_runs?: GhRun[] }>(`${base}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10&exclude_pull_requests=true`)),
  ]);

  if (repo.archived) {
    actions.push({ id: 'repo-archived', severity: 'info', basis: 'verified', title: 'Repository is archived', rationale: 'GitHub reports this repository as archived (read-only); no further development is expected.', sources: [urls.repo(ref)] });
  }

  // CI on the default branch.
  const runs = Array.isArray(runsRes?.workflow_runs) ? runsRes.workflow_runs : undefined;
  if (runs) {
    const done = runs.filter(r => r.status === 'completed' && isId(r.id));
    const latest = done[0];
    if (!runs.length) unknowns.push(`No GitHub Actions runs found on ${clean(branch, 80)}; CI health is unknown (the project may use another CI system).`);
    else if (latest && typeof latest.conclusion === 'string') {
      facts.push(`Latest completed CI run on ${clean(branch, 80)}: ${clean(latest.conclusion, 30)} (${clean(latest.name, 60)}).`);
      if (FAILED.has(latest.conclusion) && isId(latest.id)) {
        actions.push({ id: 'ci-failing', severity: 'high', basis: 'verified', title: `Fix failing CI on ${clean(branch, 80)}`,
          rationale: `The most recent completed run "${clean(latest.name, 60)}" concluded "${clean(latest.conclusion, 30)}". Use diagnose_ci_failure with run_id ${latest.id}.`, sources: [urls.run(ref, latest.id)] });
      }
    }
  }

  // Pull requests.
  if (Array.isArray(pulls)) {
    const ready = pulls.filter(p => isId(p.number));
    facts.push(`${ready.length} open pull request(s) fetched${ready.length === 30 ? ' (first page only)' : ''}.`);
    for (const p of ready) {
      const age = daysSince(p.updated_at, now);
      const n = p.number as number;
      if (!p.draft && Array.isArray(p.requested_reviewers) && p.requested_reviewers.length > 0) {
        actions.push({ id: `pr-${String(n).padStart(8, '0')}-review`, severity: 'medium', basis: 'verified', title: `Review PR #${n}: ${clean(p.title, 100)}`,
          rationale: `${p.requested_reviewers.length} reviewer(s) are requested on this non-draft PR.`, sources: [urls.pull(ref, n)] });
      } else if (!p.draft && age !== undefined && age >= STALE_PR_DAYS) {
        actions.push({ id: `pr-${String(n).padStart(8, '0')}-stale`, severity: 'low', basis: 'heuristic', title: `Decide on stale PR #${n}: ${clean(p.title, 100)}`,
          rationale: `Non-draft PR with no update for ${age} days (threshold ${STALE_PR_DAYS}). Whether it is still wanted is not determinable from public data.`, sources: [urls.pull(ref, n)] });
      }
    }
  }

  // Issues (the issues endpoint also returns PRs; those are excluded).
  if (Array.isArray(issues)) {
    const real = issues.filter(i => !i.pull_request && isId(i.number));
    facts.push(`${real.length} open issue(s) fetched${issues.length === 50 ? ' (first page only)' : ''}.`);
    for (const i of real) {
      const labels = (i.labels ?? []).map(l => clean(typeof l === 'string' ? l : l?.name, 40)).filter(Boolean);
      const hit = labels.filter(l => URGENT_LABEL.test(l));
      if (hit.length) {
        const n = i.number as number;
        const security = hit.some(l => /security|vulnerab/i.test(l)); 
        actions.push({ id: `issue-${String(n).padStart(8, '0')}`, severity: security ? 'high' : 'medium', basis: 'verified', title: `Triage issue #${n}: ${clean(i.title, 100)}`,
          rationale: `Open issue carries label(s): ${hit.join(', ')}. The label is a maintainer-applied signal, not proof of impact.`, sources: [urls.issue(ref, n)] });
      }
    }
  }

  // Recent commit activity.
  if (Array.isArray(commits) && commits.length) {
    const top = commits[0];
    const age = daysSince(top.commit?.committer?.date, now);
    if (age !== undefined) {
      facts.push(`Latest commit on ${clean(branch, 80)} is ${age} day(s) old.`);
      if (age >= INACTIVE_DAYS && isSha(top.sha)) {
        actions.push({ id: 'repo-inactive', severity: 'info', basis: 'heuristic', title: 'Repository looks inactive',
          rationale: `No commit on the default branch for ${age} days (threshold ${INACTIVE_DAYS}). Active work may live on other branches or elsewhere.`, sources: [urls.commit(ref, top.sha)] });
      }
    }
  } else if (Array.isArray(commits)) unknowns.push('No commits returned for the default branch.');

  // Tracked roadmap (fixed paths, pinned to the head commit).
  const head = Array.isArray(commits) && isSha(commits[0]?.sha) ? (commits[0].sha as string) : undefined;
  if (head) {
    for (const path of ['ROADMAP.md', 'docs/ROADMAP.md'] as const) {
      let text: string | null = null;
      try { text = await gh.file(ref, head, path); } catch (e) { if (e instanceof GitHubError && e.kind === 'rate_limited') throw e; }
      if (text === null) continue;
      const items = roadmapItems(text);
      facts.push(`${path} found; ${items.length} unchecked item(s) in a next/planned section.`);
      items.forEach((t, i) => actions.push({ id: `roadmap-${String(i).padStart(2, '0')}`, severity: 'low', basis: 'heuristic', title: `Roadmap: ${t}`,
        rationale: `Unchecked item in ${path}. Documents can be out of date; confirm before acting.`, sources: [urls.file(ref, head, path)] }));
      break;
    }
  }

  const sorted = sortActions(actions);
  return {
    repo: `${ref.owner}/${ref.repo}`, defaultBranch: clean(branch, 80), source: 'github-public-api',
    notice: UNTRUSTED_NOTICE,
    actions: sorted.slice(0, MAX_ACTIONS),
    ...(sorted.length > MAX_ACTIONS ? { omitted: sorted.length - MAX_ACTIONS } : {}),
    facts, unknowns,
    limits: ['Only public GitHub metadata is inspected; private work, local branches and uncommitted changes are invisible.', 'Heuristic items are suggestions, not verified priorities.'],
  };
}
