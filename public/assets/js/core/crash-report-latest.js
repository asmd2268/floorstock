/* Latest closed report per cart, computed once for a whole list.
   The crash cart page used to re-read and re-sort every report for each cart it
   drew, so opening the page cost carts x reports and grew with every report. */
export function latestClosedByCart(reports) {
  const latest = new Map();
  (reports || []).forEach((report) => {
    if (!report || report.status !== 'closed') return;
    const cartId = String(report.cartId);
    const stamp = String(report.closedAt || report.lastEditedAt || '');
    const current = latest.get(cartId);
    if (!current || stamp.localeCompare(current.stamp) > 0) latest.set(cartId, { stamp, report });
  });
  return { get: (cartId) => (latest.get(String(cartId)) || {}).report || null };
}
