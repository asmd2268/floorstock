/* Every control a user can see, and whether pressing it can only tell them no.

   The failure this hunts is one the user reported twice: a button that is on
   screen for a role, and whose handler's first act is to refuse that role. From
   the person's side the system is broken — the control is there, it does
   nothing but scold. Either the control should not be there, or the refusal
   should not be.

   The scan pairs each action with:
     - where it is invoked from (a DOM binding, or an onclick this project
       generates inside a template string),
     - whether its handler starts by refusing,
     - and whether the markup that renders the control is itself gated by a
       permission check on the same line.

   A control whose markup is gated is fine: the refusal is the second lock on a
   door that is already hidden. A control rendered unconditionally whose handler
   refuses is the bug. */

import fs from 'node:fs';
import path from 'node:path';

const dirs = ['public/assets/js/modules', 'public/assets/js/core'];
const files = [];
for (const dir of dirs) for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) files.push(path.join(dir, f));
const sources = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const html = fs.readFileSync('public/index.html', 'utf8');

/* A handler that refuses: the first statement returns a toast about permission. */
const REFUSAL = /(No permission|Not authorized|No .{0,30}permission|Master only|permission required|صلاحية|غير مصرح|Only the|not authorized)/i;

/* Names invoked from an onclick this project writes into generated markup. */
const invocations = new Map();  // action -> [{file, line, gatedInline}]
for (const [file, src] of sources) {
  src.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/onclick=\\?["']([A-Za-z_$][\w$]*)\(/g)) {
      const name = match[1];
      if (!invocations.has(name)) invocations.set(name, []);
      /* Rendered behind a check on the same line: `can…() ? '<button…' : ''`. */
      const gatedInline = /can[A-Z]\w*\(\)|isMaster\w*\(\)|\bmaster\(\)|CU\.master===true|Allowed\(\)|permission\(/.test(line);
      invocations.get(name).push({ file, line: index + 1, gatedInline });
    }
  });
}
/* Bindings declared in the page itself are always rendered. */
for (const match of html.matchAll(/data-asdh-binding="([^"]+)"/g)) {
  for (const id of match[1].split(/\s+/)) {
    if (!invocations.has('binding:' + id)) invocations.set('binding:' + id, []);
    invocations.get('binding:' + id).push({ file: 'public/index.html', line: 0, gatedInline: false });
  }
}
const bindings = JSON.parse(
  fs.readFileSync('public/assets/js/core/event-bindings.js', 'utf8').match(/^export default\s+([\s\S]*);\s*$/m)[1],
);
for (const binding of bindings) {
  const name = (binding.source.match(/^([A-Za-z_$][\w$]*)\(/) || [])[1];
  if (!name) continue;
  if (!invocations.has(name)) invocations.set(name, []);
  invocations.get(name).push({ file: `binding ${binding.id}`, line: 0, gatedInline: false });
}

/* Where each action is defined, and whether it opens by refusing. */
function findHandler(name) {
  for (const [file, src] of sources) {
    const re = new RegExp(`(?:window\\.${name}\\s*=\\s*(?:async\\s*)?function|function\\s+${name}\\s*\\()`);
    const m = re.exec(src);
    if (!m) continue;
    const body = src.slice(m.index, src.indexOf('\n', m.index + 400) + 1 || m.index + 900);
    const head = body.slice(0, 700);
    const refuses = REFUSAL.test(head) && /return\s+(?:toast|uiToast|piToast|fsR5Toast)/.test(head);
    return { file, refuses, head };
  }
  return null;
}

const findings = [];
for (const [name, sites] of invocations) {
  if (name.startsWith('binding:')) continue;
  const handler = findHandler(name);
  if (!handler || !handler.refuses) continue;
  const ungated = sites.filter((site) => !site.gatedInline);
  if (!ungated.length) continue;
  findings.push({ name, handler: handler.file, sites: ungated });
}

findings.sort((a, b) => a.handler.localeCompare(b.handler) || a.name.localeCompare(b.name));
console.log(`Controls that are rendered unconditionally and whose handler opens by refusing: ${findings.length}\n`);
for (const finding of findings) {
  console.log(`${finding.name}  (handler: ${finding.handler})`);
  for (const site of finding.sites.slice(0, 3)) console.log(`    from ${site.file}${site.line ? ':' + site.line : ''}`);
}
