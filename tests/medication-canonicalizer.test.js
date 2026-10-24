import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMedicationCanonicalizer } from '../public/assets/js/core/medication-canonicalizer.js';

/* The catalog and the normaliser are read from the real sources so this test
   fails if either drifts from what the canonicalizer is given. */
const crash = fs.readFileSync(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const helpers = fs.readFileSync(new URL('../public/assets/js/modules/03e-date-dialog-permission-helpers.js', import.meta.url), 'utf8');
const catalog = new Function('return ' + /var CCX_CATALOG=(\[[\s\S]*?\n\]);/.exec(crash)[1])();
const norm = new Function('window', 'return ' + /window\.fsMedNorm=(function\(value\)\{[^\n]*\});/.exec(helpers)[1])({});

/* The rule as it was before it was made fast: normalise the catalog per item. */
function oracle(itemOrName, strengthValue) {
  const item = (itemOrName && typeof itemOrName === 'object') ? itemOrName : { name: itemOrName, strength: strengthValue, concentration: strengthValue };
  const name = String(item.name || item.genericName || '').trim(); const strength = String(item.strength || item.concentration || strengthValue || '').trim();
  if (item.identityLocked === true) return { generic: name || 'Unknown', concentration: strength };
  const raw = norm(name + ' ' + strength); const nameRaw = norm(name); const strengthRaw = norm(strength); const compactName = nameRaw.replace(/\s+/g, '');
  if (compactName.indexOf('calciumchloride10%') === 0) return { generic: 'Calcium Chloride 10%', concentration: strength || '1g/10ml' };
  if (compactName.indexOf('calciumgluconate10%') === 0) return { generic: 'Calcium Gluconate 10%', concentration: strength || '1g/10ml' };
  if (compactName.indexOf('magnesiumsulfate10%') === 0 || compactName.indexOf('magnesiumsulphate10%') === 0) return { generic: 'Magnesium Sulfate 10%', concentration: strength || '2g/20ml' };
  if (/norepinephrine|noradrenaline|noradranaline/.test(raw) || ((/adrenaline|epinephrine/.test(raw)) && strengthRaw.indexOf('4mgml') >= 0)) return { generic: 'Norepinephrine 1:1,000', concentration: '4mg/ml' };
  if (nameRaw.indexOf(norm('Sodium Bicarbonate')) >= 0) {
    if (strengthRaw.indexOf(norm('4.2g/50ml')) >= 0 || nameRaw.indexOf(norm('8.4%')) >= 0) return { generic: 'Sodium Bicarbonate 8.4%', concentration: '4.2g/50ml' };
    if (strengthRaw.indexOf(norm('4.2g/10ml')) >= 0) return { generic: 'Sodium Bicarbonate', concentration: '4.2g/10ml' };
  }
  let found = null;
  catalog.some((x) => {
    const catalogName = norm(x.generic); const catalogCompact = catalogName.replace(/\s+/g, '');
    const exact = nameRaw === catalogName || compactName === catalogCompact;
    const alias = x.aliases.some((a) => { const an = norm(a); const ac = an.replace(/\s+/g, ''); return nameRaw === an || nameRaw.indexOf(an) === 0 || compactName === ac || compactName.indexOf(ac) === 0; });
    if (exact || alias) { found = x; return true; } return false;
  });
  if (found) return { generic: found.generic, concentration: strength || found.concentration || '' };
  return { generic: name || 'Unknown', concentration: strength };
}

const samples = [
  'Adrenaline (Epinephrine)', 'Epinephrine 1mg/ml', 'Adrenaline 4 mg/ml', 'Noradrenaline', 'Atropine Sulfate', 'Adenosine 6mg/2ml',
  'Calcium Chloride 10%', 'Calcium Gluconate 10 %', 'Magnesium Sulphate 10%', 'Sodium Bicarbonate 8.4%', 'Sodium Bicarbonate 4.2g/10ml',
  'Dextrose 50%', 'Glucose50', 'Amiodarone 150', 'Unknown thing', '', '  spaces  ', 'أدرينالين',
];

test('answers match the unoptimised rule for names, objects and strengths', () => {
  const canon = createMedicationCanonicalizer({ catalog, norm });
  for (const name of samples) {
    for (const strength of ['', '1mg/ml', '4mg/ml', '4.2g/50ml']) {
      assert.deepEqual(canon(name, strength), oracle(name, strength), name + '|' + strength);
      assert.deepEqual(canon({ name, strength }), oracle({ name, strength }), name + '|' + strength);
      assert.deepEqual(canon({ genericName: name, concentration: strength }), oracle({ genericName: name, concentration: strength }));
    }
  }
});

test('a locked identity is returned as typed, and answers are not shared between calls', () => {
  const canon = createMedicationCanonicalizer({ catalog, norm });
  assert.deepEqual(canon({ name: 'Adrenaline', strength: '4mg/ml', identityLocked: true }), { generic: 'Adrenaline', concentration: '4mg/ml' });
  const first = canon('Atropine', '');
  first.generic = 'changed';
  assert.equal(canon('Atropine', '').generic, 'Atropine');
});

test('the catalog is normalised once, not once per item', () => {
  let calls = 0;
  const counting = (v) => { calls += 1; return norm(v); };
  const canon = createMedicationCanonicalizer({ catalog, norm: counting });
  canon('Zzz unknown 1', ''); const afterFirst = calls;
  for (let i = 2; i < 52; i += 1) canon('Zzz unknown ' + i, '');
  assert.ok(calls - afterFirst <= 50 * 8, 'per-item work stays constant: ' + (calls - afterFirst));
});
