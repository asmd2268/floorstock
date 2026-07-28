(function(){
'use strict';
function master(){try{return !!((window.CU&&CU.master===true)||(typeof isMasterActual==='function'&&isMasterActual())||(typeof masterOnly==='function'&&masterOnly()))}catch(e){return false}}
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function norm(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'')}
function uid(){return 'del_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
async function mandatoryBackup(kind,target){
  if(!master()){toast('Master permission required / الصلاحية للماستر فقط','err');throw new Error('Master permission required')}
  var ok=await uiConfirm('A complete backup must be created and downloaded before deleting this '+kind+'.\n\nيجب إنشاء وتنزيل نسخة احتياطية كاملة قبل الحذف.\n\nContinue?');
  if(!ok)throw new Error('Deletion cancelled');
  if(typeof window.masterCreateLocalBackup!=='function'||typeof window.masterDownloadLatestLocalBackup!=='function')throw new Error('Backup service is unavailable');
  var saved=await window.masterCreateLocalBackup(true);
  if(!saved)throw new Error('Backup creation failed');
  var downloaded=await window.masterDownloadLatestLocalBackup();
  if(!downloaded)throw new Error('Backup download failed');
  var token={id:uid(),kind:kind,target:String(target||''),createdAt:new Date().toISOString()};
  sessionStorage.setItem('r635_delete_backup_token',JSON.stringify(token));
  return token;
}
function consumeBackup(token,kind,target){
  var raw=sessionStorage.getItem('r635_delete_backup_token'),saved=null;try{saved=JSON.parse(raw||'null')}catch(e){}
  var valid=saved&&token&&saved.id===token.id&&saved.kind===kind&&saved.target===String(target||'')&&(Date.now()-new Date(saved.createdAt).getTime()<10*60*1000);
  sessionStorage.removeItem('r635_delete_backup_token');
  if(!valid)throw new Error('A new backup is required before deletion');
}
async function typedConfirm(label){
  var value=window.prompt('Permanent deletion / حذف نهائي\n\nType DELETE to permanently delete:\n'+label+'\n\nاكتب DELETE للتأكيد');
  return value==='DELETE';
}
async function removePublicCart(id){
  if(!window.FB_DB)return;
  var jobs=[
    FB_DB.collection('public_controlled_expiry').doc('crash_'+id).delete(),
    FB_DB.collection('public_crash_carts').doc(String(id)).delete()
  ];
  await Promise.allSettled(jobs);
}
async function hardDeleteCrashCart(id,opts){
  opts=opts||{};
  var cart=(typeof crashCarts==='function'?crashCarts():[]).find(function(c){return String(c.id)===String(id)});
  if(!cart)throw new Error('Crash Cart was not found');
  var token=opts.backupToken||await mandatoryBackup('Crash Cart',id);
  if(!opts.skipTypedConfirm&&!(await typedConfirm(cart.name||id)))throw new Error('Deletion cancelled');
  consumeBackup(token,'Crash Cart',id);
  var carts=(crashCarts()||[]).filter(function(c){return String(c.id)!==String(id)});
  var reports=(typeof crashReports==='function'?crashReports():S.g('crash_cart_reports')||[]).filter(function(r){return String(r.cartId)!==String(id)});
  await setCrashCarts(carts);
  await (typeof setCrashReports==='function'?setCrashReports(reports):S.s('crash_cart_reports',reports));
  var nameMap=Object.assign({},S.g('crash_cart_medication_names_v1')||{});delete nameMap[id];await S.s('crash_cart_medication_names_v1',nameMap);
  await removePublicCart(id);
  if(typeof auditAction==='function')await auditAction('master_hard_delete_crash_cart',{cartId:id,cartName:cart.name||'',departmentId:cart.deptId||'',backupId:token.id,backupAt:token.createdAt});
  if(typeof renderCrashCarts==='function')renderCrashCarts();
  if(typeof renderCrashOperations==='function')renderCrashOperations();
  toast('Crash Cart deleted permanently from all active records ✓','succ');
  return true;
}
window.masterDeleteCrashCart=async function(id){try{return await hardDeleteCrashCart(id)}catch(e){if(String(e.message)!=='Deletion cancelled')toast(String(e.message||e),'err');return false}};

async function hardDeleteDepartment(id){
  if(!master())return toast('Master permission required / الصلاحية للماستر فقط','err');
  var dept=(typeof gd==='function'?gd():[]).find(function(d){return String(d.id)===String(id)});if(!dept)return toast('Department not found','err');
  var linkedUsers=(typeof gu==='function'?(gu()||[]):[]).filter(function(user){return [user&&user.deptId,user&&user.departmentId,user&&user.department].some(function(value){return String(value||'')===String(id)})});
  if(linkedUsers.length){
    toast('Reassign or delete '+linkedUsers.length+' linked user account(s) before deleting this department.','err');
    if(typeof showPg==='function')showPg('pg-users');
    return false
  }
  var token;try{token=await mandatoryBackup('department',id)}catch(e){if(String(e.message)!=='Deletion cancelled')toast(String(e.message||e),'err');return false}
  if(!(await typedConfirm(dept.name||id)))return false;
  try{
    consumeBackup(token,'department',id);
    var carts=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return String(c.deptId)===String(id)});
    var allCarts=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return String(c.deptId)!==String(id)});
    var cartIds=new Set(carts.map(function(c){return String(c.id)}));
    var reports=(typeof crashReports==='function'?crashReports():S.g('crash_cart_reports')||[]).filter(function(r){return String(r.deptId)!==String(id)&&!cartIds.has(String(r.cartId))});
    await setCrashCarts(allCarts);await (typeof setCrashReports==='function'?setCrashReports(reports):S.s('crash_cart_reports',reports));
    for(var i=0;i<carts.length;i++)await removePublicCart(carts[i].id);
    await S.s('requests',(S.g('requests')||[]).filter(function(x){return String(x.deptId||x.departmentId||x.dept)!==String(id)}));
    await S.s('request_analytics_archive',(S.g('request_analytics_archive')||[]).filter(function(x){return String(x.deptId||x.departmentId||x.dept)!==String(id)}));
    if(typeof window.floorstockPurgeDepartmentState==='function')await window.floorstockPurgeDepartmentState(id,[id,dept.name,dept.code].filter(Boolean),true);
    else await S.s('departments',(S.g('departments')||[]).filter(function(d){return String(d.id)!==String(id)}));
    if(typeof auditAction==='function')await auditAction('master_hard_delete_department',{departmentId:id,departmentName:dept.name||'',deletedCrashCarts:carts.map(function(c){return c.id}),backupId:token.id,backupAt:token.createdAt});
    if(typeof floorstockDeleteUiRefresh==='function')floorstockDeleteUiRefresh();
    if(typeof renderCrashCarts==='function')renderCrashCarts();
    toast('Department and all linked active records were deleted permanently ✓','succ');return true;
  }catch(e){console.error(e);toast('Deletion failed: '+String(e.message||e),'err');return false}
}
window.delDept=hardDeleteDepartment;

