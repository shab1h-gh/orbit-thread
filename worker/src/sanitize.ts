/**
 * Output hygiene. Repository text, workflow annotations and metadata are untrusted:
 * they are stripped of control sequences, redacted for secret-looking values,
 * flattened to one line and length-bounded before they reach an AI assistant.
 */

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g;
// C0/C1 controls (keeping none: output is single-line), bidi overrides, zero-width and tag characters.
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿\u{e0000}-\u{e007f}]/gu;

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:Bearer|Basic|token)\s+[A-Za-z0-9._~+\/=-]{16,}/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/:@]+:[^\s\/@]+@/gi,
  /((?:secret|token|passw(?:or)?d|api[_-]?key|access[_-]?key|private[_-]?key|credential)s?["']?\s*[:=]\s*["']?)[^\s"',;]{8,}/gi,
];

export const REDACTED = '[redacted]';

/** Remove terminal escapes, control characters and secret-looking values; collapse whitespace; bound length. */
export function clean(input: unknown, max = 200): string {
  if (typeof input !== 'string') return '';
  let s = input.slice(0, max * 8).replace(ANSI, ' ').replace(CONTROL, ' ');
  for (const re of SECRET_PATTERNS) s = s.replace(re, (m, g1) => (typeof g1 === 'string' && m.startsWith(g1) ? g1 + REDACTED : REDACTED));
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Sanitise a repository-relative path taken from untrusted metadata. */
export function cleanPath(input: unknown): string {
  const s = clean(input, 160);
  return /^[\w .@+\/()-]+$/.test(s) && !s.includes('..') ? s : '';
}
