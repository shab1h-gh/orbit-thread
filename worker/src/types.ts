export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Basis = 'verified' | 'heuristic';
export type Status = 'PASS' | 'WARN' | 'BLOCKED' | 'UNKNOWN';

/** Loose shapes of the GitHub REST fields we read. All values are untrusted and sanitised before output. */
export interface GhRepo { private?: boolean; archived?: boolean; disabled?: boolean; default_branch?: string; pushed_at?: string; open_issues_count?: number; fork?: boolean }
export interface GhCommit { sha?: string; commit?: { message?: string; committer?: { date?: string } } }
export interface GhPull { number?: number; title?: string; draft?: boolean; updated_at?: string; created_at?: string; requested_reviewers?: unknown[]; labels?: { name?: string }[] }
export interface GhIssue { number?: number; title?: string; created_at?: string; updated_at?: string; labels?: ({ name?: string } | string)[]; assignees?: unknown[]; pull_request?: unknown; comments?: number }
export interface GhRun { id?: number; name?: string; display_title?: string; status?: string; conclusion?: string | null; head_sha?: string; head_branch?: string; event?: string; run_attempt?: number; created_at?: string; updated_at?: string; workflow_id?: number }
export interface GhStep { name?: string; number?: number; conclusion?: string | null; status?: string }
export interface GhJob { id?: number; name?: string; conclusion?: string | null; status?: string; runner_name?: string; steps?: GhStep[] }
export interface GhAnnotation { path?: string; start_line?: number; annotation_level?: string; message?: string; title?: string }
