import { GitHubClient, GitHubError, urls } from './github.js';
import { clean, cleanPath } from './sanitize.js';
import { loadRepo, repoPath, isId, UNTRUSTED_NOTICE } from './common.js';
import { InputError } from './validate.js';
import type { RepoRef } from './validate.js';
import type { GhAnnotation, GhJob, GhRun } from './types.js';

const BAD = new Set(['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required']);
const MAX_JOBS = 5, MAX_STEPS = 5, MAX_ANNOTATIONS = 5;

/** Deterministic mapping from a failing step/annotation to an area to inspect. Hints, never causes. */
const AREA_RULES: { re: RegExp; area: string }[] = [
  { re: /\b(test|jest|vitest|pytest|mocha|rspec|unittest|go test|cargo test)\b/i, area: 'Test step failed: inspect the failing test output and any recent changes to the code under test.' },
  { re: /\b(lint|eslint|prettier|ruff|flake8|rubocop|clippy|format)\b/i, area: 'Lint/format step failed: run the project linter locally and inspect the files named in the annotations.' },
  { re: /\b(tsc|typecheck|type-check|mypy|compile|build|webpack|vite|gradle|maven|make)\b/i, area: 'Build/typecheck step failed: inspect compiler errors for the commit and recent dependency or config changes.' },
  { re: /\b(install|npm ci|npm install|yarn|pnpm|pip install|bundle install|restore|setup-)/i, area: 'Dependency/setup step failed: inspect lockfile, registry availability and toolchain version settings.' },
  { re: /\b(checkout|fetch|clone|submodule)\b/i, area: 'Checkout step failed: inspect repository permissions, submodules and fetch depth.' },
  { re: /\b(deploy|publish|release|upload|push)\b/i, area: 'Deploy/publish step failed: inspect target credentials and permissions (not visible here) and the step conditions.' },
];

export function investigationAreas(stepNames: string[], jobNames: string[], hasAnnotationPaths: boolean, run: GhRun): string[] {
  const out = new Set<string>();
  for (const name of [...stepNames, ...jobNames]) for (const r of AREA_RULES) if (r.re.test(name)) out.add(r.area);
  if (hasAnnotationPaths) out.add('Annotations point at specific files and lines: start with those locations.');
  if ((run.run_attempt ?? 1) > 1) out.add(`This is attempt ${run.run_attempt}: compare with earlier attempts to check for flakiness.`);
  if (run.conclusion === 'timed_out') out.add('The run timed out: check for hangs and the configured timeout-minutes.');
  if (run.conclusion === 'cancelled') out.add('The run was cancelled (by a person, a concurrency group or a newer push): a cancellation is not itself a code failure.');
  return [...out].slice(0, 6);
}

