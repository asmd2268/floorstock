import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const functionsDir = path.join(root, 'functions');
const sources = ['index.js', 'crash-cart-report.js'];
const seen = new Map();
const failures = [];

for (const file of sources) {
  const source = fs.readFileSync(path.join(functionsDir, file), 'utf8');
  for (const match of source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=\s*/g)) {
    const name = match[1];
    if (seen.has(name)) failures.push(`${name}: exported by ${seen.get(name)} and ${file}`);
    seen.set(name, file);
  }
}

for (const file of fs.readdirSync(functionsDir).filter((name) => name.endsWith('-core.js'))) {
  const source = fs.readFileSync(path.join(functionsDir, file), 'utf8');
  if (/exports\.[A-Za-z_$][\w$]*\s*=/.test(source)) failures.push(`${file}: core file publishes a Firebase function`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: Firebase export audit (${seen.size} deployed functions, ${sources.length} adapters)`);
}