function decorate(){
  document.body.classList.toggle('master-mode',master());
  document.querySelectorAll('[onclick^="delDept("],[onclick*=" delDept("]').forEach(function(b){b.style.display=master()?'':'none';b.disabled=!master()});
  document.querySelectorAll('[id^="ccx-cart-"]').forEach(function(card){var id=card.id.replace('ccx-cart-',''),bar=card.querySelector('.ccx-toolbar-actions');if(!bar||bar.querySelector('.r635-delete-cart'))return;var b=document.createElement('button');b.type='button';b.className='btn bd2c bsm master-delete-only r635-delete-cart';b.textContent='🗑 Delete cart';b.onclick=function(){window.masterDeleteCrashCart(id)};bar.appendChild(b)});
}
var oldRender=window.renderCrashCarts;if(typeof oldRender==='function')window.renderCrashCarts=function(){var r=oldRender.apply(this,arguments);setTimeout(decorate,0);return r};
function observeDeletionHosts(){
  ['pg-crashcart','pg-users'].forEach(function(id){var host=document.getElementById(id);if(host)new MutationObserver(function(mutations){if(mutations.some(function(m){return m.addedNodes&&m.addedNodes.length}))decorate()}).observe(host,{childList:true,subtree:true})});
  decorate()
}
window.addEventListener('load',observeDeletionHosts);
})();








export {};
