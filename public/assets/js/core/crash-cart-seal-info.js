/* Where a Crash Cart's seal number came from.

   A cart's seal is stored in two places. The cart carries the CURRENT seal, and
   every closing report carries the seal that was fitted when it was closed. The
   screen printed both, labelled only "Seal", so after a Master seal correction
   (which changes the cart and, deliberately, leaves the closing report alone) one
   cart showed two different seal numbers and nobody could tell which to trust.

   This is the one rule for that question. The cart's own seal is always the seal
   in force. What this adds is the reason it differs from the last closure, so the
   screen can say "changed by Master correction" instead of quoting a closure seal
   that is no longer on the cart.

   source:
     'none'               nothing recorded
     'cart'               no closing report to compare against
     'closure'            the cart's seal is the one fitted at the last closure
     'master_correction'  corrected by the Master after the last closure
     'master_confirmed'   differs from the last closure, and the Master confirmed
                          the cart's seal as the right one
     'mismatch'           differs from the last closure and nobody has decided which
                          is right — `seal` is the cart's, `closureSeal` the record's */

function text(value) {
  return String(value == null ? '' : value).trim();
}

function same(a, b) {
  return text(a).toLowerCase() === text(b).toLowerCase();
}

function time(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function crashCartSealInfo(cart, closed) {
  const current = text(cart && cart.seal);
  const closureSeal = text(closed && closed.newSeal);
  if (!current && !closureSeal) return { source: 'none', seal: '' };
  if (!closed || !closureSeal) return { source: 'cart', seal: current || closureSeal };
  if (!current || same(current, closureSeal)) return { source: 'closure', seal: current || closureSeal };

  const closedAt = time(closed.closedAt || closed.lastEditedAt);
  const after = (value) => value != null && (closedAt == null || value >= closedAt);
  const correctedAt = time(cart.lastSealCorrectionAt);
  /* A confirmation only speaks for the seal it was made about: if the seal has
     changed since, the confirmation no longer applies. */
  const confirmedAt = same(cart.sealConfirmedSeal, current) ? time(cart.sealConfirmedAt) : null;
  const corrected = after(correctedAt);
  const confirmed = after(confirmedAt);

  if (confirmed && (!corrected || confirmedAt > correctedAt)) {
    return {
      source: 'master_confirmed',
      seal: current,
      closureSeal,
      confirmedAt: text(cart.sealConfirmedAt),
      confirmedBy: text(cart.sealConfirmedBy)
    };
  }
  if (corrected) {
    return {
      source: 'master_correction',
      seal: current,
      closureSeal,
      correctedAt: text(cart.lastSealCorrectionAt),
      correctedBy: text(cart.lastSealCorrectionBy),
      reason: text(cart.lastSealCorrectionReason)
    };
  }
  return { source: 'mismatch', seal: current, closureSeal };
}

/* The closure line's seal, as one piece of HTML-safe-by-caller text. `format`
   renders a date; `esc` escapes. Both come from the caller so this stays free of
   page globals. */
export function crashCartSealLabel(info, format, esc) {
  const fmt = typeof format === 'function' ? format : (v) => String(v || '');
  const e = typeof esc === 'function' ? esc : (v) => String(v == null ? '' : v);
  if (!info || info.source === 'none') return '—';
  if (info.source === 'master_correction') {
    const by = info.correctedBy ? ' · ' + e(info.correctedBy) : '';
    return e(info.seal) + ' — changed by Master correction / تغيّر بتصحيح الماستر · ' + e(fmt(info.correctedAt)) + by;
  }
  if (info.source === 'master_confirmed') {
    const by = info.confirmedBy ? ' · ' + e(info.confirmedBy) : '';
    return e(info.seal) + ' — confirmed by Master / معتمد من الماستر · ' + e(fmt(info.confirmedAt)) + by;
  }
  if (info.source === 'mismatch') {
    return '<span class="seal-mismatch">' + e(info.seal) + ' <small>(on the cart / على العربة)</small>'
      + ' ≠ ' + e(info.closureSeal) + ' <small>(last closure record / سجل آخر إغلاق)</small></span>';
  }
  return e(info.seal);
}

/* Is this seal number already taken?  Returns null when it is free, otherwise
   { where: 'another-cart' | 'seal-history', cart, report } saying WHERE it was
   found, so the person is told which cart or report holds it instead of an
   anonymous "seal history".

   A seal number must not be reused, with one exception that is the whole point of
   putting a cart back to its last closure: that closing report's own number. For
   that number the cart's OWN reports are not a conflict. A report that came after
   the closure and recorded the same number as the seal it broke (one that was
   accepted or rejected without fitting a new seal, say) still describes the same
   physical seal, so it does not make it "used". Other carts' records, and any
   other number in this cart's history, still block. */
export function findSealConflict(newSeal, cartId, carts, reports) {
  const key = text(newSeal).toLowerCase();
  if (!key) return null;
  const mine = String(cartId);
  const cartName = (id) => {
    const c = (carts || []).find((x) => String(x.id) === String(id));
    return c ? text(c.name || c.number || c.id) : text(id);
  };
  const other = (carts || []).find((c) => String(c.id) !== mine && text(c.seal).toLowerCase() === key);
  if (other) return { where: 'another-cart', cart: text(other.name || other.number || other.id), report: null };

  const own = (reports || []).filter((r) => String(r.cartId) === mine);
  const ownLast = own
    .filter((r) => r.status === 'closed' && text(r.newSeal))
    .sort((a, b) => text(b.closedAt || b.lastEditedAt).localeCompare(text(a.closedAt || a.lastEditedAt)))[0];
  const restoringOwnLast = !!ownLast && text(ownLast.newSeal).toLowerCase() === key;

  for (const r of reports || []) {
    const isMine = String(r.cartId) === mine;
    if (isMine && restoringOwnLast) continue;
    if ([r.oldSeal, r.newSeal].some((value) => text(value).toLowerCase() === key)) {
      return { where: 'seal-history', cart: cartName(r.cartId), report: r };
    }
  }
  return null;
}

Object.assign(globalThis, { crashCartSealInfo, crashCartSealLabel, findSealConflict });
