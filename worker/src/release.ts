import { GitHubClient, GitHubError, urls } from './github.js';
import type { ReadablePath } from './github.js';
import { clean } from './sanitize.js';
import { loadRepo, repoPath, isSha, isId, UNTRUSTED_NOTICE } from './common.js';
import type { GhCommit, GhPull, GhRun, Status } from './types.js';
import type { RepoRef } from './validate.js';

export interface Check { id: string; status: Status; summary: string; sources: string[] }

const MANIFESTS: ReadablePath[] = ['package.json', 'plugin/plugin.json', '.claude-plugin/plugin.json', 'plugin/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'cancelled', 'action_required']);

/** Versions found in a manifest. marketplace.json contributes its plugin entries and metadata.version. */
export function manifestVersions(path: string, text: string): string[] {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return []; }
  if (!json || typeof json !== 'object') return [];
  const o = json as Record<string, unknown>;
  const found: unknown[] = [];
  if (path.endsWith('marketplace.json')) {
    const meta = o.metadata as Record<string, unknown> | undefined;
    found.push(meta?.version);
    if (Array.isArray(o.plugins)) for (const p of o.plugins) found.push((p as Record<string, unknown> | null)?.version);
  } else found.push(o.version);
  return found.filter((v): v is string => typeof v === 'string' && SEMVER.test(v));
}

export function changelogHas(markdown: string, version: string): boolean {
  const esc = version.replace(/[.+]/g, '\\$&');
  return new RegExp(`^#{1,3}\\s*\\[?v?${esc}\\]?(?:\\s|$|[-–—(])`, 'm').test(markdown);
}

export function overall(checks: Check[]): Status {
  if (checks.some(c => c.status === 'BLOCKED')) return 'BLOCKED';
  if (checks.some(c => c.status === 'WARN')) return 'WARN';
  if (checks.every(c => c.status === 'UNKNOWN')) return 'UNKNOWN';
  return checks.some(c => c.status === 'UNKNOWN') ? 'WARN' : 'PASS';
}

