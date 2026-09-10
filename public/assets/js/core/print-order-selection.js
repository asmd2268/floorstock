/* Keeping the pharmacist's tick marks while the Print Orders list refreshes.

   The list re-renders whenever the requests behind it change — a department
   submits, another pharmacist fulfils — which is roughly every few seconds on a
   busy morning. Every re-render rebuilt the table from scratch, so the boxes a
   pharmacist had been ticking for a print run came back empty about ten seconds
   after they started, with no message and nothing to click. From their side the
   page simply refused to hold a selection.

   Suppressing the refresh would be the wrong fix: the list would then go stale
   while it is being read, and a request fulfilled in the meantime would be
   missing from the print. Instead the selection is remembered by request id and
   put back on the rows that still exist.

   A row that has disappeared from the list drops out of the selection with it —
   there is nothing left to print for it. */

export function selectedPrintIds(root = document) {
  return Array.from(root.querySelectorAll('.pchk:checked')).map((box) => String(box.dataset.id || ''));
}

export function restorePrintSelection(ids, root = document) {
  const wanted = new Set((ids || []).map(String));
  if (!wanted.size) return 0;
  let restored = 0;
  root.querySelectorAll('.pchk').forEach((box) => {
    if (!wanted.has(String(box.dataset.id || ''))) return;
    box.checked = true;
    restored += 1;
  });
  /* The header box only claims "all" when every row really is ticked. */
  const all = Array.from(root.querySelectorAll('.pchk'));
  const master = root.querySelector('#print-select-all, .pchk-all');
  if (master) master.checked = all.length > 0 && all.every((box) => box.checked);
  return restored;
}

/* Run a render with the selection carried across it. */
export function withPreservedPrintSelection(render, root = document) {
  const ids = selectedPrintIds(root);
  render();
  return restorePrintSelection(ids, root);
}
