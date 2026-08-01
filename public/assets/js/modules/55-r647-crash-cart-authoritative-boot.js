(function(){
'use strict';
var attempts=0,done=false;
async function run(){
  if(done)return;
  attempts++;
  try{
    var role=String((window.fsEffectiveRole&&window.fsEffectiveRole())||(window.CU&&window.CU.role)||'');
    var canReconcile=window.fsHasCapability?window.fsHasCapability('crashCart.operate'):!!(window.CU&&(window.CU.master===true||['pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(role)>=0));
    if(canReconcile&&typeof window.fsReconcileCrashCartData==='function'&&typeof window.crashCarts==='function'&&(window.crashCarts()||[]).length){
      done=true;
      await window.fsReconcileCrashCartData();
      return;
    }
    if(window.CU&&!canReconcile){done=true;return}
  }catch(error){console.error('Crash Cart reconciliation failed',error)}
  if(attempts<12)setTimeout(run,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,300)},{once:true});
else setTimeout(run,300);
})();

export {};