export async function assessReleaseReadiness(gh: GitHubClient, ref: RepoRef) {
  const { repo, branch } = await loadRepo(gh, ref);
  const base = repoPath(ref);
  const checks: Check[] = [];
  const settle = async <T>(p: Promise<T>): Promise<T | undefined> => {
    try { return await p; } catch (e) { if (e instanceof GitHubError && e.kind === 'rate_limited') throw e; return undefined; }
  };

  const [commits, runsRes, pulls, latestRelease] = await Promise.all([
    settle(gh.json<GhCommit[]>(`${base}/commits?sha=${encodeURIComponent(branch)}&per_page=1`)),
    settle(gh.json<{ workflow_runs?: GhRun[] }>(`${base}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10&exclude_pull_requests=true`)),
    settle(gh.json<GhPull[]>(`${base}/pulls?state=open&per_page=30`)),
    settle(gh.jsonOrNull<{ tag_name?: string; draft?: boolean; prerelease?: boolean }>(`${base}/releases/latest`)),
  ]);
  const head = Array.isArray(commits) && isSha(commits[0]?.sha) ? (commits[0].sha as string) : undefined;

  // 1. Repository state
  checks.push(repo.archived
    ? { id: 'repository', status: 'BLOCKED', summary: 'Repository is archived (read-only).', sources: [urls.repo(ref)] }
    : { id: 'repository', status: 'PASS', summary: `Public repository, default branch ${clean(branch, 80)}${head ? `, head ${head.slice(0, 12)}` : ''}.`, sources: [urls.repo(ref)] });

  // 2. CI
  const runs = Array.isArray(runsRes?.workflow_runs) ? runsRes.workflow_runs : undefined;
  if (!runs) checks.push({ id: 'ci', status: 'UNKNOWN', summary: 'GitHub Actions runs could not be read.', sources: [] });
  else {
    const latest = runs.find(r => r.status === 'completed' && isId(r.id));
    if (!latest) checks.push({ id: 'ci', status: 'UNKNOWN', summary: runs.length ? 'Only in-progress runs found; no completed run to judge.' : 'No GitHub Actions runs found (the project may use another CI system).', sources: [] });
    else {
      const src = [urls.run(ref, latest.id as number)];
      const concl = clean(latest.conclusion ?? '', 30);
      const stale = head && latest.head_sha !== head;
      if (FAILED.has(latest.conclusion ?? '')) checks.push({ id: 'ci', status: 'BLOCKED', summary: `Latest completed run "${clean(latest.name, 60)}" concluded "${concl}".`, sources: src });
      else if (latest.conclusion !== 'success') checks.push({ id: 'ci', status: 'WARN', summary: `Latest completed run concluded "${concl}", not "success".`, sources: src });
      else if (stale) checks.push({ id: 'ci', status: 'WARN', summary: `Latest successful run is for ${String(latest.head_sha).slice(0, 12)}, not the current head ${head.slice(0, 12)}.`, sources: src });
      else checks.push({ id: 'ci', status: 'PASS', summary: `Latest completed run "${clean(latest.name, 60)}" succeeded on the current head.`, sources: src });
      const other = runs.filter(r => r.status === 'completed' && r.head_sha === latest.head_sha && FAILED.has(r.conclusion ?? '') && isId(r.id));
      if (other.length && latest.conclusion === 'success') checks[checks.length - 1].summary += ` ${other.length} other workflow run(s) on that commit failed.`, checks[checks.length - 1].status = 'WARN';
    }
  }

  // 3. Open pull requests
  if (!Array.isArray(pulls)) checks.push({ id: 'open_prs', status: 'UNKNOWN', summary: 'Open pull requests could not be read.', sources: [] });
  else {
    const open = pulls.filter(p => isId(p.number));
    const ready = open.filter(p => !p.draft);
    checks.push(!open.length ? { id: 'open_prs', status: 'PASS', summary: 'No open pull requests.', sources: [] }
      : ready.length ? { id: 'open_prs', status: 'WARN', summary: `${ready.length} non-draft open PR(s)${open.length === 30 ? ' (first page)' : ''}: ${ready.slice(0, 5).map(p => `#${p.number}`).join(', ')}. Confirm whether they belong in this release.`, sources: ready.slice(0, 5).map(p => urls.pull(ref, p.number as number)) }
      : { id: 'open_prs', status: 'PASS', summary: `${open.length} open PR(s), all drafts.`, sources: [] });
  }

  // 4. Version consistency (fixed manifest paths pinned to the head commit)
  const versions: { path: string; version: string }[] = [];
  let changelog: string | null = null;
  if (head) {
    const fetched = await Promise.all([...MANIFESTS, 'CHANGELOG.md' as const].map(async p => [p, await settle(gh.file(ref, head, p))] as const));
    for (const [p, text] of fetched) {
      if (p === 'CHANGELOG.md') changelog = text ?? null;
      else if (text) for (const v of manifestVersions(p, text)) versions.push({ path: p, version: v });
    }
  }
  const distinct = [...new Set(versions.map(v => v.version))];
  const manifestSources = head ? [...new Set(versions.map(v => v.path))].map(p => urls.file(ref, head, p)) : [];
  let current: string | undefined;
  if (!head) checks.push({ id: 'version_consistency', status: 'UNKNOWN', summary: 'Head commit could not be read, so manifests were not inspected.', sources: [] });
  else if (!versions.length) checks.push({ id: 'version_consistency', status: 'UNKNOWN', summary: 'No version found in the known manifest paths (package.json, plugin manifests, marketplace.json).', sources: [] });
  else if (distinct.length > 1) checks.push({ id: 'version_consistency', status: 'BLOCKED', summary: `Manifests disagree: ${versions.map(v => `${v.path}=${v.version}`).join(', ')}.`, sources: manifestSources });
  else { current = distinct[0]; checks.push({ id: 'version_consistency', status: 'PASS', summary: `${versions.length} version field(s) in ${new Set(versions.map(v => v.path)).size} manifest(s) agree on ${current}.`, sources: manifestSources }); }

  // 5. Changelog
  if (!head) checks.push({ id: 'changelog', status: 'UNKNOWN', summary: 'Not inspected.', sources: [] });
  else if (changelog === null) checks.push({ id: 'changelog', status: 'WARN', summary: 'No CHANGELOG.md at the repository root (release notes may live in GitHub Releases).', sources: [] });
  else if (!current) checks.push({ id: 'changelog', status: 'UNKNOWN', summary: 'CHANGELOG.md exists but there is no single manifest version to look for.', sources: [urls.file(ref, head, 'CHANGELOG.md')] });
  else checks.push(changelogHas(changelog, current)
    ? { id: 'changelog', status: 'PASS', summary: `CHANGELOG.md has an entry for ${current}.`, sources: [urls.file(ref, head, 'CHANGELOG.md')] }
    : { id: 'changelog', status: 'BLOCKED', summary: `CHANGELOG.md has no heading for ${current}.`, sources: [urls.file(ref, head, 'CHANGELOG.md')] });

  // 6. Tags and published release
  const release = latestRelease && typeof latestRelease.tag_name === 'string' ? clean(latestRelease.tag_name, 80) : null;
  if (!current) checks.push({ id: 'tags', status: 'UNKNOWN', summary: 'No single manifest version to compare against existing tags.', sources: [] });
  else {
    const found = await Promise.all([`v${current}`, current].map(t => settle(gh.json<{ ref?: string }[]>(`${base}/git/matching-refs/tags/${encodeURIComponent(t)}`))));
    if (found.some(f => !Array.isArray(f))) checks.push({ id: 'tags', status: 'UNKNOWN', summary: 'Tags could not be read.', sources: [] });
    else {
      const names = found.flatMap(f => (f as { ref?: string }[]).map(t => (typeof t.ref === 'string' ? t.ref.replace(/^refs\/tags\//, '') : '')));
      const taken = names.find(t => t === `v${current}` || t === current);
      checks.push(taken
        ? { id: 'tags', status: 'WARN', summary: `Tag ${clean(taken, 80)} already exists for the manifest version ${current}; a new release needs a version bump or this is already released.`, sources: [urls.tag(ref, taken)] }
        : { id: 'tags', status: 'PASS', summary: `No tag exists yet for ${current}${release ? `; latest published release is ${release}` : ''}.`, sources: [urls.releases(ref)] });
    }
  }

  const technical = overall(checks);
  return {
    repo: `${ref.owner}/${ref.repo}`, defaultBranch: clean(branch, 80), notice: UNTRUSTED_NOTICE,
    technicalReadiness: technical, checks,
    humanApproval: { status: 'UNKNOWN', summary: 'Approval by a maintainer is a human decision and cannot be determined from public data.' },
    publication: { status: 'NOT_PERFORMED', summary: 'This tool is read-only: it never tags, releases or publishes anything.', latestPublishedRelease: release },
    limits: ['Version checks cover only fixed manifest paths in the repository root and plugin/.', 'Draft releases, branch protection, required reviews and private checks are not visible without authentication.'],
  };
}
