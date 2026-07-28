/* ASDHealth R6.65 Modular
 * Original script position: 58
 * Original id: r647-crash-cart-authoritative-boot
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
'use strict';
var attempts=0,done=false;
async function run(){
  if(done)return;
  attempts++;
  try{
    if(typeof window.fsReconcileCrashCartData==='function'&&typeof window.crashCarts==='function'&&(window.crashCarts()||[]).length){
      done=true;
      await window.fsReconcileCrashCartData();
      return;
    }
  }catch(error){console.error('Crash Cart reconciliation failed',error)}
  if(attempts<12)setTimeout(run,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,300)},{once:true});
else setTimeout(run,300);
})();
