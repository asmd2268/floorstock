/* ASDHealth R6.65 Modular
 * Original script position: 11
 * Original id: (none)
 * Compatibility mode: classic script, original execution order preserved.
 */
/* ── Controlled medicines organised shared lists + role-specific filters ── */
function ctlWarehouseQtyForFilter(w){return ctlNum((w||{}).system)+ctlNum((w||{}).outside)}
