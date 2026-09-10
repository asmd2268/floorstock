/* Opening several crash carts at once, removing the same medicine from each and
   replacing it — worked out completely before anything is written.

   This is the most consequential arithmetic in the project: it changes what a
   sealed emergency cart contains, and it writes the opening record that says so.
   It ran with no test at all.

   The rules it enforces, each of which exists because the alternative is a cart
   nobody can trust:

   A cart may never hold more than its approved standard quantity. A replacement
   that would exceed it is refused rather than silently capped, because the
   difference between "we put back four" and "we put back six" is a discrepancy
   somebody has to explain at the next count.

   Every replacement quantity needs an expiry. Stock in a crash cart with no
   expiry recorded cannot be checked by anyone who opens it later.

   Every seal is unique, across the carts and across every seal ever recorded on
   a report. A repeated seal number makes the tamper evidence meaningless.

   A cart with an open report is left alone: closing it is the other workflow,
   and doing both at once would produce two contradictory records of one opening.

   Nothing here writes. It returns the next carts and the next reports, and the
   caller saves them — so a refusal costs nothing and a partial failure is
   impossible. */

const EPSILON = 1e-9;

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function clone(value) { return JSON.parse(JSON.stringify(value == null ? null : value)); }

export function itemKey(item, normalize) {
  if (item && item.medId) return 'id:' + item.medId;
  return 'name:' + normalize((item && item.name) || '') + '|' + normalize((item && item.concentration) || (item && item.strength) || '');
}

export function findCartItem(cart, key, normalize) {
  return ((cart && cart.items) || []).find((item) => itemKey(item, normalize) === key) || null;
}

/* Every seal already spoken for: the ones on the carts now, and every seal any
   report has ever recorded on either side of an opening. */
/* Every distinct medicine held by any cart, for the picker that starts a bulk
   opening: the same medicine sits in a dozen carts and must be offered once. */
export function uniqueCrashItems(carts, normalize) {
  const seen = {};
  (carts || []).forEach((cart) => {
    (cart.items || []).forEach((item) => {
      const key = itemKey(item, normalize);
      if (seen[key]) return;
      seen[key] = {
        key,
        name: item.name || item.genericName || '',
        concentration: item.concentration || item.strength || '',
        medId: item.medId || '',
      };
    });
  });
  return Object.keys(seen).map((key) => seen[key]).sort((a, b) => a.name.localeCompare(b.name));
}

export function usedSeals(carts, reports) {
  const used = {};
  (carts || []).forEach((cart) => { if (cart.seal) used[String(cart.seal).trim().toLowerCase()] = 1; });
  (reports || []).forEach((report) => {
    [report.oldSeal, report.newSeal].forEach((seal) => { if (seal) used[String(seal).trim().toLowerCase()] = 1; });
  });
  return used;
}

/* Take `qty` out of the item, from one expiry if one was chosen. A quantity of
   zero means "all of it" — of that expiry when one is chosen, of the item
   otherwise — because that is what the person emptying a cart means. */
export function removeFromItem(item, date, qty) {
  const available = num(item.present == null ? item.qty : item.present);
  let batches = (item.batches || []).map((batch) => Object.assign({}, batch));
  let wanted = qty;

  if (date) {
    const matching = batches.filter((batch) => String(batch.expiry || '').slice(0, 10) === date);
    const total = matching.reduce((sum, batch) => sum + num(batch.qty), 0);
    if (wanted <= 0) wanted = total;
    if (wanted > total + EPSILON) throw new Error('Selected expiry has insufficient quantity.');
    let left = wanted;
    const emptied = new Set();
    batches.forEach((batch) => {
      if (left <= 0 || String(batch.expiry || '').slice(0, 10) !== date) return;
      const take = Math.min(left, num(batch.qty));
      batch.qty = num(batch.qty) - take;
      left -= take;
      if (num(batch.qty) <= 0) emptied.add(batch);
    });
    /* A batch this removal emptied is dropped. What was in it is recorded on the
       opening report, so keeping a zero row in the cart adds nothing — and the
       cart is one Firestore document that every opening would otherwise grow,
       for the life of the cart. A batch that was already empty before this
       removal is left alone: it is not this operation's business. */
    batches = batches.filter((batch) => !emptied.has(batch));
  } else {
    if (wanted <= 0) wanted = available;
    if (wanted > available + EPSILON) throw new Error('Cart has insufficient available quantity.');
  }

  item.present = Math.max(0, available - wanted);
  item.stockStatus = item.present <= 0 ? 'out_of_stock' : (item.present < num(item.qty) ? 'partial' : 'available');
  item.batches = batches;
  return wanted;
}

