(function(){
'use strict';
function isMasterHealthLocal(){return typeof window.isMaster==='function'?window.isMaster():!!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE)}
function setStatus(id,text,cls){var el=document.getElementById(id);if(!el)return;el.textContent=text;el.className='health-value '+(cls||'')}
window.runSystemHealthDiagnostics=async function(){
  if(!isMasterHealthLocal()){if(window.toast)toast('Master access only','err');return}
  var lines=[],start=performance.now(),online=navigator.onLine;
  setStatus('health-network',online?'Online':'Offline',online?'health-ok':'health-bad');lines.push((online?'✓':'✗')+' Network: '+(online?'online':'offline'));
  var hasFirebase=!!window.firebase;setStatus('health-firebase',hasFirebase?'Loaded':'Unavailable',hasFirebase?'health-ok':'health-bad');lines.push((hasFirebase?'✓':'✗')+' Firebase SDK: '+(hasFirebase?'loaded':'not loaded'));
  var authOk=false,userLabel='No signed-in user';try{var auth=window.auth||(hasFirebase&&firebase.auth?firebase.auth():null),u=auth&&auth.currentUser;authOk=!!u;userLabel=u?(u.email||u.uid||'Signed in'):'No signed-in user'}catch(e){userLabel='Auth error'}
  setStatus('health-auth',userLabel,authOk?'health-ok':'health-warn');lines.push((authOk?'✓':'!')+' Authentication: '+userLabel);
  var dbObj=window.db||null,fireOk=false,fireMsg='Not initialized';try{if(dbObj&&typeof dbObj.collection==='function'){var t0=performance.now();await dbObj.collection('departments').limit(1).get();fireOk=true;fireMsg=Math.round(performance.now()-t0)+' ms'}}catch(e){fireMsg=(e&&e.message)?e.message:'Read failed'}
  setStatus('health-firestore',fireMsg,fireOk?'health-ok':'health-bad');lines.push((fireOk?'✓':'✗')+' Firestore read: '+fireMsg);
  function count(name){try{return Array.isArray(window[name])?window[name].length:'—'}catch(e){return '—'}}
  lines.push('','Departments: '+count('DEPTS'),'Requests: '+count('REQS'),'Crash carts: '+count('CRASH_CARTS'),'Controlled medicines: '+count('CONTROLLED_MEDS'),'','Browser: '+navigator.userAgent,'Completed in '+Math.round(performance.now()-start)+' ms');
  var report=document.getElementById('health-report');if(report)report.textContent=lines.join('\n');var last=document.getElementById('health-last-run');if(last)last.textContent='Last run: '+new Date().toLocaleString('en-GB',{calendar:'gregory'});
};
function initial(){setStatus('health-network',navigator.onLine?'Online':'Offline',navigator.onLine?'health-ok':'health-bad')}
initial();window.addEventListener('online',initial);window.addEventListener('offline',initial);
})();

export {};
