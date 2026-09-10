/* Catches the failure that split modules keep producing: a module that calls a
   name nobody defines any more.

   When a block moves out of a legacy module, the block's helpers move with it —
   and every call left behind becomes a bare identifier that parses fine, passes
   every source-text test, and throws ReferenceError the first time a user clicks
   the button. Two of those shipped: `fsR5DepartmentRecords` after the department
   names moved out, and `fsR5Esc`, which had been dead in the printed custody
   sheet long enough that nobody could print a batch line at all.

   The check is deliberately conservative — declarations are collected flat, with
   no scope analysis, so an inner binding shadowing an outer one can only hide a
   problem, never invent one. Anything it reports is genuinely undefined. */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

import { collectPublishedGlobals, walkAst as walk } from './lib/published-globals.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
/* `--entry <file>` lets the test point the same walk at a fixture, so proving
   the check can fail never means editing a real module. */
const entryFlag = process.argv.indexOf('--entry');
const entry = entryFlag >= 0
  ? path.resolve(root, process.argv[entryFlag + 1])
  : path.join(publicDir, 'assets/js/auth-bootstrap.js');

/* Names that exist without anyone in this repository declaring them: the
   language, the browser, and the two vendor scripts index.html loads. */
const AMBIENT = new Set([
  'globalThis', 'window', 'document', 'navigator', 'location', 'history', 'screen', 'console',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask', 'structuredClone',
  'localStorage', 'sessionStorage', 'indexedDB', 'crypto', 'performance', 'caches', 'fetch',
  'alert', 'confirm', 'prompt', 'open', 'close', 'print', 'atob', 'btoa', 'matchMedia',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math', 'JSON', 'Date',
  'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Proxy', 'Reflect', 'Intl',
  'Function', 'Infinity', 'NaN', 'undefined', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
  'ArrayBuffer', 'DataView', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array',
  'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'TextEncoder', 'TextDecoder',
  'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData', 'Headers', 'Request',
  'Response', 'AbortController', 'AbortSignal', 'Event', 'CustomEvent', 'EventTarget',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'BroadcastChannel',
  'Worker', 'Image', 'Audio', 'Notification', 'HTMLElement', 'Node', 'NodeList', 'DOMParser',
  'XMLHttpRequest', 'WebSocket', 'CSS', 'getComputedStyle', 'scrollTo', 'postMessage',
  'arguments', 'self', 'top', 'parent', 'frames', 'name', 'origin', 'isSecureContext',
  'NodeFilter', 'BarcodeDetector', 'ClipboardItem', 'MediaStream',
  // Loaded on demand from a CDN by the loaders in core/, never bundled here.
  'firebase', 'qrcode', 'XLSX', 'pdfjsLib', 'ZXing', 'JSZip', 'html2canvas', 'jspdf',
]);

function read(file) { return fs.readFileSync(file, 'utf8'); }
function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(from), specifier.split('?')[0].split('#')[0]);
}

const files = [];
const seen = new Set();
function collect(file) {
  if (seen.has(file) || !fs.existsSync(file)) return;
  seen.add(file);
  const source = read(file);
  let program;
  try { program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch { return; }
  files.push({ file, source, program });
  for (const node of program.body) {
    if (!node.source?.value) continue;
    const target = resolveImport(file, node.source.value);
    if (target) collect(target);
  }
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    const target = resolveImport(file, match[1]);
    if (target) collect(target);
  }
}
collect(entry);

/* Every name a pattern binds: `const {a, b: [c] = d} = x` binds a, c. */
function bindings(pattern, out) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier': out.add(pattern.name); break;
    case 'ObjectPattern': for (const prop of pattern.properties) bindings(prop.value || prop.argument, out); break;
    case 'ArrayPattern': for (const element of pattern.elements) bindings(element, out); break;
    case 'AssignmentPattern': bindings(pattern.left, out); break;
    case 'RestElement': bindings(pattern.argument, out); break;
    default: break;
  }
}

