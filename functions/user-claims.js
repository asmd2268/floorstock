'use strict';

/* The claim shape, as one pure function so it can be asserted without an
   emulator. An account is active unless `active` is explicitly false — the
   same rule index.js applies (`legacy.active !== false`, `active: active !==
   false`) and the same one the client login applies (`if(profile.active===
   false) throw`). Writing `=== true` here made a profile with no `active`
   field claim active:false; firestore.rules reads that claim, activeUser()
   went false, every floorstock_state read was denied, the department
   directory came back empty, and every department login died on "Your
   department assignment is missing." */
function buildUserClaims(profile) {
  const row = profile || {};
  return {
    role: String(row.role || ''),
    deptId: String(row.deptId || row.departmentId || ''),
    active: row.active !== false,
    master: row.master === true,
    tenantId: String(row.tenantId || ''),
  };
}

module.exports = { buildUserClaims };
