/* Delegated-action handlers must be registered by the scope that owns them.

   Several modules are merges of legacy files and are physically a sequence of
   sibling IIFEs. A name declared in one IIFE is invisible to the next, but
   `installActions(root, { act: () => doThing() })` still PARSES — the
   ReferenceError only fires when a user clicks the button, months later, on
   one screen, for one role. That is how the print filter bar died: its
   handler was registered from a sibling scope, so every click threw and
   renderPrintTable aborted on the same broken reference.

   This check reads each module, maps its top-level IIFE ranges, and for every
   name a handler body calls, asserts the name is reachable from the scope the
   installActions call sits in: declared in that same IIFE, declared at module
   top level, imported, or assigned onto window/globalThis anywhere in the
   bundle (bare-name lookup falls through to the global object). */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../public/assets/js/', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

/* Global names are reachable by bare identifier from any scope. Collect every
   window./globalThis. assignment in the bundle, plus Object.assign(globalThis,
   {...}) blocks, which several core files use to publish helpers. */
function collectGlobals(files) {
  const globals = new Set();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) globals.add(m[1]);
    for (const m of src.matchAll(/Object\.assign\(\s*globalThis\s*,\s*\{([^}]*)\}/g)) {
      for (const n of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*[,:}]/g)) globals.add(n[1]);
    }
  }
  return globals;
}

/* Top-level IIFE ranges: a line that is exactly `(function(){` opens one and a
   line that starts `})();` closes it. Nested functions are indented, so the
   column-0 anchor is what distinguishes a sibling scope from an inner one. */
function iifeRanges(lines) {
  const ranges = [];
  let open = null;
  lines.forEach((line, i) => {
    if (/^\(function\s*\(\s*\)\s*\{/.test(line)) open = i;
    else if (/^\}\)\(\);/.test(line) && open !== null) { ranges.push([open, i]); open = null; }
  });
  return ranges;
}

function scopeOf(lineIndex, ranges) {
  for (const [a, b] of ranges) if (lineIndex >= a && lineIndex <= b) return `${a}-${b}`;
  return 'top';
}

/* Declarations anchored at the start of a line: function foo, var foo=, let/const. */
function declarations(lines, ranges) {
  const byName = new Map();
  lines.forEach((line, i) => {
    const m = /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=)/.exec(line);
    if (!m) return;
    const name = m[1] || m[2];
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(scopeOf(i, ranges));
  });
  return byName;
}

function importedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  return names;
}

const files = walk(ROOT);
const globals = collectGlobals(files);
const problems = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('installActions(')) continue;
  const lines = src.split('\n');
  const ranges = iifeRanges(lines);
  if (!ranges.length) continue; // single-scope file: nothing to cross
  const decls = declarations(lines, ranges);
  const imported = importedNames(src);

  lines.forEach((line, i) => {
    if (!line.includes('installActions(')) return;
    const scope = scopeOf(i, ranges);
    /* Names a handler body calls: `foo(` inside the map, minus locals and
       member calls. This is deliberately coarse — it over-reports rather than
       letting a real ReferenceError through. */
    for (const m of line.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = m[1];
      if (['installActions', 'function', 'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof'].includes(name)) continue;
      if (imported.has(name)) continue;
      if (globals.has(name)) continue;
      const scopes = decls.get(name);
      if (!scopes) continue;             // not declared in this file at all
      if (scopes.has(scope) || scopes.has('top')) continue;
      problems.push(`${file.replace(ROOT, '')}:${i + 1}  handler "${name}" is declared in scope ${[...scopes].join(',')} but registered from scope ${scope} — clicking it throws ReferenceError`);
    }
  });
}

/* ── Check 2: an attribute nobody registered ──────────────────────────────
   installActions silently returns when a name has no handler (`typeof handler
   !== 'function'`), so a misspelt or never-registered data-act value is a
   button that does nothing, with no error anywhere. */
const markupFiles = [...files, join(ROOT, '../../index.html')];

function objectKeysAt(src, open) {
  let depth = 0, close = open;
  while (close < src.length) {
    const c = src[close];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) break; }
    close++;
  }
  const body = src.slice(open + 1, close);
  const keys = [];
  for (const m of body.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) {
    const before = body.slice(0, m.index);
    const bal = (s, a, b) => s.split(a).length - s.split(b).length;
    if (bal(before, '{', '}') === 0 && bal(before, '[', ']') === 0 && bal(before, '(', ')') === 0) keys.push(m[1]);
  }
  return { keys, close };
}

const registeredByAttr = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/installActions\(/g)) {
    const open = src.indexOf('{', m.index + m[0].length);
    if (open < 0) continue;
    const { keys, close } = objectKeysAt(src, open);
    const attr = (/attribute:\s*'([^']+)'/.exec(src.slice(close, close + 200)) || [, 'act'])[1];
    if (!registeredByAttr.has(attr)) registeredByAttr.set(attr, new Set());
    for (const k of keys) registeredByAttr.get(attr).add(k);
  }
}

for (const file of markupFiles) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  const seen = new Set();
  for (const m of src.matchAll(/data-(clickact|changeact|inputact|keydownact|act)=\\?["']([A-Za-z_$][\w$]*)/g)) seen.add(`${m[1]}\u0000${m[2]}`);
  for (const m of src.matchAll(/dataset\.(clickact|changeact|inputact|keydownact|act)\s*=\s*['"]([A-Za-z_$][\w$]*)/g)) seen.add(`${m[1]}\u0000${m[2]}`);
  for (const entry of seen) {
    const [attr, name] = entry.split('\u0000');
    if (!(registeredByAttr.get(attr) || new Set()).has(name)) {
      problems.push(`${file.replace(ROOT, '')}  data-${attr}="${name}" has no registered handler — the control silently does nothing`);
    }
  }
}

/* ── Check 3: an argument that kept its quotes ────────────────────────────
   Converting `onclick="CM('mctlbatches')"` by hand leaves
   `data-a1="'mctlbatches'"`, so the handler runs but receives "'mctlbatches'"
   and looks up an element that does not exist. A real value is either a plain
   literal or a JS concatenation, which always reads data-aN="'+ — a quote NOT
   followed by + is the botched form. Two Cancel buttons shipped dead this way. */
for (const file of markupFiles) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/data-a\d+=\\?"'(?!\+)([^"']*)/g)) {
      problems.push(`${file.replace(ROOT, '')}:${i + 1}  data-a…="'${m[1]}'" keeps its literal quotes — the handler receives the quotes as part of the value`);
    }
  });
}

if (problems.length) {
  console.error('FAIL: delegated-action wiring is broken:\n');
  for (const p of problems) console.error('  ' + p);
  console.error(`\n${problems.length} problem(s).`);
  console.error('Register each name from the IIFE that declares it — installActions merges by name onto one listener.');
  process.exit(1);
}

console.log('PASS: delegated-action handlers are in reachable scopes, every attribute has a handler, and no argument kept its quotes.');
