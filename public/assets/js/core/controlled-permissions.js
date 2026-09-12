/* Who may do what with controlled medicines.

   These eight answers used to be split between two legacy modules — the roles in
   03b, the permissions derived from them in 07j — and one of them,
   `ctlCanEditWarehouse`, had been lost in a move: the warehouse stock editor
   called it and it existed nowhere, so opening that editor threw. Keeping the
   whole set in one file is what makes a missing member of it visible.

   `fsHasCapability` is the project's permission authority when it is loaded;
   these functions ask it first and fall back to the role only when it is not. */

function ctlIsMaster(){
  var profile=window.fsPermissionProfile?window.fsPermissionProfile():(window.CU||{});
  return !!(profile&&profile.master===true);
}
function ctlIsOfficer(){return !!(window.CU&&CU.role==='controlled_pharmacy')}
function ctlIsWarehouse(){return !!(window.CU&&CU.role==='warehouse')}
function ctlCanManage(){
  if(window.fsHasCapability)return window.fsHasCapability('controlled.manage');
  return ctlIsMaster()||ctlIsOfficer();
}
function ctlCanEditCatalog(){return ctlCanManage()}
function ctlCanAddCatalog(){return ctlCanManage()||ctlIsWarehouse()}
function ctlCanEditDept(){return ctlCanManage()}
/* Warehouse custody is edited by the Master or by the warehouse itself. */
function ctlCanEditWarehouse(){return ctlIsMaster()||ctlIsWarehouse()}

export { ctlIsMaster, ctlIsOfficer, ctlIsWarehouse, ctlCanManage, ctlCanEditCatalog, ctlCanAddCatalog, ctlCanEditDept, ctlCanEditWarehouse };

/* The legacy modules and the HTML call these by name. */
Object.assign(globalThis,{
  ctlIsMaster, ctlIsOfficer, ctlIsWarehouse,
  ctlCanEditCatalog, ctlCanAddCatalog, ctlCanEditDept, ctlCanEditWarehouse
});