export function addReplacement(item, replacement, expiry, newId) {
  const qty = num(replacement.qty);
  const standard = num(item.qty);
  const current = num(item.present == null ? item.qty : item.present);
  const next = current + qty;
  if (next > standard + EPSILON) {
    throw new Error((item.name || 'Medicine') + ': replacement would exceed the approved Crash Cart standard quantity ' + standard + '.');
  }
  item.present = next;
  item.stockStatus = next <= 0 ? 'out_of_stock' : next < standard ? 'partial' : 'available';
  item.batches = Array.isArray(item.batches) ? item.batches : [];
  if (qty > 0 && !expiry) throw new Error((item.name || 'Medicine') + ': every replacement quantity requires an expiry date.');
  if (expiry || replacement.lot) {
    item.batches.push({ batchId: newId('ccb'), expiry: expiry || '', qty, lot: replacement.lot || '' });
  }
}

export function buildCrashBulkResult(carts, reports, plan, {
  now = () => new Date().toISOString(),
  actor = () => ({ name: 'Unknown', user: 'Unknown', id: '' }),
  newId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2),
  normalize = (value) => String(value || '').toLowerCase().trim(),
  sealIsValid = () => true,
} = {}) {
  const nextCarts = clone(carts);
  const nextReports = clone(reports);
  const already = usedSeals(carts, reports);
  const proposed = {};

  /* Every seal is checked before ANY cart is touched: a plan that would fail
     halfway must not leave some carts opened and others not. */
  plan.cartPlans.forEach((cartPlan) => {
    const seal = String(cartPlan.newSeal || '').trim();
    const key = seal.toLowerCase();
    if (!seal) throw new Error('A unique new seal is required for every cart.');
    if (!sealIsValid(seal)) throw new Error('Enter a valid seal number. / أدخل رقم قفل صالح.');
    if (proposed[key] || already[key]) throw new Error('Seal "' + seal + '" is already used. Every new seal must be unique.');
    proposed[key] = 1;
  });

  plan.cartPlans.forEach((cartPlan) => {
    const cart = nextCarts.find((entry) => String(entry.id) === String(cartPlan.cartId));
    if (!cart) throw new Error('Cart not found.');
    if (nextReports.some((report) => String(report.cartId) === String(cart.id) && (report.status === 'open' || report.status === 'pending'))) {
      throw new Error((cart.name || 'Cart') + ' already has an open report. Close it first.');
    }
    const source = findCartItem(cart, plan.sourceKey, normalize);
    if (!source) throw new Error('Source medicine not found in ' + (cart.name || 'cart'));
    const removed = removeFromItem(source, plan.sourceExpiry, num(cartPlan.removeQty));

    (plan.replacements || []).forEach((replacement) => {
      const perCart = (cartPlan.replacements || {})[replacement.id];
      if (!perCart || perCart.include === false) return;
      const expiry = perCart.expiryOverride || replacement.expiry || '';
      let target = (cart.items || []).find((item) => normalize(item.name) === normalize(replacement.name)
        && normalize(item.concentration || item.strength) === normalize(replacement.concentration || ''));
      if (!target) {
        /* A medicine the cart never held is added with a standard of zero, so
           the next line refuses any quantity: putting an unapproved medicine
           into a crash cart is a decision for whoever sets the standard. */
        target = {
          id: newId('cci'), medId: replacement.medId || '', name: replacement.name, genericName: replacement.name,
          concentration: replacement.concentration || '', strength: replacement.concentration || '',
          qty: 0, present: 0, batches: [],
        };
        cart.items.push(target);
      }
      addReplacement(target, replacement, expiry, newId);
    });

    const stamp = now();
    const who = actor();
    const oldSeal = cart.seal || '';
    cart.seal = cartPlan.newSeal;
    cart.updatedAt = stamp;
    cart.updatedBy = who.name;
    cart.lastClosedAt = stamp;
    cart.lastClosedByName = who.name;
    cart.lastClosedByUser = who.user;

    nextReports.push({
      id: newId('ccbulk'), cartId: cart.id, deptId: cart.deptId, status: 'closed',
      type: 'pharmacy_bulk_open_replace', operation: 'open', openingLog: true, bulkOpen: true,
      pharmacyInitiated: true, reason: 'Bulk opening and replacement / فتح واستبدال جماعي',
      oldSeal, newSeal: cartPlan.newSeal,
      sourceMedicine: plan.sourceKey, sourceExpiry: plan.sourceExpiry, removedQty: removed,
      replacements: (plan.replacements || []).filter((replacement) => {
        const perCart = (cartPlan.replacements || {})[replacement.id];
        return perCart && perCart.include !== false;
      }).map((replacement) => {
        const perCart = cartPlan.replacements[replacement.id] || {};
        return {
          name: replacement.name, concentration: replacement.concentration, qty: num(replacement.qty),
          expiry: perCart.expiryOverride || replacement.expiry || '', lot: replacement.lot || '',
        };
      }),
      pharmacyNote: plan.note || '',
      openedAt: stamp, closedAt: stamp, openedBy: who.name, closedBy: who.name, bulk: true,
    });
  });

  return { carts: nextCarts, reports: nextReports };
}
