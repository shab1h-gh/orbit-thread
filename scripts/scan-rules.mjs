// Shared public-source scan rules. Kept separate so tests can exercise them directly.
// The single approved exception is the exact public Orbit Next hostname; every other
// occurrence of the private project name (including lookalike hostnames) still fails.
const HOST = ['mcp', 'orbit', ['con', 'vio'].join(''), 'io'].join('.');
const approvedHost = new RegExp('(?<![\\w.@-])' + HOST.replaceAll('.', '\\.') + '(?![\\w@-]|\\.[a-z0-9])', 'gi');
export const patterns = [
  ['machine home path', new RegExp('/' + 'Users/' + '[^/\\s]+', 'i')],
  ['absolute Linux home', new RegExp('/' + 'home/' + '[^/\\s]+', 'i')],
  ['absolute Windows home', new RegExp('[A-Z]:\\\\' + 'Users\\\\', 'i')],
  ['private project name', new RegExp(['con', 'vio'].join(''), 'i')],
  ['unrelated application', new RegExp('Orbit' + ' app', 'i')],
  ['private key', new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----')],
  ['credential', /(?:gh[pousr]_[\w]{20,}|github_pat_[\w]{20,}|AKIA[0-9A-Z]{16}|sk-(?:proj-|ant-)?[\w-]{20,}|(?:sk|rk)_(?:live|test)_[\w]{10,}|xox[abprs]-[\w-]{10,})/],
  ['private workers.dev host', /[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i],
  ['cloudflare account id assignment', /account[_-]?id["']?\s*[:=]\s*["']?[0-9a-f]{32}\b/i],
  ['credential assignment', /(?:secret|token|password|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_+\/-]{20,}/i],
];

export function scanContent(content) {
  const withoutApprovedHost = content.replace(approvedHost, '');
  return patterns.filter(([, re]) => re.test(withoutApprovedHost)).map(([label]) => label);
}
