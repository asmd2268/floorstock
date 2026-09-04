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
 * `immutable` caching correct by construction. The chain is stamped bottom-up
 * so a change at any depth propagates to the top:
 *
 *   index.html                        no-store, always fresh
 *     -> css/*.css?v=<hash>
 *     -> vendor/qrcode-generator.js?v=<hash>
 *     -> auth-bootstrap.js?v=<hash>   (hash covers the main.js stamp inside it)
 *          -> main.js?v=<hash>        (hash covers every module stamp inside it)
 *               -> modules|core/*.js?v=<hash>
 *
 * Run before deploying. Idempotent: running it twice changes nothing.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const JS_DIR = join(PUBLIC, 'assets/js');
const MAIN = join(JS_DIR, 'main.js');
const BOOTSTRAP = join(JS_DIR, 'auth-bootstrap.js');
const PUBLIC_HTML = join(PUBLIC, 'index.html');
const ROOT_HTML = join(ROOT, 'index.html');

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const missing = [];
let stamped = 0;

/** Rewrite every `?v=` on paths matching `pathRe`, resolving them under `baseDir`. */
function stampRefs(text, pathRe, baseDir) {
  return text.replace(pathRe, (whole, prefix, relPath, suffix) => {
    const abs = join(baseDir, relPath);
    if (!existsSync(abs)) { missing.push(relPath); return whole; }
    const next = `${prefix}${relPath}?v=${hash(readFileSync(abs))}${suffix}`;
    if (next !== whole) stamped++;
    return next;
  });
}

// 1. Bare-relative imports inside main.js -> ./modules/*.js and ./core/*.js
writeFileSync(MAIN, stampRefs(
  readFileSync(MAIN, 'utf8'),
  /(['"]\.\/)((?:modules|core)\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g,
  JS_DIR
));

// 2. main.js is imported dynamically from auth-bootstrap.js; hash it after (1)
//    so the stamp covers the module versions just written.
writeFileSync(BOOTSTRAP, stampRefs(
  readFileSync(BOOTSTRAP, 'utf8'),
  /(['"]\.\/)(main\.js)(?:\?v=[^'"]*)?(['"])/g,
  JS_DIR
));

// 3. Everything index.html references directly, including auth-bootstrap.js
//    hashed after (2).
let html = stampRefs(
  readFileSync(PUBLIC_HTML, 'utf8'),
  /((?:src|href)="\.\/)(assets\/(?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g,
  PUBLIC
);

if (missing.length) {
  console.error('References point at files that do not exist:\n  ' + [...new Set(missing)].join('\n  '));
  process.exit(1);
}

writeFileSync(PUBLIC_HTML, html);
// Root mirror that CI compares against public/index.html.
writeFileSync(ROOT_HTML, html.replace(/\.\/assets\//g, './public/assets/'));

console.log(`stamped ${stamped} reference(s)`);
