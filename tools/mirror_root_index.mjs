#!/usr/bin/env node
/* Regenerates the root index.html from public/index.html.
   The application is deployed twice: Firebase Hosting serves public/ as the web
   root, Vercel serves the repository root. The two entry documents are identical
   apart from the asset prefix, and were previously kept in sync by hand — two
   110 KB files that must never diverge, with the discipline living outside the
   repository. Run from `npm run stamp`; asserted by tests/root-index-mirror.test.js. */
import { readFile, writeFile } from 'node:fs/promises';

const publicIndex = new URL('../public/index.html', import.meta.url);
const rootIndex = new URL('../index.html', import.meta.url);

export function mirrorRootIndex(source) {
  return source.replace(/(["'])\.\/assets\//g, '$1./public/assets/');
}

const source = await readFile(publicIndex, 'utf8');
const mirrored = mirrorRootIndex(source);
const current = await readFile(rootIndex, 'utf8').catch(() => '');
if (current === mirrored) {
  console.log('Root index.html mirror already current.');
} else {
  await writeFile(rootIndex, mirrored, 'utf8');
  console.log('Root index.html mirror regenerated from public/index.html.');
}
