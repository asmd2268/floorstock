/* State keys that hold a list of rows several people edit at once.

   Each of these is one document holding many independent things — every
   department, every trolley, every medicine on a ward — and every caller reads
   the whole list, changes one entry, and writes the whole list back. Two people
   working on two different entries at the same moment overwrite each other, and
   nothing anywhere says so.

   A key listed here is written as a DIFF instead: what this caller changed,
   applied to whatever the document holds at that moment, inside a transaction.
   See row-merge-write.js. Everything else keeps the plain whole-value write,
   which is correct for a settings map or a single object nobody edits in
   parallel. */

const EXACT = new Set([
  // Every trolley in one document; two pharmacists, two trolleys, one loser.
  'crash_carts',
  // Six modules write this. Renaming a department while someone adds one is
  // enough to lose the addition.
  'departments',
  // Imports, restores and manual edits all rewrite the whole catalogue.
  'controlled_catalog',
]);

/* Per-department medicine lists: a ward edits its own stock while the pharmacy
   edits the same list from the other side. */
const PREFIXES = ['meds_', 'expiry_', 'shelves_'];

export function isRowMergedKey(key) {
  const name = String(key || '');
  return EXACT.has(name) || PREFIXES.some((prefix) => name.startsWith(prefix));
}

Object.assign(globalThis, { isRowMergedKey});
