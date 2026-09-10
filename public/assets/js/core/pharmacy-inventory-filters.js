/* Which medicines a person sees, and which ones need reordering.

   Two separate questions that were written inline in the same render function,
   one line each, and they are not the same question:

   `visibleMedicines` is a restriction, not a filter. A pharmacy_staff member
   assigned to particular rooms sees only what is stored in them — and an empty
   assignment list means "not restricted", not "sees nothing", which is the one
   way this could go badly wrong.

   `filterMedicines` is what the person on the screen chose. Filters combine:
   every one that is set has to match. Search covers the three ways staff look a
   medicine up — its name, its MOH code, its Nupco code — because they have
   whichever of those is printed on the box in front of them. */

import { piExpiryStatus } from './pharmacy-inventory-model.js?v=37e70b3537';

export function visibleMedicines(meds, allowedRooms) {
  const list = Array.isArray(meds) ? meds : [];
  const rooms = Array.isArray(allowedRooms) ? allowedRooms : [];
  if (!rooms.length) return list;
  return list.filter((med) => (med.locations || []).some((location) => rooms.indexOf(location.roomId) >= 0));
}

export function filterMedicines(meds, filters = {}) {
  let list = (Array.isArray(meds) ? meds : []).slice();

  if (filters.search) {
    const needle = String(filters.search).toLowerCase();
    const has = (value) => String(value || '').toLowerCase().indexOf(needle) >= 0;
    list = list.filter((med) => has(med.name) || has(med.mohCode) || has(med.nupcoCode));
  }
  if (filters.location) {
    const [roomId, cabId, shelfId] = String(filters.location).split(':');
    list = list.filter((med) => (med.locations || []).some(
      (at) => at.roomId === roomId && at.cabId === cabId && at.shelfId === shelfId,
    ));
  }
  if (filters.classification) list = list.filter((med) => med.classification === filters.classification);
  if (filters.expiry) list = list.filter((med) => piExpiryStatus(med.expiry) === filters.expiry);
  if (filters.status) list = list.filter((med) => med.internalStatus === filters.status);
  if (filters.urgency) list = list.filter((med) => med.urgency === filters.urgency);
  if (filters.dosageForm) list = list.filter((med) => med.dosageForm === filters.dosageForm);
  if (filters.multiLocation) list = list.filter((med) => (med.locations || []).length > 1);
  if (filters.outOfStock) list = list.filter((med) => !!med.outOfStock);

  return list;
}

/* What to reorder: nothing on the shelf, already expired, or close enough to
   expiring that ordering now is the point. Expired stock stays on this list —
   it is exactly what has to be replaced. */
export function medicinesNeedingReorder(meds) {
  return (Array.isArray(meds) ? meds : []).filter((med) => {
    if (med.outOfStock) return true;
    const status = piExpiryStatus(med.expiry);
    return status === 'expired' || status === 'soon';
  });
}