/* Names this project puts on the global object, in all three of its forms, kept
   per file. A file may NOT satisfy its own reference by publishing it: a
   publishLegacy list naming a function that had been deleted is exactly the
   shape of break this check exists to catch, and `{ name }` in that list is a
   reference to a binding that has to exist here. */
const publishedByFile = new Map();
for (const { file, program } of files) publishedByFile.set(file, collectPublishedGlobals(program, new Set()));

const errors = [];
for (const { file, program } of files) {
  const declared = new Set();
  const referenced = new Map();
  /* A name the file asks about with `typeof x === 'function'` anywhere is an
     optional global by intent: the module knows it may be absent and chooses a
     fallback. Excluded file-wide, because the guard and the call are often in
     the same ternary rather than the same statement. */
  const guarded = new Set();
  walk(program, (node) => {
    if (node.type === 'UnaryExpression' && node.operator === 'typeof' && node.argument.type === 'Identifier') guarded.add(node.argument.name);
  });
  walk(program, (node) => {
    switch (node.type) {
      case 'FunctionDeclaration': case 'ClassDeclaration':
        if (node.id) declared.add(node.id.name);
        break;
      case 'FunctionExpression': case 'ArrowFunctionExpression':
        if (node.id) declared.add(node.id.name);
        break;
      case 'VariableDeclarator': bindings(node.id, declared); break;
      case 'CatchClause': bindings(node.param, declared); break;
      case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ImportSpecifier':
        declared.add(node.local.name); break;
      default: break;
    }
    if (node.params) for (const param of node.params) bindings(param, declared);
  });

  walk(program, (node) => {
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') node.property.__skip = true;
    /* `{ name }` is a REFERENCE, not just a key: skipping it hid a publishLegacy
       list still naming a function that had been deleted — the module threw at
       load and every browser test failed with "modules never became ready". */
    if (node.type === 'Property' && !node.computed && !node.shorthand && node.key.type === 'Identifier') node.key.__skip = true;
    if (node.type === 'MethodDefinition' && !node.computed && node.key?.type === 'Identifier') node.key.__skip = true;
    if (node.type === 'LabeledStatement' || node.type === 'BreakStatement' || node.type === 'ContinueStatement') {
      if (node.label) node.label.__skip = true;
    }
    if (node.type === 'ExportSpecifier') { node.exported.__skip = true; }
    if (node.type === 'ImportSpecifier' && node.imported) node.imported.__skip = true;
    // `import.meta` parses as a MetaProperty whose parts are Identifiers.
    /* `typeof maybeMissing === 'function'` is the legacy modules' own way of
       asking whether an optional global is loaded yet; it cannot throw, so it is
       a question, not a use. */
    if (node.type === 'UnaryExpression' && node.operator === 'typeof' && node.argument.type === 'Identifier') node.argument.__skip = true;
    if (node.type === 'MetaProperty') { node.meta.__skip = true; node.property.__skip = true; }
    if (node.type === 'Identifier' && !node.__skip && !referenced.has(node.name)) referenced.set(node.name, node);
  });

  /* `window.x = …` in THIS file creates a global this file may then call by its
     bare name. A publishLegacy shorthand does not: `{ x }` there reads a binding
     that must already exist here. */
  const assignedHere = new Set();
  walk(program, (node) => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed
      && node.left.object.type === 'Identifier'
      && (node.left.object.name === 'window' || node.left.object.name === 'globalThis')
      && node.left.property.type === 'Identifier') assignedHere.add(node.left.property.name);
  });
  const publishedElsewhere = (name) => {
    for (const [other, names] of publishedByFile) if (other !== file && names.has(name)) return true;
    return false;
  };
  for (const [name, node] of referenced) {
    if (declared.has(name) || assignedHere.has(name) || guarded.has(name) || AMBIENT.has(name) || publishedElsewhere(name)) continue;
    errors.push(`${path.relative(root, file)}:${node.loc?.start.line}: uses "${name}", which nothing in the module graph defines or publishes.`);
  }
}

if (errors.length) {
  console.error('FAIL: unresolved names\n' + errors.map((line) => '  - ' + line).join('\n'));
  process.exit(1);
}
console.log(`PASS: ${files.length} modules use no name the graph does not define.`);
