/* What the public Expiry Monitor shows for one department.

   The expiry register stores one row per BATCH, and the publisher publishes
   every one of them: a medicine with three registered dates is three entries in
   public_expiry/<dept>. The monitor read those entries as three unrelated table
   rows, so the second and third dates for a medicine sat wherever the register
   happened to put them — usually far below the first — and the page read as one
   date per medicine. A batch nobody notices is a batch nobody pulls, which is
   the whole point of the page. Every date a medicine has now sits on that
   medicine's own row, nearest first, the way the controlled-medicines list has
   always shown its batches.

   Pure: no DOM and no globals, so the grouping and the ordering are tested on
   their own rather than through a rendered page.
   دوال خالصة لتجميع دفعات الصلاحية لكل دواء وترتيبها من الأقرب انتهاءً. */

function dayOf(batch) {
  return String((batch && (batch.date || batch.expiry)) || '').slice(0, 10);
}

/* A drawer QR carries ?shelf=<id>, and the reader has no access to the
   department's private shelf list — so the filter runs on the shelf ids the
   publisher copied onto each batch. No shelf asked for means the whole
   department; a shelf that matches nothing lists nothing, rather than falling
   back to everything and implying the drawer holds the full list. */
export function expiryBatchesForShelf(batches, shelfId) {
  const rows = Array.isArray(batches) ? batches : [];
  const wanted = String(shelfId || '').trim();
  if (!wanted) return rows.slice();
  return rows.filter((batch) => ((batch && batch.shelfIds) || []).map(String).indexOf(wanted) >= 0);
}

/* One entry per medicine, in the order the register first mentions it, each
   carrying every batch published for that medicine. `first` is the entry the
   row's name, drawers and classification flags are read from: the publisher
   copies the same medicine record onto each of its batches. */
export function groupExpiryByMedication(batches) {
  const order = [];
  const byKey = new Map();
  (Array.isArray(batches) ? batches : []).forEach((batch) => {
    const name = String((batch && (batch.medication || batch.name)) || '');
    const key = name.trim().toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, { name, first: batch || {}, batches: [] });
      order.push(key);
    }
    byKey.get(key).batches.push(batch || {});
  });
  return order.map((key) => {
    const group = byKey.get(key);
    /* Nearest expiry first — what someone standing at the drawer pulls next.
       A batch with no date sorts last instead of to the top, where an empty
       string would otherwise put it. */
    group.batches = group.batches.slice().sort((a, b) => {
      const left = dayOf(a);
      const right = dayOf(b);
      if (!left || !right) return left ? -1 : (right ? 1 : 0);
      return left < right ? -1 : (left > right ? 1 : 0);
    });
    return group;
  });
}

/* Said plainly on the page, because the reader is standing at a cabinet and not
   holding a calendar. Only the two facts the published document can support: a
   date already past, and a date that is today. */
export function expiryBatchStatus(batch, todayIso) {
  const day = dayOf(batch);
  const today = String(todayIso || '').slice(0, 10);
  if (!day || !today) return '';
  if (day < today) return 'expired';
  return day === today ? 'today' : '';
}

/* '' is what the publisher writes when no quantity was recorded — the expiry
   form does not ask for one — and 0 is a real count. Saying "—" for the first
   is honest; printing '' left the column blank with nothing to read. */
export function expiryQtyLabel(batch) {
  const qty = batch ? batch.qty : null;
  if (qty === '' || qty == null) return '—';
  return String(qty);
}
