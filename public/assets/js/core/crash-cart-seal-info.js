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
     'mismatch'           differs from the last closure with no correction on record */

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

  const correctedAt = time(cart.lastSealCorrectionAt);
  const closedAt = time(closed.closedAt || closed.lastEditedAt);
  const correctedAfterClosure = correctedAt != null && (closedAt == null || correctedAt >= closedAt);
  if (correctedAfterClosure) {
    return {
      source: 'master_correction',
      seal: current,
      correctedAt: text(cart.lastSealCorrectionAt),
      correctedBy: text(cart.lastSealCorrectionBy),
      reason: text(cart.lastSealCorrectionReason)
    };
  }
  return { source: 'mismatch', seal: current };
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
  if (info.source === 'mismatch') {
    return e(info.seal) + ' — differs from the last closure record / يختلف عن سجل آخر إغلاق';
  }
  return e(info.seal);
}

Object.assign(globalThis, { crashCartSealInfo, crashCartSealLabel });
