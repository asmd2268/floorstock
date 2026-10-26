import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* getMeds runs fsR17NormalizeMeds on every read and used to decide "did this row
   change" by serialising it before and after. It now compares the fields the
   normaliser writes. This test rebuilds the old rule around the real normaliser
   and keeps the two in agreement. */
const source = fs.readFileSync(new URL('../public/assets/js/modules/03c-medication-expiry-shelf-helpers.js', import.meta.url), 'utf8');
const start = source.indexOf("function fsR17Now()");
const end = source.indexOf('function getMeds(');
const api = new Function('var medNorm=function(v){return String(v||"").trim().toLowerCase()};var medIdentity=function(){};var nowISO=function(){return "2026-01-01T00:00:00.000Z"};'
  + source.slice(start, end) + '\nreturn {norm: fsR17NormalizeMed, rows: fsR17NormalizeMeds};')();

function oldRule(rows) {
  const ids = {};
  let changed = false;
  (Array.isArray(rows) ? rows : []).forEach((m, i) => {
    const before = JSON.stringify(m || {});
    const n = api.norm(m, i);
    while (ids[n.id]) n.id = n.medId = 'dup' + Math.random();
    ids[n.id] = 1;
    if (JSON.stringify(n) !== before) changed = true;
  });
  return changed;
}

const clean = (i) => ({ id: 'm' + i, medId: 'm' + i, name: 'Drug ' + i, currentName: 'Drug ' + i, aliases: [], sortOrder: (i + 1) * 100, createdAt: '2026-01-01T00:00:00.000Z', min: 1, max: 9 });

test('already-normalised rows are reported unchanged', () => {
  assert.equal(api.rows([0, 1, 2].map(clean)).changed, false);
  assert.equal(api.rows([]).changed, false);
  assert.equal(api.rows([Object.assign(clean(1), { aliases: ['Old name'] })]).changed, false);
});

test('a row the normaliser rewrites is reported changed', () => {
  const noMedId = clean(1); delete noMedId.medId;
  assert.equal(api.rows([noMedId]).changed, true);
  const noAliases = clean(1); delete noAliases.aliases;
  assert.equal(api.rows([noAliases]).changed, true);
  assert.equal(api.rows([Object.assign(clean(1), { sortOrder: '100' })]).changed, true);
  assert.equal(api.rows([Object.assign(clean(1), { name: '  Padded ' })]).changed, true);
  assert.equal(api.rows([Object.assign(clean(1), { aliases: ['Drug 1'] })]).changed, true);
  assert.equal(api.rows([null, clean(3)]).changed, true);
});

test('the field comparison agrees with the old serialise-and-compare rule', () => {
  let seed = 7;
  const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  const fields = ['id', 'medId', 'name', 'currentName', 'aliases', 'sortOrder', 'createdAt', 'min', 'extra'];
  for (let i = 0; i < 2000; i += 1) {
    const row = clean(next() % 5);
    fields.forEach((key) => {
      const r = next() % 8;
      if (r === 0) delete row[key];
      else if (r === 1) row[key] = next() % 3 ? String(next() % 9) : next() % 9;
      else if (r === 2) row[key] = null;
      else if (r === 3) row[key] = '  ';
      else if (r === 4 && key === 'aliases') row[key] = ['A', 'a', '', 'Drug 1', 5][next() % 5] === 'A' ? ['A', 'a'] : ['x', row.name];
    });
    const rows = JSON.parse(JSON.stringify([row]));
    // Rows get random ids when missing, so only compare when the ids are given.
    if (!row.id && !row.medId) continue;
    assert.equal(api.rows(JSON.parse(JSON.stringify(rows))).changed, oldRule(rows), JSON.stringify(row));
  }
});
