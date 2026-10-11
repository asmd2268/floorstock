/* Order of medicines inside a department's inventory list.

   The list shows each category (Injections, Inhalers, ...) as its own block and
   orders the medicines inside it by `sortOrder`, which the up/down arrows swap.
   A new medicine used to get "highest number + 100", so it landed at the bottom of
   its category whatever its name.

   The default is now alphabetical:
   · a new medicine is placed at its alphabetical position inside its category, as
     long as that category is still in alphabetical order. A category somebody has
     arranged by hand with the arrows is left as arranged and the new medicine goes
     to its end, so a deliberate order is never reshuffled behind their back;
   · alphabeticalOrder() puts every category back in alphabetical order (the A→Z
     button), after which new medicines keep it that way;
   · isRecentlyAdded() tells the list which medicines to mark "new". */

export const NEW_BADGE_DAYS = 7;

const clean = (value) => String(value == null ? '' : value).trim();
const sameCategory = (a, b) => clean(a && a.category) === clean(b && b.category);

export function compareMedNames(a, b) {
  return clean(a && a.name).localeCompare(clean(b && b.name), 'en', { numeric: true, sensitivity: 'base' });
}

const orderOf = (med) => Number(med && med.sortOrder) || 0;

export function isAlphabetical(meds) {
  const byOrder = meds.slice().sort((a, b) => orderOf(a) - orderOf(b));
  return byOrder.every((med, i) => i === 0 || compareMedNames(byOrder[i - 1], med) <= 0);
}

/* Every category in alphabetical order. Returns copies; only sortOrder changes. */
export function alphabeticalOrder(meds) {
  const rows = Array.isArray(meds) ? meds : [];
  const ranked = rows.slice().sort((a, b) => clean(a.category).localeCompare(clean(b.category), 'en', { sensitivity: 'base' }) || compareMedNames(a, b));
  const rank = new Map(ranked.map((med, i) => [String(med.id), (i + 1) * 100]));
  return rows.map((med) => Object.assign({}, med, { sortOrder: rank.get(String(med.id)) }));
}

/* The sortOrder a new medicine should get. */
export function orderForNewMed(meds, med) {
  const rows = Array.isArray(meds) ? meds : [];
  const end = rows.reduce((top, row) => Math.max(top, orderOf(row)), 0) + 100;
  const inCategory = rows.filter((row) => sameCategory(row, med)).sort((a, b) => orderOf(a) - orderOf(b));
  if (!inCategory.length || !isAlphabetical(inCategory)) return end;
  const at = inCategory.findIndex((row) => compareMedNames(row, med) > 0);
  if (at < 0) return end;
  const next = orderOf(inCategory[at]);
  return at === 0 ? next - 50 : (orderOf(inCategory[at - 1]) + next) / 2;
}

export function isRecentlyAdded(med, now = Date.now()) {
  const at = Date.parse(med && med.createdAt);
  return Number.isFinite(at) && now - at >= -86400000 && now - at < NEW_BADGE_DAYS * 86400000;
}
