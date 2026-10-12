import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanContent } from './scan-rules.mjs';

const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['.git', 'node_modules', 'dist', '.wrangler']);
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
    for (const label of scanContent(content)) { console.error(`${label}: ${path.relative(root, p)}`); failures++; }
  }
}
walk(root);
if (failures) process.exitCode = 1;
else console.log(`Public-source scan passed (${inspected} files; build archives are inspected separately).`);
