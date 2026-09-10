/* Three questions about the whole application, answered by scanning rather than
   by memory:

   1. Which functions are declared and referenced nowhere — including from HTML,
      from the tests, and from the string lists that dispatch handlers by name?
      Those are dead: they cannot run, and they still have to be read by anyone
      changing the file around them.
   2. Which catch blocks swallow an error whole? Not all are wrong — plenty guard
      an optional feature — but each one is a place where something can fail with
      nothing on screen and nothing in the console.
   3. Which function names are declared in more than one file? A name with two
      definitions is two things to keep in step; the ones that matter are the
      ones that are the same fact written twice.

   `--strict` exits non-zero on any dead function, which is what the test uses. */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { walkAst, collectPublishedGlobals } from './lib/published-globals.mjs';

const dirs = ['public/assets/js/modules', 'public/assets/js/core'];
const files = [];
for (const d of dirs) for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) files.push(path.join(d, f));
files.push('public/assets/js/main.js', 'public/assets/js/auth-bootstrap.js');

const corpus = [];
for (const f of files) corpus.push([f, fs.readFileSync(f, 'utf8')]);
const htmlText = fs.readdirSync('public').filter((f) => f.endsWith('.html'))
  .map((f) => fs.readFileSync(path.join('public', f), 'utf8')).join('\n');
const testText = fs.readdirSync('tests').filter((f) => /\.(m?js|cjs)$/.test(f))
  .map((f) => fs.readFileSync(path.join('tests', f), 'utf8')).join('\n');

const declaredIn = new Map();   // name -> [files]
const silent = [];
for (const [file, src] of corpus) {
  let program;
  try { program = parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); } catch { continue; }
  walkAst(program, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id) {
      if (!declaredIn.has(node.id.name)) declaredIn.set(node.id.name, []);
      declaredIn.get(node.id.name).push(file);
    }
    if (node.type === 'CatchClause') {
      /* A catch that says WHY it is silent is not the problem: the problem is a
         failure with nothing behind it — no handling, no log, and no reason
         written down for the next person. A comment counts as a reason. */
      const inner = src.slice(node.body.start + 1, node.body.end - 1);
      if (!node.body.body.length && !/\/\*|\/\//.test(inner)) {
        silent.push(`${file}:${node.loc.start.line} empty catch`);
      }
    }
  });
}

const dead = [];
for (const [name, where] of declaredIn) {
  if (where.length > 1) continue;
  const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
  let uses = 0;
  for (const [file, src] of corpus) {
    const matches = src.match(re);
    if (!matches) continue;
    uses += file === where[0] ? matches.length - 1 : matches.length;   // minus its own declaration
  }
  if ((htmlText.match(re) || []).length) continue;
  if ((testText.match(re) || []).length) continue;
  if (uses <= 0) dead.push(`${where[0]}: ${name}`);
}

const duplicated = [...declaredIn].filter(([, where]) => new Set(where).size > 1)
  .map(([name, where]) => `${name}: ${[...new Set(where)].join(', ')}`);

console.log(`DEAD (declared, referenced nowhere): ${dead.length}`);
dead.forEach((d) => console.log('  ' + d));
console.log(`\nEMPTY CATCH blocks: ${silent.length}`);
silent.slice(0, 15).forEach((s) => console.log('  ' + s));
console.log(`\nSAME FUNCTION NAME IN MORE THAN ONE FILE: ${duplicated.length}`);
duplicated.slice(0, 25).forEach((d) => console.log('  ' + d));

if (process.argv.includes('--strict') && (dead.length || silent.length)) {
  if (dead.length) {
    console.error('\nDead code: delete it, or call it. A function nothing reaches is not "kept for later" — it is read by everyone who edits the file and run by nobody.');
  }
  if (silent.length) {
    console.error('\nA catch with nothing in it swallows a failure whole: no handling, no log, and no reason written down. Either report it (console.warn is enough for something the user cannot act on), or write one line saying why silence is correct here — storage that may be unavailable, an optional module that is not loaded, tearing down something already gone.');
  }
  process.exit(1);
}
