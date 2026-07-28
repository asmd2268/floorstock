import { publishLegacy } from '../core/legacy-registry.js';

/* ── Controlled medicines organised shared lists + role-specific filters ── */
function ctlWarehouseQtyForFilter(w){return ctlNum((w||{}).system)+ctlNum((w||{}).outside)}


const __asdhLegacyApi = {
  ctlWarehouseQtyForFilter: ctlWarehouseQtyForFilter
};
publishLegacy("08-controlled-shared-list-filters.js", __asdhLegacyApi);
export {
  ctlWarehouseQtyForFilter
};
export const legacyVariableNames = Object.freeze([]);
export default __asdhLegacyApi;
