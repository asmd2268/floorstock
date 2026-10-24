/* Maps a crash cart item to its canonical generic name and concentration.

   The rule is unchanged from the version that lived in the crash cart module; what
   changed is the cost. It normalised every catalog name and every alias again for
   every item it was asked about, and the page asks several times per item (filter,
   sort comparator, row, summary), so opening Crash Carts spent most of its time
   re-normalising the same sixteen catalog entries. The catalog is normalised once
   here, and an answer is remembered by the three things it depends on. */

const CACHE_LIMIT = 2000;

export function createMedicationCanonicalizer({ catalog, norm }) {
  let prepared = null;
  const answers = new Map();

  function compact(text) {
    return text.replace(/\s+/g, '');
  }

  function prepare() {
    prepared = catalog.map((entry) => {
      const name = norm(entry.generic);
      return {
        entry,
        name,
        compact: compact(name),
        aliases: (entry.aliases || []).map((alias) => {
          const n = norm(alias);
          return { n, c: compact(n) };
        }),
      };
    });
  }

  function resolve(name, strength) {
    const raw = norm(name + ' ' + strength);
    const nameRaw = norm(name);
    const strengthRaw = norm(strength);
    const compactName = compact(nameRaw);
    if (compactName.indexOf('calciumchloride10%') === 0) return { generic: 'Calcium Chloride 10%', concentration: strength || '1g/10ml' };
    if (compactName.indexOf('calciumgluconate10%') === 0) return { generic: 'Calcium Gluconate 10%', concentration: strength || '1g/10ml' };
    if (compactName.indexOf('magnesiumsulfate10%') === 0 || compactName.indexOf('magnesiumsulphate10%') === 0) return { generic: 'Magnesium Sulfate 10%', concentration: strength || '2g/20ml' };
    if (/norepinephrine|noradrenaline|noradranaline/.test(raw) || ((/adrenaline|epinephrine/.test(raw)) && strengthRaw.indexOf('4mgml') >= 0)) {
      return { generic: 'Norepinephrine 1:1,000', concentration: '4mg/ml' };
    }
    if (nameRaw.indexOf(norm('Sodium Bicarbonate')) >= 0) {
      if (strengthRaw.indexOf(norm('4.2g/50ml')) >= 0 || nameRaw.indexOf(norm('8.4%')) >= 0) return { generic: 'Sodium Bicarbonate 8.4%', concentration: '4.2g/50ml' };
      if (strengthRaw.indexOf(norm('4.2g/10ml')) >= 0) return { generic: 'Sodium Bicarbonate', concentration: '4.2g/10ml' };
    }
    if (!prepared) prepare();
    const found = prepared.find((row) => {
      if (nameRaw === row.name || compactName === row.compact) return true;
      return row.aliases.some((a) => nameRaw === a.n || nameRaw.indexOf(a.n) === 0 || compactName === a.c || compactName.indexOf(a.c) === 0);
    });
    if (found) return { generic: found.entry.generic, concentration: strength || found.entry.concentration || '' };
    return { generic: name || 'Unknown', concentration: strength };
  }

  return function canonicalMedication(itemOrName, strengthValue) {
    const item = (itemOrName && typeof itemOrName === 'object') ? itemOrName : { name: itemOrName, strength: strengthValue, concentration: strengthValue };
    const name = String(item.name || item.genericName || '').trim();
    const strength = String(item.strength || item.concentration || strengthValue || '').trim();
    if (item.identityLocked === true) return { generic: name || 'Unknown', concentration: strength };
    const key = name + '\u0001' + strength;
    let answer = answers.get(key);
    if (!answer) {
      if (answers.size >= CACHE_LIMIT) answers.clear();
      answer = resolve(name, strength);
      answers.set(key, answer);
    }
    return { generic: answer.generic, concentration: answer.concentration };
  };
}
