#!/usr/bin/env node
// Like map_module_dependencies.mjs, but for files structured as multiple
// top-level IIFEs (each `(function(){...})()` at ast.body level) rather than
// one flat list of top-level declarations. For each IIFE, walks INTO its
// body to find declarations, then checks whether any Identifier reference
// inside one IIFE resolves to a name declared in a DIFFERENT IIFE (which
// would mean they're not actually independent — only window.* / global
// communication between them is safe to assume by default).
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node tools/map_iife_dependencies.mjs <path-to-module.js>');
  process.exit(1);
}

const source = readFileSync(target, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: 'module', allowReturnOutsideFunction: true });

function lineOf(pos) { return source.slice(0, pos).split('\n').length; }

// Identify each top-level "IIFE-like" statement: an ExpressionStatement whose
// expression is a CallExpression with a FunctionExpression callee (with or
// without arguments), OR a plain top-level function/var declaration (treated
// as its own singleton "IIFE" of size 1 for uniformity).
const iifes = [];
for (const stmt of ast.body) {
  if (
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'CallExpression' &&
    (stmt.expression.callee.type === 'FunctionExpression')
  ) {
    iifes.push({ node: stmt.expression.callee, kind: 'iife', start: stmt.start, end: stmt.end });
  } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'VariableDeclaration') {
    iifes.push({ node: stmt, kind: 'top-level', start: stmt.start, end: stmt.end });
  }
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walk(child, visit);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

// For each IIFE, collect the names it declares at ITS OWN top level (function
// declarations + var/let/const directly in its body, not nested deeper).
function ownDeclarations(iife) {
  const names = new Set();
  const body = iife.node.body && iife.node.body.body ? iife.node.body.body : (iife.node.declarations ? [iife.node] : []);
  const stmts = iife.kind === 'iife' ? iife.node.body.body : [iife.node];
  for (const stmt of stmts) {
    if (stmt.type === 'FunctionDeclaration' && stmt.id) names.add(stmt.id.name);
    else if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) if (decl.id && decl.id.type === 'Identifier') names.add(decl.id.name);
    }
  }
  return names;
}

const iifeInfo = iifes.map((iife, i) => ({
  index: i,
  lineStart: lineOf(iife.start),
  lineEnd: lineOf(iife.end),
  declares: ownDeclarations(iife),
  node: iife.kind === 'iife' ? iife.node.body : iife.node,
}));

const allDeclaredNames = new Map(); // name -> iife index (first one that declares it)
iifeInfo.forEach((info) => { for (const name of info.declares) if (!allDeclaredNames.has(name)) allDeclaredNames.set(name, info.index); });

// For each IIFE, find every Identifier reference and check if it resolves to
// a name declared by a DIFFERENT iife (cross-IIFE bare-identifier coupling).
const crossRefs = []; // { from, to, name }
iifeInfo.forEach((info) => {
  const seen = new Set();
  walk(info.node, (node) => {
    if (node.type === 'Identifier' && allDeclaredNames.has(node.name)) {
      const declaredIn = allDeclaredNames.get(node.name);
      if (declaredIn !== info.index && !info.declares.has(node.name)) {
        const key = declaredIn + ':' + node.name;
        if (!seen.has(key)) { seen.add(key); crossRefs.push({ from: info.index, to: declaredIn, name: node.name }); }
      }
    }
  });
});

console.log(`File: ${target}`);
console.log(`Top-level IIFEs / statements: ${iifeInfo.length}\n`);
iifeInfo.forEach((info) => {
  console.log(`[${info.index}] lines ${info.lineStart}-${info.lineEnd}, declares ${info.declares.size} names`);
});
console.log(`\nCross-IIFE bare-identifier references (coupling): ${crossRefs.length}`);
crossRefs.forEach((ref) => {
  console.log(`  IIFE[${ref.from}] (lines ${iifeInfo[ref.from].lineStart}-${iifeInfo[ref.from].lineEnd}) references '${ref.name}' declared in IIFE[${ref.to}] (lines ${iifeInfo[ref.to].lineStart}-${iifeInfo[ref.to].lineEnd})`);
});
