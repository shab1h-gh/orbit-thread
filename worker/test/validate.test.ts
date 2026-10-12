import { describe, expect, it } from 'vitest';
import { InputError, parseOwner, parseRepo, parseRunId } from '../src/validate.js';

describe('input validation', () => {
  it('accepts normal names', () => {
    expect(parseOwner('shab1h-gh')).toBe('shab1h-gh');
    expect(parseOwner('a')).toBe('a');
    expect(parseRepo('next.js')).toBe('next.js');
    expect(parseRepo('.github')).toBe('.github');
    expect(parseRepo('a_b-c.d')).toBe('a_b-c.d');
  });
  it.each(['', '-a', 'a-', 'a--b', 'a/b', 'a b', '../x', 'x'.repeat(40), 'a%2fb', 'a@b', 'https://evil.test', 'üser', 'a\nb'])('rejects owner %j', v => {
    expect(() => parseOwner(v)).toThrow(InputError);
  });
  it.each(['', '.', '..', 'a/b', 'a b', 'x'.repeat(101), 'repo.git', 'a?b=1', 'a#b', '%2e%2e', 'a\\b', 'a\u0000b', 'a:b'])('rejects repo %j', v => {
    expect(() => parseRepo(v)).toThrow(InputError);
  });
  it.each([undefined, null, 5, {}, [], true])('rejects non-string owner/repo %j', v => {
    expect(() => parseOwner(v)).toThrow(InputError);
    expect(() => parseRepo(v)).toThrow(InputError);
  });
  it('parses run ids', () => {
    expect(parseRunId(undefined)).toBeUndefined();
    expect(parseRunId(123)).toBe(123);
    expect(parseRunId('456')).toBe(456);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2 ** 53, '0', '01', '1e3', '12 ', '-5', 'abc', '', {}, [], true, '9'.repeat(30)])('rejects run id %j', v => {
    expect(() => parseRunId(v)).toThrow(InputError);
  });
});
