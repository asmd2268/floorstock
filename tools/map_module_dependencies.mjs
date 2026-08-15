#!/usr/bin/env node
// Build a cross-reference graph for every top-level declaration in a single
// module: for each top-level function/var, which OTHER top-level names does
// its body reference? This is the prerequisite for safely splitting a large
// file — a naive line-range split would separate functions that call each
// other via bare (same-module-scope) identifiers, breaking at runtime with
// no compile-time error (ES modules don't hoist across files).
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node tools/map_module_dependencies.mjs <path-to-module.js>');
  process.exit(1);
}

const source = readFileSync(target, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: 'module', allowReturnOutsideFunction: true });

// Collect top-level declaration names (function declarations and top-level
// var/let/const identifiers) with their node and a rough line number.
const topLevelNames = new Map(); // name -> { node, kind, line }

function lineOf(node) {
  return source.slice(0, node.start).split('\n').length;
}

for (const stmt of ast.body) {
  if (stmt.type === 'FunctionDeclaration' && stmt.id) {
    topLevelNames.set(stmt.id.name, { node: stmt, kind: 'function', line: lineOf(stmt) });
  } else if (stmt.type === 'VariableDeclaration') {
    for (const decl of stmt.declarations) {
      if (decl.id && decl.id.type === 'Identifier') {
        topLevelNames.set(decl.id.name, { node: stmt, kind: 'var', line: lineOf(stmt) });
      }
    }
  }
}

const names = new Set(topLevelNames.keys());

// For each top-level declaration, walk its own subtree and collect every
// Identifier reference to another top-level name (excluding itself).
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

const dependsOn = new Map(); // name -> Set of names it references
for (const [name, info] of topLevelNames) {
  const refs = new Set();
  walk(info.node, (node) => {
    if (node.type === 'Identifier' && node.name !== name && names.has(node.name)) {
      refs.add(node.name);
    }
  });
  dependsOn.set(name, refs);
}

// Union-Find to compute connected components (mutual reference clusters).
const parent = new Map();
function find(x) { while (parent.get(x) !== x) x = parent.set(x, parent.get(parent.get(x))).get(x); return x; }
// Simpler iterative find without path-compression trickiness above:
function findSimple(x) { let root = x; while (parent.get(root) !== root) root = parent.get(root); while (parent.get(x) !== root) { const next = parent.get(x); parent.set(x, root); x = next; } return root; }
for (const name of names) parent.set(name, name);
function union(a, b) { const ra = findSimple(a), rb = findSimple(b); if (ra !== rb) parent.set(ra, rb); }
for (const [name, refs] of dependsOn) for (const ref of refs) union(name, ref);

const clusters = new Map(); // root -> [names]
for (const name of names) {
  const root = findSimple(name);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push(name);
}

const sortedClusters = [...clusters.values()].sort((a, b) => b.length - a.length);

console.log(`File: ${target}`);
console.log(`Top-level declarations: ${names.size}`);
console.log(`Connected components (mutually-isolated clusters): ${sortedClusters.length}\n`);

sortedClusters.forEach((cluster, i) => {
  cluster.sort((a, b) => topLevelNames.get(a).line - topLevelNames.get(b).line);
  const lineRange = `${topLevelNames.get(cluster[0]).line}-${topLevelNames.get(cluster[cluster.length - 1]).line}`;
  console.log(`Cluster ${i + 1}: ${cluster.length} names, lines ${lineRange}`);
  if (process.argv[3] === '--verbose') {
    console.log('  ' + cluster.join(', '));
  }
  console.log('');
});
