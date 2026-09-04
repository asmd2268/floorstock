#!/usr/bin/env node
/**
 * Content-addressed cache stamping.
 *
 * Every asset is requested with a `?v=` query string, and those strings were
 * maintained by hand — an edit that forgot to bump one would be served stale
 * forever under a long cache lifetime. That is why the assets had to stay on
 * `must-revalidate`, paying a conditional request per file on every page open
 * (112 of them, ~3.7s of round trips on a high-latency link).
 *
 * This derives each `?v=` from a hash of the file's own bytes, so a URL changes
 * exactly when its content changes and never when it doesn't, which makes
 * `immutable` caching correct by construction.
 *
 * Imports nest several levels deep (main.js -> a module -> core/legacy-registry.js),
 * and a file's hash depends on the stamps written inside it, so stamping is
 * iterated to a fixed point rather than done in a single pass: repeat until no
 * URL changes, at which point every stamp in the graph is consistent with the
 * bytes it names. The HTML is stamped last and is itself never cached.
 *
 * Run before deploying (`npm run stamp`, also a firebase predeploy hook).
 * Idempotent: running it twice changes nothing.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const JS_DIR = join(PUBLIC, 'assets/js');
const PUBLIC_HTML = join(PUBLIC, 'index.html');
const ROOT_HTML = join(ROOT, 'index.html');
const MAX_PASSES = 25;

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

const jsFiles = walk(JS_DIR);
const missing = new Set();

// Module specifiers, matched only inside real import/export statements. A plain
// quoted "./…js" is not enough: module 51 builds a runtime URL from the string
// './assets/js/print-orders-runtime.js', which is relative to the page, not to
// the module, and resolving it module-relative would point at a nonexistent file.
const SPECIFIER_RES = [
  /(\b(?:import|export)\b[^;'"()]*?\bfrom\s*)(['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[^'"]*)?\2/g,
  /(\bimport\s*)(['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[^'"]*)?\2/g,
  /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[^'"]*)?\2/g,
];
// Asset URLs written for the page rather than the module, e.g. the runtime URL
// above. These resolve against public/ and still need stamping.
const PAGE_URL_RE = /(['"])(\.?\/assets\/js\/[^'"?]+\.js)(?:\?v=[^'"]*)?\1/g;

/** One pass over every JS file. Returns how many files changed. */
function pass() {
  let changed = 0;
  for (const file of jsFiles) {
    const src = readFileSync(file, 'utf8');
    let next = src;

    for (const re of SPECIFIER_RES) {
      next = next.replace(re, (whole, lead, quote, spec) => {
        const target = resolve(dirname(file), spec);
        if (!existsSync(target)) { missing.add(`${relative(ROOT, file)} -> ${spec}`); return whole; }
        return `${lead}${quote}${spec}?v=${hash(readFileSync(target))}${quote}`;
      });
    }

    next = next.replace(PAGE_URL_RE, (whole, quote, spec) => {
      const target = join(PUBLIC, spec.replace(/^\.?\//, ''));
      if (!existsSync(target)) { missing.add(`${relative(ROOT, file)} -> ${spec}`); return whole; }
      return `${quote}${spec}?v=${hash(readFileSync(target))}${quote}`;
    });

    if (next !== src) { writeFileSync(file, next); changed++; }
  }
  return changed;
}

let passes = 0;
let changedFiles = 0;
for (; passes < MAX_PASSES; passes++) {
  const n = pass();
  changedFiles += n;
  if (n === 0) break;
}
if (passes === MAX_PASSES) {
  console.error(`Stamps did not stabilise after ${MAX_PASSES} passes (import cycle?).`);
  process.exit(1);
}

// The HTML references entrypoints directly and is served no-store, so it is
// stamped once the graph below it has settled.
let stampedInHtml = 0;
const html = readFileSync(PUBLIC_HTML, 'utf8').replace(
  /((?:src|href)="\.\/)(assets\/(?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g,
  (whole, prefix, rel, suffix) => {
    const target = join(PUBLIC, rel);
    if (!existsSync(target)) { missing.add(`public/index.html -> ${rel}`); return whole; }
    const next = `${prefix}${rel}?v=${hash(readFileSync(target))}${suffix}`;
    if (next !== whole) stampedInHtml++;
    return next;
  }
);

if (missing.size) {
  console.error('References point at files that do not exist:\n  ' + [...missing].join('\n  '));
  process.exit(1);
}

writeFileSync(PUBLIC_HTML, html);
// Root mirror that CI compares against public/index.html.
writeFileSync(ROOT_HTML, html.replace(/\.\/assets\//g, './public/assets/'));

console.log(`settled in ${passes + 1} pass(es); ${changedFiles} file(s) restamped, ${stampedInHtml} html reference(s)`);
