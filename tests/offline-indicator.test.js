import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* The service worker serves the last good document when the network is gone,
   which is what makes the app usable offline. But on screen an offline copy is
   identical to a live one, so someone reading stock numbers cannot tell they may
   be stale — and during development a stopped server looked exactly like a
   running one, which cost real debugging time. */

const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const register = await readFile(new URL('../public/assets/js/register-sw.js', import.meta.url), 'utf8');

test('the document stays network-first so a deploy is always picked up', () => {
  // Assets are content-hashed and therefore safe to serve cache-first; the HTML
  // is the version pointer and must not be.
  const htmlBranch = sw.slice(sw.indexOf('if (isHtmlRequest(req, url))'), sw.indexOf("url.pathname.indexOf('/assets/')"));
  assert.match(htmlBranch, /fetch\(req\)\.then/, 'HTML is fetched first');
  assert.match(htmlBranch, /\.catch\(function \(\) \{[\s\S]*caches\.match\(OFFLINE_DOC\)/, 'cache is only the fallback');
});

test('a cached document is marked as such', () => {
  assert.match(sw, /headers\.set\('X-Floorstock-Offline', '1'\)/);
  // The cached body must still be returned, not replaced.
  assert.match(sw, /new Response\(cached\.body, \{ status: cached\.status/);
});

test('the banner appears only while offline and clears itself', () => {
  assert.match(register, /navigator\.onLine === false\) showBanner\(\);/);
  assert.match(register, /else removeBanner\(\);/);
  assert.match(register, /window\.addEventListener\('online', sync\)/);
  assert.match(register, /window\.addEventListener\('offline', sync\)/);
  // Driven by connectivity rather than the response header, because a document
  // restored from the back/forward cache never re-enters the worker.
  assert.match(register, /role', 'status'/, 'the banner is announced to assistive tech');
});

test('the banner cannot be hidden behind the app chrome', () => {
  assert.match(register, /position:fixed;left:0;right:0;top:0;z-index:2147483647/);
});
