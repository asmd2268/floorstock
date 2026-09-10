/* Deciding that two written medicine names mean the same medicine, and whether
   a hide/freeze rule applies to a department.

   These four functions sit under the request form: they decide whether a ward
   sees a medicine at all, whether it is frozen, and whether an imported name is
   the same drug as one already on the list. A wrong match takes a medicine off a
   ward's request screen; a missed match puts the same drug on it twice.

   `medNorm` folds case, Arabic harakat and punctuation — the same fold the rest
   of the project uses for names.

   `medIdentity` goes further and drops the words that describe the PACKAGING
   rather than the drug: mg, ml, vial, tablet, ampoule, syrup, IV. "Adrenaline
   1mg ampoule" and "Adrenaline injection" reduce to the same identity, which is
   what makes a rule written once apply to a name typed differently by another
   department.

   The containment rule in `sameMedicine` is deliberately asymmetric about
   length: an identity has to be longer than five characters before a substring
   match counts, or short names would swallow unrelated drugs.

   Known limit, pinned by a test rather than quietly changed: a unit written
   against its number ("1mg") is one token, so "Adrenaline 1mg" and
   "Adrenaline 1 mg" have different identities. Splitting them would change the
   fold, and every hide/freeze rule already stored under an identity key was
   written with the current one — changing it silently orphans those rules.
   `sameMedicine` still matches the two names through containment.

   Lifted out of modules/03c, where they were three unreadable one-liners with no
   test at all. */

const PACKAGING_WORDS = {
  mg: 1, mcg: 1, g: 1, gm: 1, ml: 1, l: 1, iu: 1, unit: 1, units: 1,
  tab: 1, tabs: 1, tablet: 1, tablets: 1, cap: 1, caps: 1, capsule: 1, capsules: 1,
  amp: 1, amps: 1, ampoule: 1, ampoules: 1, vial: 1, vials: 1, bottle: 1, bottles: 1,
  bag: 1, bags: 1, syrup: 1, solution: 1, solutions: 1, injection: 1, injections: 1,
  cream: 1, ointment: 1, drops: 1, inhaler: 1, inhalers: 1, suppository: 1, suppositories: 1,
  oral: 1, iv: 1, im: 1, sc: 1, infusion: 1, for: 1, of: 1,
};

export function medNorm(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function medIdentity(value) {
  return medNorm(value).split(/\s+/).filter((word) => word && !PACKAGING_WORDS[word]).join(' ');
}

/* A rule covers a department when it says "all departments" — in either of the
   two shapes this has been saved in — or names it. Ids are compared as strings:
   a department id saved as a number must still match the same id read as text. */
export function ruleAppliesToDepartment(rule, deptId) {
  if (!rule) return false;
  if (rule.allDepartments === true || rule.deptIds === 'all') return true;
  const named = [];
  if (Array.isArray(rule.departmentIds)) named.push(...rule.departmentIds);
  if (Array.isArray(rule.deptIds)) named.push(...rule.deptIds);
  return named.map(String).indexOf(String(deptId)) >= 0;
}

/* A rule is looked up by the medicine's own id first, then by every name it is
   known by. The id is exact and cannot be confused with another drug; the names
   are the fallback for a rule written before the medicine had an id, or written
   against the name another department uses. */
export function medicationRuleFor(map, med, deptId) {
  if (!map || !med) return null;
  const direct = map['med:' + String(med.id)] || map[String(med.id)];
  if (direct && ruleAppliesToDepartment(direct, deptId)) return direct;

  const keys = [];
  [med.name].concat(med.aliases || []).forEach((name) => {
    const folded = medNorm(name);
    const identity = medIdentity(name);
    if (folded) keys.push(folded);
    if (identity) keys.push('identity:' + identity);
  });
  for (let i = 0; i < keys.length; i += 1) {
    const rule = map[keys[i]];
    if (rule && ruleAppliesToDepartment(rule, deptId)) return rule;
  }
  return null;
}

export function sameMedicine(a, b) {
  if (!a || !b) return false;
  if (String(a.id || '') && String(a.id || '') === String(b.id || '')) return true;
  const namesA = [a.name].concat(a.aliases || []);
  const namesB = [b.name].concat(b.aliases || []);
  for (let i = 0; i < namesA.length; i += 1) {
    for (let j = 0; j < namesB.length; j += 1) {
      const x = medIdentity(namesA[i]);
      const y = medIdentity(namesB[j]);
      if (!x || !y) continue;
      if (x === y) return true;
      if (x.length > 5 && y.indexOf(x) >= 0) return true;
      if (y.length > 5 && x.indexOf(y) >= 0) return true;
    }
  }
  return false;
}
