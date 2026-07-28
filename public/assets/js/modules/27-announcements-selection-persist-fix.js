(function(){
  var INV_KEY='asd_inv_selected_by_department_v2';
  var IMP_KEY='asd_import_draft_v2';
  function q(id){return document.getElementById(id)}
  function readJSON(k,f){try{var v=JSON.parse(sessionStorage.getItem(k)||'null');return v==null?f:v}catch(e){return f}}
  function writeJSON(k,v){try{sessionStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function moveAnnouncementHostToTop(){
    var host=q('dept-announcement-host'),app=q('app');if(!host||!app)return;
    var nav=q('mnav');
    if(nav&&host.nextSibling!==nav)app.insertBefore(host,nav);
    else if(!nav&&app.firstChild!==host)app.insertBefore(host,app.firstChild);
  }
  /* Inventory selection is kept per department and survives page changes. */
  function invDept(){var s=q('inv-dept-sel');return s&&s.value||''}
  function invState(){return readJSON(INV_KEY,{})}
  function captureInventorySelection(){
    var d=invDept();if(!d)return;var st=invState(),ids=[];
    document.querySelectorAll('.inv-chk:checked').forEach(function(c){if(c.dataset.id)ids.push(c.dataset.id)});
    st[d]=ids;writeJSON(INV_KEY,st);
  }
  function restoreInventorySelection(){
    var d=invDept();if(!d)return;var ids=(invState()[d]||[]),set={};ids.forEach(function(x){set[x]=1});
    document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=!!set[c.dataset.id]});
    if(typeof window.onInvCheck==='function')window.onInvCheck();
  }
  window.captureInventorySelection=captureInventorySelection;
  window.restoreInventorySelection=restoreInventorySelection;
  window.clearInventorySelectionState=function(){var d=invDept(),st=invState();if(d){st[d]=[];writeJSON(INV_KEY,st)}};
/* Import draft and row selections survive switching to another page. */
  function saveImportDraft(){
    if(!Array.isArray(window.IROWS)||!window.IROWS.length)return;
    var d={rows:window.IROWS,dept:(q('imp-dept')||{}).value||'',text:(q('imp-txt')||{}).value||'',cat:(q('imp-cat')||{}).value||'auto'};
    writeJSON(IMP_KEY,d);
  }
  function restoreImportDraft(){
    var d=readJSON(IMP_KEY,null);if(!d||!Array.isArray(d.rows)||!d.rows.length)return false;
    window.IROWS=d.rows;
    var ds=q('imp-dept');if(ds&&d.dept)ds.value=d.dept;
    var ta=q('imp-txt');if(ta&&d.text!=null)ta.value=d.text;
    var cs=q('imp-cat');if(cs&&d.cat)cs.value=d.cat;
    if(typeof window.renderImportPreview==='function')window.renderImportPreview(false,-1,0,'<div class="alert-banner-y" style="margin-bottom:12px">تم استعادة مسودة الاستيراد والتحديدات المحفوظة / Import draft and selections restored.</div>');
    return true;
  }
  window.saveImportDraft=saveImportDraft;
  window.restoreImportDraft=restoreImportDraft;

  window.clearImportDraftState=function(){try{sessionStorage.removeItem(IMP_KEY)}catch(e){}window.IROWS=[]};

  window.persistTransientUiState=function(){captureInventorySelection();saveImportDraft()};
  window.restorePageTransientUi=function(id){moveAnnouncementHostToTop();if(id==='pg-import')restoreImportDraft()};

})();

export {};
