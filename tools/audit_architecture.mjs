import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const coreDir = path.join(root, 'public/assets/js/core');
const modulesDir = path.join(root, 'public/assets/js/modules');
const failures = [];

for (const file of fs.readdirSync(coreDir).filter((name) => name.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(coreDir, file), 'utf8');
  if (/from ['"](?:\.\/|\.\.\/)?modules\//.test(source)) {
    failures.push(`${file}: core module imports a feature module`);
  }
}

const entry = fs.readFileSync(path.join(root, 'public/assets/js/main.js'), 'utf8');
const imports = [...entry.matchAll(/import ['"]([^'"]+)['"]/g)].map((match) => match[1]);
if (new Set(imports).size !== imports.length) failures.push('main.js contains duplicate imports');
if (imports.length === 0) failures.push('main.js has no feature imports');

// Feature modules intentionally publish legacy UI contracts while they are
// being migrated. New core modules are the strict boundary; feature globals
// are reported by the existing wrapper-integrity tests.

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: architecture audit (${imports.length} entrypoint imports, ${fs.readdirSync(coreDir).filter((name) => name.endsWith('.js')).length} core modules)`);
}
