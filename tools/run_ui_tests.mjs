/* Runs every top-level test in tests/. The list used to be written out by hand in
   package.json, and a test that was not added to it simply never ran in CI: new
   tests were silently skipped until someone noticed. Listing the directory makes
   "it exists" and "it runs" the same thing. Sub-folders (browser, firestore-rules,
   integration) have their own scripts and are not picked up here. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const files = readdirSync(dir)
  .filter((name) => /\.test\.(c|m)?js$/.test(name))
  .sort()
  .map((name) => path.join('tests', name));

if (!files.length) {
  console.error('No tests found in tests/.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
