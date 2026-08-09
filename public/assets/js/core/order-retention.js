function orderRetentionCutoff(){var d=new Date();d.setMonth(d.getMonth()-6);return d}
function requestArchiveRecord(r){return {id:r.id,deptId:r.deptId||'',deptName:r.deptName||'',created:r.created||r.fulfilledAt||globalThis.nowISO(),fulfilledAt:r.fulfilledAt||'',status:r.status||'fulfilled',dispensed:(r.dispensed||[]).map(function(x){return {medId:x.medId,qty:Number(x.qty)||0}})}}
async function cleanupOldOrders(autoMode){
  var user=globalThis.CU;if(!user||user.role!=='pharmacy')return;
  if(!autoMode&&user.master!==true)return globalThis.toast('Only Master can delete old orders manually.','err');
  var cutoff=orderRetentionCutoff(),all=globalThis.gr(),old=all.filter(function(r){var dt=new Date(r.created||r.fulfilledAt||0);return !isNaN(dt)&&dt<cutoff});
  if(!old.length){if(!autoMode)globalThis.toast('No orders older than 6 months.','info');return}
  if(!autoMode&&!await globalThis.uiConfirm('Delete '+old.length+' orders older than 6 months? Their dispensed quantities will remain in Analytics.'))return;
  var archive=(globalThis.S.g('request_analytics_archive')||[]).slice(),ids={};archive.forEach(function(x){ids[x.id]=true});
  old.forEach(function(r){if(r.status!=='pending'&&!ids[r.id])archive.push(requestArchiveRecord(r))});
  await globalThis.S.s('request_analytics_archive',archive);await globalThis.S.s('requests',all.filter(function(r){return old.indexOf(r)<0}));
  if(!autoMode)globalThis.toast(old.length+' old orders deleted; analytics preserved.','succ');
  if(document.querySelector('#pg-print.on'))globalThis.renderPrint();
}
globalThis._orderCleanupStarted=false;
function scheduleAutomaticOrderCleanup(){if(globalThis._orderCleanupStarted||!globalThis.CU||globalThis.CU.role!=='pharmacy')return;globalThis._orderCleanupStarted=true;cleanupOldOrders(true).catch(function(e){console.error('Automatic order cleanup failed',e)})}
Object.assign(globalThis,{orderRetentionCutoff,requestArchiveRecord,cleanupOldOrders,scheduleAutomaticOrderCleanup});
export {orderRetentionCutoff,requestArchiveRecord,cleanupOldOrders,scheduleAutomaticOrderCleanup};
