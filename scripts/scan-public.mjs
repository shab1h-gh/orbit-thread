import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['.git', 'node_modules', 'dist', '.wrangler']);
const patterns = [
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
let inspected = 0, failures = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name.endsWith('.tgz')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) { console.error(`Unexpected symlink: ${path.relative(root, p)}`); failures++; continue; }
    if (entry.isDirectory()) { walk(p); continue; }
    inspected++;
    if (entry.name.endsWith('.png')) continue;
    const content = fs.readFileSync(p, 'utf8');
    for (const [label, re] of patterns) if (re.test(content)) { console.error(`${label}: ${path.relative(root, p)}`); failures++; }
  }
}
walk(root);
if (failures) process.exitCode = 1;
else console.log(`Public-source scan passed (${inspected} files; build archives are inspected separately).`);
