import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const root = process.cwd();
const publicDir = path.join(root, 'public');
// auth-bootstrap is the canonical browser entrypoint: it binds sign-in before
// the larger application graph is evaluated, which keeps Safari responsive.
const entry = path.join(publicDir, 'assets/js/auth-bootstrap.js');
const errors = [];

function read(file) { return fs.readFileSync(file, 'utf8'); }
function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(from), specifier.split('?')[0].split('#')[0]);
}

const visited = new Set();
function inspect(file) {
  if (visited.has(file)) return;
  visited.add(file);
  if (!fs.existsSync(file)) { errors.push(`Missing module: ${path.relative(root, file)}`); return; }
  let program;
  try { program = parse(read(file), { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch (error) { errors.push(`Module parse failed: ${path.relative(root, file)}: ${error.message}`); return; }
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration') continue;
    if (!node.source?.value) continue;
    const target = resolveImport(file, node.source.value);
    if (target) inspect(target);
  }
  // auth-bootstrap loads the application graph after binding the login action.
  // Acorn does not expose that string as a static ImportDeclaration, so follow
  // local dynamic imports as part of verification too.
  for (const match of read(file).matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    const target = resolveImport(file, match[1]);
    if (target) inspect(target);
  }
}

inspect(entry);
const html = read(path.join(publicDir, 'index.html'));
const assetScripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
  .filter((match) => match[2].includes('assets/js/'));
const appScripts = assetScripts.filter((match) => /\btype=["']module["']/.test(match[1] || ''));
if (appScripts.length !== 1 || !/assets\/js\/auth-bootstrap\.js/.test(appScripts[0]?.[2] || '')) {
  errors.push('public/index.html must load exactly one ES-module application entrypoint.');
}
const qrVendorIndex = assetScripts.findIndex((match) => /assets\/js\/vendor\/qrcode-generator\.js/.test(match[2]));
const appIndex = assetScripts.findIndex((match) => /assets\/js\/auth-bootstrap\.js/.test(match[2]));
if (qrVendorIndex < 0 || appIndex < 0 || qrVendorIndex > appIndex) {
  errors.push('The local QR vendor must load before the ES-module application entrypoint.');
}
if (/\son[a-z]+\s*=/.test(html)) errors.push('Static inline event handlers remain in public/index.html.');
if (!/name=["']asdhealth-architecture["'][^>]*content=["']es-modules-v3["']|content=["']es-modules-v3["'][^>]*name=["']asdhealth-architecture["']/.test(html)) {
  errors.push('ES-module architecture marker is missing.');
}

const bindingsSource = read(path.join(publicDir, 'assets/js/core/event-bindings.js'));
const bindingsMatch = bindingsSource.match(/^export default\s+([\s\S]*);\s*$/);
if (!bindingsMatch) errors.push('Event binding module is malformed.');
else {
  const bindings = JSON.parse(bindingsMatch[1]);
  const ids = new Set([...html.matchAll(/data-asdh-binding=["']([^"']+)["']/g)].flatMap((match) => match[1].split(/\s+/)));
  for (const binding of bindings) if (!ids.has(binding.id)) errors.push(`Missing DOM binding target: ${binding.id}`);
  if (bindings.length < 200) errors.push(`Expected at least 200 migrated static handlers; found ${bindings.length}.`);
}

const required = ['doLogin', 'startApp', 'r17CrashExecuteBulk', 'renderMedicationAccountability', 'r664OpenSealCorrection', 'fsCanWriteStateKey'];
const sourceCorpus = [...visited].map(read).join('\n');
for (const name of required) if (!sourceCorpus.includes(name)) errors.push(`Required application action is missing: ${name}`);
if (visited.size < 63) errors.push(`Expected the full module graph; reached only ${visited.size} files.`);

if (errors.length) {
  console.error('FAIL: ES module verification');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`PASS: ${visited.size} ES-module files, import paths, ${appScripts.length} entrypoint, and DOM bindings verified.`);
