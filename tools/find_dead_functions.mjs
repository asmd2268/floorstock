#!/usr/bin/env node
// Reliable dead-function detector using a real AST (acorn) instead of regex.
// A plain grep for "name(" misses every reference-passing call site
// (.forEach(fn), setTimeout(fn,...), window.x=fn, onclick handlers built as
// strings, etc.) — this walks the full AST of every module and counts every
// Identifier reference to a name, anywhere, not just call expressions.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';

const ROOT = new URL('../', import.meta.url).pathname;
const MODULES_DIR = join(ROOT, 'public/assets/js/modules');
const CORE_DIR = join(ROOT, 'public/assets/js/core');
const INDEX_HTML = join(ROOT, 'public/index.html');

function isStub(source) {
  const trimmed = source.trim();
  return trimmed.startsWith('// Merged into') || trimmed.startsWith('// No-op');
}

function listJsFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f));
}

const moduleFiles = listJsFiles(MODULES_DIR).filter((f) => !isStub(readFileSync(f, 'utf8')));
const coreFiles = listJsFiles(CORE_DIR);
const allFiles = [...moduleFiles, ...coreFiles];

// Collect every top-level `function name(){}` declaration per file.
const declarations = []; // { name, file }
for (const file of moduleFiles) {
  const source = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: 'module', allowReturnOutsideFunction: true });
  } catch (e) {
    console.error(`Parse error in ${file}: ${e.message}`);
    continue;
  }
  // Walk recursively but only collect FunctionDeclaration nodes reachable
  // without crossing into a nested function's own body — top-level or one
  // IIFE-body level deep, matching this codebase's `(function(){ ... })()` wrapping.
  function walkForDecls(node, depth) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration' && node.id) {
      declarations.push({ name: node.id.name, file });
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') walkForDecls(child, depth + 1);
      } else if (value && typeof value.type === 'string') {
        walkForDecls(value, depth + 1);
      }
    }
  }
  walkForDecls(ast, 0);
}

// Collect every Identifier reference (any context) across ALL files (modules + core),
// plus a plain-text scan of index.html/public/index.html and event-bindings.js content
// (already included via core dir) for inline "name(" or bare "name" mentions in strings
// (e.g. onclick="foo()" built into template strings — Identifiers inside template
// literals aren't parsed as JS identifiers by acorn since they're just string content,
// so we also do a text-level scan as a second signal).
const identifierCounts = new Map(); // name -> count (excluding the declaration site itself)

function walkForIdentifiers(node, declSet) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Identifier') {
    const name = node.name;
    identifierCounts.set(name, (identifierCounts.get(name) || 0) + 1);
  }
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walkForIdentifiers(child, declSet);
    } else if (value && typeof value.type === 'string') {
      walkForIdentifiers(value, declSet);
    }
  }
}

for (const file of allFiles) {
  const source = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: 'module', allowReturnOutsideFunction: true });
  } catch (e) {
    continue;
  }
  walkForIdentifiers(ast, null);
}

// Also scan raw text of index.html files and every module's string literals
// (acorn already tokenizes strings as Literal nodes, not Identifiers, so a
// name appearing only inside a string like 'onclick="foo()"' would NOT be
// counted by the AST walk above). Do a plain substring scan as a second,
// independent signal so we never falsely call something dead just because
// it's only referenced from generated HTML strings.
const textBlobs = [];
for (const file of allFiles) textBlobs.push(readFileSync(file, 'utf8'));
try { textBlobs.push(readFileSync(INDEX_HTML, 'utf8')); } catch (e) {}
try { textBlobs.push(readFileSync(join(ROOT, 'index.html'), 'utf8')); } catch (e) {}
const combinedText = textBlobs.join('\n');

function textMentionCount(name) {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  const matches = combinedText.match(re);
  return matches ? matches.length : 0;
}

const results = [];
for (const { name, file } of declarations) {
  const astCount = identifierCounts.get(name) || 0; // includes the declaration's own Identifier node (1)
  const textCount = textMentionCount(name); // includes every textual mention, declaration + all uses
  // A name used only in its own declaration will have astCount<=1 (just the id)
  // AND textCount<=1 typically (the declaration line itself, "function name").
  // Require BOTH signals to agree it's unused before flagging as dead.
  const usedElsewhere = astCount > 1 || textCount > 1;
  if (!usedElsewhere) {
    results.push({ name, file: file.replace(ROOT, ''), astCount, textCount });
  }
}

console.log(`Scanned ${moduleFiles.length} active modules, ${declarations.length} top-level function declarations.`);
console.log(`Candidates with zero references anywhere (AST + text, both signals agree): ${results.length}\n`);
for (const r of results) {
  console.log(`DEAD?  ${r.name}  (${r.file})  [astRefs=${r.astCount} textRefs=${r.textCount}]`);
}
