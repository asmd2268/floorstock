/* ASDHealth R6.65 Modular
 * Original script position: 16
 * Original id: (none)
 * Compatibility mode: classic script, original execution order preserved.
 */
/* Pilot fixes: split controlled lists, master manual delete, compact order printing, public expiry routes. */
(function(){
  function byId(id){return document.getElementById(id)}
  function isMasterUser(){return !!(window.CU&&CU.master===true)}

  /* Make the official print-header setting easy to find for Master. */
  function syncOfficialHeaderButton(){
    var b=byId('print-branding-btn');
    if(!b)return;
    b.style.display=isMasterUser()?'inline-flex':'none';
    b.textContent='⚙ Official Print Header';
    b.title='Master only: logo and four official print-header lines';
  }

  /* Master may delete any individual request, regardless of age. Fulfilled movement remains archived for analytics. */
  window.masterDeleteRequestNow=async function(id){
    if(!isMasterUser())return toast('Master permission required','err');
    var all=gr(),r=all.find(function(x){return x.id===id});
    if(!r)return;
    var dept=(gd().find(function(d){return d.id===r.deptId})||{}).name||r.deptId||'';
    if(!await uiConfirm('Delete this request now?\n\nDepartment: '+dept+'\nDate: '+fmtDate(r.created||r.fulfilledAt)+'\n\nFulfilled quantities will remain in Analytics.'))return;
    if(r.status!=='pending'){
      var archive=(S.g('request_analytics_archive')||[]).slice();
      if(!archive.some(function(x){return x.id===r.id}))archive.push(requestArchiveRecord(r));
      await S.s('request_analytics_archive',archive);
    }
    await S.s('requests',all.filter(function(x){return x.id!==id}));
    toast('Request deleted; analytics preserved ✓','succ');
    if(typeof renderReqs==='function')renderReqs();
    if(typeof renderPrint==='function')renderPrint();
    if(typeof renderDash==='function')renderDash();
  };


  /* Controlled medicines: two shared lists. Both custodians see both balances; each edits only their own custody. */
  window.syncOfficialHeaderButton=syncOfficialHeaderButton;
  
})();
