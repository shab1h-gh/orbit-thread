import { describe, expect, it } from 'vitest';
import { clean, cleanPath } from '../src/sanitize.js';

describe('sanitisation', () => {
  it('strips ANSI, control and bidi characters and flattens whitespace', () => {
    expect(clean('\u001b[31mred\u001b[0m\n\ttext‮evil​')).toBe('red text evil');
  });
  it('redacts secret-looking values', () => {
    const fakes = [
      'ghp_' + 'A'.repeat(36), 'github_pat_' + 'B'.repeat(30), 'AKIA' + 'C'.repeat(16), 'sk-' + 'd'.repeat(30), 'xoxb-' + '1'.repeat(12),
      'Bearer ' + 'e'.repeat(30), 'eyJhbGciOiJI.eyJzdWIiOiIx.abcdefghijk', 'https://user:hunter2pw@host.test/x',
      ['-----BEGIN ', 'RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----'].join(''),
    ];
    for (const f of fakes) {
      const out = clean(`before ${f} after`, 400);
      expect(out).toContain('[redacted]');
      expect(out).not.toContain(f.slice(8, 20));
    }
    expect(clean(['API', '_KEY=', 'abcdefghij', 'klmnopqrst'].join(''))).toBe('API_KEY=[redacted]');
    expect(clean(['pass', 'word: "correcthorse', 'battery"'].join(''))).toContain('[redacted]');
  });
  it('truncates', () => {
    expect(clean('x'.repeat(500), 50)).toHaveLength(50);
    expect(clean(undefined)).toBe('');
  });
  it('accepts only plain repo-relative paths', () => {
    expect(cleanPath('src/app/main.ts')).toBe('src/app/main.ts');
    expect(cleanPath('../../etc/passwd')).toBe('');
    expect(cleanPath('a;rm -rf')).toBe('');
  });
});