export async function diagnoseCiFailure(gh: GitHubClient, ref: RepoRef, runId?: number) {
  const { branch } = await loadRepo(gh, ref);
  const base = repoPath(ref);
  let run: GhRun | null;
  let selected: 'requested' | 'latest-failed-on-default-branch' = 'requested';

  if (runId !== undefined) {
    run = await gh.jsonOrNull<GhRun>(`${base}/actions/runs/${runId}`);
    if (!run) throw new InputError(`Run ${runId} was not found in ${ref.owner}/${ref.repo}.`);
  } else {
    selected = 'latest-failed-on-default-branch';
    const res = await gh.json<{ workflow_runs?: GhRun[] }>(`${base}/actions/runs?branch=${encodeURIComponent(branch)}&status=failure&per_page=1&exclude_pull_requests=true`);
    run = Array.isArray(res.workflow_runs) ? res.workflow_runs[0] ?? null : null;
    if (!run) {
      return { repo: `${ref.owner}/${ref.repo}`, outcome: 'no_failed_run_found', notice: UNTRUSTED_NOTICE,
        summary: `No failed GitHub Actions run found on ${clean(branch, 80)}. Pass run_id to inspect a specific run (for example one from a pull request).`, failures: [], unknowns: [] };
    }
  }
  if (!isId(run.id)) throw new GitHubError('upstream', 'GitHub returned a run without a valid id.');
  const id = run.id;
  const runInfo = { id, url: urls.run(ref, id), workflow: clean(run.name, 80), title: clean(run.display_title, 120), event: clean(run.event, 30), branch: clean(run.head_branch, 80),
    commit: typeof run.head_sha === 'string' && /^[0-9a-f]{40}$/.test(run.head_sha) ? run.head_sha.slice(0, 12) : undefined, attempt: run.run_attempt ?? 1,
    status: clean(run.status, 20), conclusion: clean(run.conclusion ?? '', 30) || null };

  if (run.status !== 'completed') {
    return { repo: `${ref.owner}/${ref.repo}`, outcome: 'run_not_finished', run: runInfo, notice: UNTRUSTED_NOTICE, summary: 'The run has not completed, so there is no final failure to diagnose yet.', failures: [], unknowns: [] };
  }
  if (!BAD.has(run.conclusion ?? '')) {
    return { repo: `${ref.owner}/${ref.repo}`, outcome: 'run_did_not_fail', run: runInfo, notice: UNTRUSTED_NOTICE, summary: `The run concluded "${clean(run.conclusion ?? 'unknown', 30)}"; there is no failure to diagnose.`, failures: [], unknowns: [] };
  }

  const unknowns = ['Workflow logs are not available without authentication, so no log excerpts are returned; evidence is limited to job/step results and check annotations.'];
  const jobsRes = await gh.json<{ jobs?: GhJob[] }>(`${base}/actions/runs/${id}/jobs?filter=latest&per_page=100`);
  const allJobs = Array.isArray(jobsRes.jobs) ? jobsRes.jobs : [];
  const failedJobs = allJobs.filter(j => isId(j.id) && BAD.has(j.conclusion ?? ''));
  if (!failedJobs.length) unknowns.push('The run is marked failed but no failed job was reported (for example a startup or workflow-level failure).');

  const shown = failedJobs.slice(0, MAX_JOBS);
  const annotationsByJob = await Promise.all(shown.map(async j => {
    try { return await gh.jsonOrNull<GhAnnotation[]>(`${base}/check-runs/${j.id}/annotations?per_page=${MAX_ANNOTATIONS}`) ?? []; }
    catch (e) { if (e instanceof GitHubError && e.kind === 'rate_limited') throw e; unknowns.push(`Annotations for job ${j.id} could not be read.`); return []; }
  }));

  const stepNames: string[] = [], jobNames: string[] = [];
  let anyPath = false;
  const failures = shown.map((j, idx) => {
    const failedSteps = (Array.isArray(j.steps) ? j.steps : []).filter(s => BAD.has(s.conclusion ?? '')).slice(0, MAX_STEPS);
    jobNames.push(clean(j.name, 80));
    failedSteps.forEach(s => stepNames.push(clean(s.name, 80)));
    const evidence = (Array.isArray(annotationsByJob[idx]) ? annotationsByJob[idx] : []).slice(0, MAX_ANNOTATIONS)
      .filter(a => a.annotation_level === 'failure' || a.annotation_level === 'warning' || a.annotation_level === 'notice')
      .map(a => { const p = cleanPath(a.path); if (p && p !== '.github') anyPath = true; return { level: clean(a.annotation_level, 10), ...(p ? { path: p } : {}), ...(Number.isInteger(a.start_line) ? { line: a.start_line } : {}), message: clean(a.message ?? a.title, 240) }; })
      .filter(e => e.message);
    return { job: clean(j.name, 80), url: urls.job(ref, id, j.id as number), conclusion: clean(j.conclusion ?? '', 30),
      failedSteps: failedSteps.map(s => ({ step: clean(s.name, 80), number: s.number, conclusion: clean(s.conclusion ?? '', 30) })), evidence };
  });
  if (failedJobs.length > MAX_JOBS) unknowns.push(`${failedJobs.length - MAX_JOBS} further failed job(s) omitted.`);

  return {
    repo: `${ref.owner}/${ref.repo}`, outcome: 'failure_observed', selected, run: runInfo, notice: UNTRUSTED_NOTICE,
    rootCause: 'not determined — this tool reports observed failures and where to look, never a verified cause.',
    failures,
    investigate: investigationAreas(stepNames, jobNames, anyPath, run).map(area => ({ basis: 'heuristic' as const, area })),
    unknowns,
  };
}
