/** Input validation. Everything that reaches a GitHub URL passes through here first. */

export class InputError extends Error {}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_RUN_ID = Number.MAX_SAFE_INTEGER;

export function parseOwner(value: unknown): string {
  if (typeof value !== 'string' || !OWNER.test(value) || value.includes('--')) {
    throw new InputError('owner must be a valid GitHub user or organisation name (letters, digits, single hyphens, max 39 characters).');
  }
  return value;
}

export function parseRepo(value: unknown): string {
  if (typeof value !== 'string' || !REPO.test(value) || value === '.' || value === '..' || value.toLowerCase().endsWith('.git')) {
    throw new InputError('repo must be a valid GitHub repository name (letters, digits, ".", "_", "-"; max 100 characters; no ".git" suffix).');
  }
  return value;
}

export function parseRunId(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > MAX_RUN_ID) {
    throw new InputError('run_id must be a positive integer GitHub Actions run ID.');
  }
  return n;
}

export interface RepoRef { owner: string; repo: string }

export function parseRepoRef(owner: unknown, repo: unknown): RepoRef {
  return { owner: parseOwner(owner), repo: parseRepo(repo) };
}
