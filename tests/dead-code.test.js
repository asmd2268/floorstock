import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function audit(...args) {
  return execFileSync('node', ['tools/audit_dead_code.mjs', ...args], { cwd: root, encoding: 'utf8' });
}

test('no function is declared and reached by nothing', () => {
  /* Twenty-five were, when this was first run: a whole department-receipt
     renderer, two one-off data repairs, a print helper, several exported
     store functions nobody imported. Dead code is read by everyone who edits
     the file around it and run by nobody. */
  const report = audit('--strict');
  assert.match(report, /DEAD \(declared, referenced nowhere\): 0/);
});

test('the audit counts a reference from HTML, a test, or a name list', () => {
  /* Handlers are dispatched by name from strings in this project, so a scan
     that only followed real references would call live code dead. */
  const source = execFileSync('cat', ['tools/audit_dead_code.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(source, /htmlText/);
  assert.match(source, /testText/);
});
