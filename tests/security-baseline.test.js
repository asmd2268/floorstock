import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('Firestore rules contain no unauthenticated global reads or writes', () => {
  assert.doesNotMatch(rules, /allow\s+(read|write):\s*if\s+true\s*;/i);
  assert.doesNotMatch(rules, /allow\s+write:\s*if\s+signedIn\(\)\s*;/i);
  assert.match(rules, /match \/public_crash_carts\/{docId\}/);
  assert.match(rules, /allow\s+(create|update|delete|write):\s*if[\s\S]{0,120}masterUser\(\)/);
});

test('state writes are shape-validated and role-gated', () => {
  assert.match(rules, /function validStateShape\(\)/);
  assert.match(rules, /validStateShape\(\)/);
  assert.match(rules, /function canWriteState\(docId\)/);
  assert.match(rules, /canWriteState\(docId\)/);
});
