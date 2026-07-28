(function(){
  'use strict';
  window.recoverCrashCartsFromPublicSnapshots=async function(){
    throw new Error('Public Crash Cart recovery is disabled. Restore from an authenticated Master backup instead.');
  };
  window.ensureCrashRecoveryButton=function(){
    var button=document.getElementById('crash-restore-public-btn');
    if(button)button.remove();
  };
})();

export {};
