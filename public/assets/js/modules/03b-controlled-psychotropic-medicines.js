import { publishLegacy } from '../core/legacy-registry.js';

// ── CONTROLLED & PSYCHOTROPIC MEDICINES ────────────────────────────────
// Split out of 03-core-application-firebase-state-auth.js (Phase 3 module
// split). Every helper referenced here that isn't declared in this file
// (S, CU, esc, gd, toast, el, fmtDate, fmtDateTime, nowISO, uiPrompt,
// uiConfirm, OM, warnPublicSync, ctlMove, ctlCanEditDept, ctlCanEditCatalog,
// renderControlled, ensureXLSX, XLSX) is already published to globalThis by
// its owning module, so it resolves via normal global fallback — no import
// statements are needed for those.
globalThis.CTL_VIEW = 'overview';
function ctlCatalog(){return S.g('controlled_catalog')||[]}
async function ctlSetCatalog(v){if(typeof window.ctlCanAddCatalog==='function'&&!window.ctlCanAddCatalog())return ctlCatalog();var out=await S.s('controlled_catalog',v);try{if(window.FB_DB&&typeof ctlPublishDept==='function'){var ids=(typeof gd==='function'?(gd()||[]):[]).map(function(d){return d.id});await Promise.all(ids.map(function(id){return ctlPublishDept(id)}))}}catch(e){warnPublicSync('Controlled catalogue',e)}return out}
function ctlWarehouse(){return S.g('controlled_warehouse')||{}}
function ctlSetWarehouse(v){return S.s('controlled_warehouse',v)}
function ctlPharmacy(){return S.g('controlled_pharmacy_stock')||{}}
function ctlSetPharmacy(v){return S.s('controlled_pharmacy_stock',v)}
function ctlDeptList(dept){return S.g('controlled_dept_list_'+dept)||[]}
function ctlEnrichDeptList(list){
  var cat=ctlCatalog();
  return list.map(function(row){
    if(row.name)return row;
    var m=cat.find(function(m){return m.id===row.medId})||{};
    if(!m.name)return row;
    return Object.assign({},row,{name:m.name,moh:m.moh||row.moh||'',nupco:m.nupco||row.nupco||'',classification:m.classification||row.classification||'narcotic'});
  });
}
async function ctlSetDeptList(dept,v){var out=await S.s('controlled_dept_list_'+dept,ctlEnrichDeptList(v||[]));try{if(window.FB_DB&&typeof ctlPublishDept==='function')await ctlPublishDept(dept)}catch(e){warnPublicSync('Controlled custody',e)}return out}
function ctlMoves(){return S.g('controlled_moves')||[]}
async function ctlSaveMovementLog(record,context){
  try{await ctlMove(record);return true}catch(e){console.error((context||'Controlled action')+' movement log failed',e);return false}
}
function ctlIsOfficer(){return CU&&CU.role==='controlled_pharmacy'}
function ctlIsWarehouse(){return CU&&CU.role==='warehouse'}
function ctlDate(v){
  if(!v)return '';
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  var s=String(v).trim().replace(/ 00:00:00$/,'');
  var d=new Date(s);return isNaN(d)?s:d.toISOString().slice(0,10);
}
function ctlNum(v){var n=Number(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:0}
function ctlKey(moh,nupco,name){return 'cm_'+String(moh||nupco||name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,70)}
function ctlMedicine(id){return ctlCatalog().find(function(m){return m.id===id})||null}
function ctlBatchText(batches){return (batches||[]).length?(batches||[]).map(function(b){return '<div><span class="chip">'+(b.qty||0)+'</span> '+esc(fmtDate(b.expiry))+(b.lot?' · '+esc(b.lot):'')+'</div>'}).join(''):'—'}
function ctlCurrentDept(){var s=el('ctl-dept');return s&&s.value?s.value:(CU.deptId||'')}


function renderCtlPending(){
  if(!el('ctl-pending'))return;var pending=ctlMoves().filter(function(x){return x.type==='warehouse_send'&&x.status==='pending'});
  el('ctl-pending').innerHTML=pending.length?pending.map(function(x){var m=ctlMedicine(x.medId)||{};return '<div class="limit-row"><span><b>'+esc(m.name||'')+'</b> — Qty: '+ctlNum(x.qty)+(x.expiry?' · Exp: '+fmtDate(x.expiry):'')+'</span>'+(ctlIsOfficer()?'<span><button class="btn bs bxs" data-id="'+x.id+'" onclick="ctlReceiveDelivery(this.dataset.id,true)">Accept</button> <button class="btn bd2c bxs" data-id="'+x.id+'" onclick="ctlReceiveDelivery(this.dataset.id,false)">Reject</button></span>':'<span class="chip">Awaiting pharmacy officer</span>')+'</div>'}).join(''):'<div style="color:var(--tx2)">No pending deliveries.</div>';
}
function renderCtlLog(filters){
  if(!el('ctl-log'))return;
  filters=filters||{};
  var rows=ctlMoves().slice();
  if(filters.dept)rows=rows.filter(function(x){return x.dept===filters.dept});
  if(filters.action)rows=rows.filter(function(x){return x.type===filters.action});
  if(filters.medicine){
    var q=String(filters.medicine).trim().toLowerCase();
    rows=rows.filter(function(x){var m=ctlMedicine(x.medId)||{};return String(m.name||'').toLowerCase().indexOf(q)>=0});
  }
  if(filters.from){
    var from=new Date(filters.from);
    rows=rows.filter(function(x){var at=new Date(x.at);return !isNaN(at)&&at>=from});
  }
  if(filters.to){
    var to=new Date(filters.to);to.setHours(23,59,59,999);
    rows=rows.filter(function(x){var at=new Date(x.at);return !isNaN(at)&&at<=to});
  }
  rows=rows.slice(-200).reverse();
  el('ctl-log').innerHTML=rows.length?'<div class="tw"><table><thead><tr><th>Date</th><th>Action</th><th>Medicine</th><th>By</th><th>Details</th></tr></thead><tbody>'+rows.map(function(x){var m=ctlMedicine(x.medId)||{};return '<tr><td>'+fmtDateTime(x.at)+'</td><td>'+esc(x.type||'')+'</td><td>'+esc(m.name||'—')+'</td><td>'+esc(x.by||'')+'</td><td>'+esc(x.note||'')+'</td></tr>'}).join('')+'</tbody></table></div>':'<div style="color:var(--tx2)">No movements match the selected filters.</div>';
}
function ctlCustodyLogFilters(){
  return {
    dept:(el('custody-log-filter-dept')||{}).value||'',
    action:(el('custody-log-filter-action')||{}).value||'',
    medicine:(el('custody-log-filter-med')||{}).value||'',
    from:(el('custody-log-from')||{}).value||'',
    to:(el('custody-log-to')||{}).value||''
  };
}
function ctlOpenCustodyLog(){
  if(!el('mcustody-log'))return;
  var deptSel=el('custody-log-filter-dept');
  if(deptSel){
    var current=deptSel.value,depts=typeof gd==='function'?(gd()||[]):[];
    deptSel.innerHTML='<option value="">All departments / كل الأقسام</option>'+depts.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
    deptSel.value=current&&Array.from(deptSel.options).some(function(o){return o.value===current})?current:(ctlCurrentDept()||'');
  }
  var actionSel=el('custody-log-filter-action');
  if(actionSel){
    var currentAction=actionSel.value;
    var types=Array.from(new Set(ctlMoves().map(function(x){return x.type}).filter(Boolean))).sort();
    actionSel.innerHTML='<option value="">All types / الكل</option>'+types.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>'}).join('');
    actionSel.value=types.indexOf(currentAction)>=0?currentAction:'';
  }
  OM('mcustody-log');
  renderCtlLog(ctlCustodyLogFilters());
}
function ctlCustodyLogApplyFilters(){renderCtlLog(ctlCustodyLogFilters())}
function ctlCustodyLogClearFilters(){
  ['custody-log-filter-dept','custody-log-filter-med','custody-log-filter-action','custody-log-from','custody-log-to'].forEach(function(id){var input=el(id);if(input)input.value=''});
  renderCtlLog();
}
async function ctlSendToPharmacy(id){
  if(!ctlIsWarehouse())return;
  var original=ctlWarehouse()||{},next=Object.assign({},original),x=Object.assign({},original[id]||{}),qty=ctlNum(await uiPrompt('Quantity to send to pharmacy','0'));
  if(qty<=0||qty>ctlNum(x.system)+ctlNum(x.outside))return toast('Invalid or insufficient quantity','err');
  var expiry=ctlDate(await uiPrompt('Expiry date for sent batch',''));if(!expiry)return;
  var fromSystem=Math.min(qty,ctlNum(x.system)),fromOutside=qty-fromSystem;x.system=ctlNum(x.system)-fromSystem;x.outside=ctlNum(x.outside)-fromOutside;next[id]=x;
  try{await ctlSetWarehouse(next);await ctlMove({type:'warehouse_send',medId:id,qty:qty,expiry:expiry,fromSystem:fromSystem,fromOutside:fromOutside,status:'pending',note:'Sent to pharmacy; awaiting accept/reject'})}
  catch(e){console.error('Warehouse transfer save failed',e);var rollbackFailed=false;try{await ctlSetWarehouse(original)}catch(err){rollbackFailed=true;console.error('Warehouse transfer rollback failed',err)}return toast(rollbackFailed?'Transfer failed and the warehouse rollback could not be confirmed. Review the balance.':'Transfer failed. Warehouse balance was restored.','err')}
  renderControlled();toast('Transfer sent to pharmacy and marked pending ✓','succ');return true
}

async function ctlReceiveDelivery(moveId,accept){
  if(!ctlIsOfficer())return;
  var originalMoves=(ctlMoves()||[]).map(function(x){return Object.assign({},x)}),index=originalMoves.findIndex(function(x){return String(x.id)===String(moveId)});
  if(index<0||originalMoves[index].status!=='pending')return toast('This transfer is no longer pending.','err');
  var move=Object.assign({},originalMoves[index]),nextMoves=originalMoves.map(function(x){return Object.assign({},x)}),stockOriginal=null,stockNext=null,saveStock=null,rollbackStock=null;
  if(accept){
    stockOriginal=ctlPharmacy()||{};stockNext=Object.assign({},stockOriginal);var px=Object.assign({},stockOriginal[move.medId]||{}),newQty=ctlNum(px.qty!=null?px.qty:px.actualQty)+ctlNum(move.qty);
    px.qty=newQty;px.actualQty=newQty;px.batches=(px.batches||[]).map(function(b){return Object.assign({},b)});
    var same=px.batches.find(function(b){return String(b.expiry||'')===String(move.expiry||'')&&String(b.lot||'')===String(move.lot||'')});
    if(same)same.qty=ctlNum(same.qty)+ctlNum(move.qty);else px.batches.push({qty:ctlNum(move.qty),expiry:move.expiry||'',lot:move.lot||''});
    stockNext[move.medId]=px;saveStock=function(){return ctlSetPharmacy(stockNext)};rollbackStock=function(){return ctlSetPharmacy(stockOriginal)};
    nextMoves[index]=Object.assign({},move,{status:'accepted',type:'receipt_accepted',note:'Accepted by controlled-medicines pharmacy officer',resolvedAt:nowISO()});
  }else{
    var why=await uiPrompt('Reason for rejection');if(!why)return;
    stockOriginal=ctlWarehouse()||{};stockNext=Object.assign({},stockOriginal);var wx=Object.assign({},stockOriginal[move.medId]||{}),backSystem=move.fromSystem==null?ctlNum(move.qty):ctlNum(move.fromSystem),backOutside=move.fromOutside==null?0:ctlNum(move.fromOutside);
    wx.system=ctlNum(wx.system)+backSystem;wx.outside=ctlNum(wx.outside)+backOutside;stockNext[move.medId]=wx;saveStock=function(){return ctlSetWarehouse(stockNext)};rollbackStock=function(){return ctlSetWarehouse(stockOriginal)};
    nextMoves[index]=Object.assign({},move,{status:'rejected',type:'receipt_rejected',note:String(why).trim(),resolvedAt:nowISO()});
  }
  try{await saveStock();await S.s('controlled_moves',nextMoves)}catch(e){
    console.error('Controlled delivery resolution failed',e);var rollbackFailed=false;
    try{await rollbackStock()}catch(err){rollbackFailed=true;console.error('Controlled delivery stock rollback failed',err)}
    try{await S.s('controlled_moves',originalMoves)}catch(err){rollbackFailed=true;console.error('Controlled delivery movement rollback failed',err)}
    return toast(rollbackFailed?'The transfer update failed and rollback could not be confirmed. Review both warehouse and pharmacy balances.':'The transfer update failed. Stock and pending status were restored.','err')
  }
  renderControlled();toast(accept?'Transfer accepted into pharmacy custody ✓':'Transfer rejected and warehouse balance restored ✓','succ');return true
}

async function ctlAssignMedicineToDept(){
  if(!ctlCanEditDept())return;
  var dept=ctlCurrentDept(),cat=ctlCatalog(),assigned=new Set(ctlDeptList(dept).map(function(x){return x.medId}));
  return new Promise(function(resolve){
    var existing=document.getElementById('ctl-assign-modal');if(existing)existing.remove();
    var bg=document.createElement('div');bg.id='ctl-assign-modal';bg.className='modal-bg on';bg.style.zIndex='3000';
    var box=document.createElement('div');box.className='modal';
    box.style.cssText='width:560px;max-width:95vw;padding:0;overflow:hidden;border-radius:18px;display:flex;flex-direction:column;max-height:80vh';
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;gap:10px;flex-shrink:0';
    hdr.innerHTML='<div style="display:flex;align-items:center;gap:10px"><span style="font-size:20px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(31,111,235,.1)">💊</span><span style="font-size:15px;font-weight:700">Add from shared catalogue / إضافة من القائمة المشتركة</span></div><button class="xbtn" style="flex-shrink:0">✕</button>';
    var body=document.createElement('div');body.style.cssText='padding:0 20px;flex:1;overflow:hidden;display:flex;flex-direction:column;gap:10px';
    var searchWrap=document.createElement('div');searchWrap.style.cssText='flex-shrink:0';
    var srch=document.createElement('input');srch.type='text';srch.placeholder='Search by name, MOH code, or NUPCO code / ابحث بالاسم أو كود MOH أو NUPCO';srch.style.cssText='width:100%;margin:0';
    searchWrap.appendChild(srch);
    var listWrap=document.createElement('div');listWrap.style.cssText='overflow-y:auto;flex:1;border:1px solid var(--bd);border-radius:10px;background:var(--s2)';
    var hint=document.createElement('div');hint.style.cssText='padding:10px 14px;font-size:11.5px;color:var(--tx2);flex-shrink:0';hint.textContent='Click a medicine to select it, then press Add.';
    body.appendChild(searchWrap);body.appendChild(listWrap);body.appendChild(hint);
    var footer=document.createElement('div');
    footer.style.cssText='display:flex;gap:8px;justify-content:flex-end;padding:14px 20px 18px;border-top:1px solid var(--bd);background:var(--s2);flex-shrink:0';
    var cancelBtn=document.createElement('button');cancelBtn.className='btn bg';cancelBtn.textContent='Cancel';
    var addBtn=document.createElement('button');addBtn.className='btn bp';addBtn.textContent='Add / إضافة';addBtn.disabled=true;
    footer.appendChild(cancelBtn);footer.appendChild(addBtn);
    box.appendChild(hdr);box.appendChild(body);box.appendChild(footer);bg.appendChild(box);document.body.appendChild(bg);
    var selected=null;
    function renderList(q){
      var filt=cat.filter(function(m){return !q||[m.name,m.moh,m.nupco].join(' ').toLowerCase().includes(q.toLowerCase())});
      if(!filt.length){listWrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx2)">No matching medicines.</div>';selected=null;addBtn.disabled=true;return;}
      listWrap.innerHTML='<table style="width:100%;border-collapse:collapse"><tbody>'+
        filt.map(function(m){
          var already=assigned.has(m.id);
          return '<tr data-id="'+esc(m.id)+'" style="cursor:'+(already?'default':'pointer')+'"><td style="padding:9px 14px;border-bottom:1px solid var(--bd)'+( already?';opacity:.45':'')+'">'+(selected&&selected.id===m.id?'<b style="color:var(--acl)">▶ '+esc(m.name)+'</b>':'<b>'+esc(m.name)+'</b>')+'<div class="fhint">'+esc(m.classification||'narcotic')+' · MOH: '+esc(m.moh||'—')+' · NUPCO: '+esc(m.nupco||'—')+(already?' · <span style="color:var(--yll)">Already assigned</span>':'')+'</div></td></tr>';
        }).join('')+
      '</tbody></table>';
      listWrap.querySelectorAll('tr[data-id]').forEach(function(row){
        var id=row.dataset.id,med=filt.find(function(m){return m.id===id});
        if(!med||assigned.has(id))return;
        row.addEventListener('click',function(){selected=med;addBtn.disabled=false;renderList(srch.value);});
      });
    }
    renderList('');
    srch.addEventListener('input',function(){selected=null;addBtn.disabled=true;renderList(srch.value);});
    setTimeout(function(){srch.focus();},50);
    function close(){bg.style.opacity='0';bg.style.transition='opacity .15s';setTimeout(function(){bg.remove();resolve(false);},150);}
    hdr.querySelector('.xbtn').addEventListener('click',close);
    cancelBtn.addEventListener('click',close);
    bg.addEventListener('click',function(e){if(e.target===bg)close();});
    addBtn.addEventListener('click',async function(){
      if(!selected)return;
      var list=ctlDeptList(dept).slice();
      if(list.some(function(x){return x.medId===selected.id})){toast('Already assigned','err');return;}
      list.push({medId:selected.id,min:selected.min,max:selected.max,qty:0,batches:[]});
      addBtn.disabled=true;addBtn.textContent='Saving…';
      try{await ctlSetDeptList(dept,list)}catch(e){console.error('Department medicine assignment failed',e);toast('Medicine assignment was not saved.','err');addBtn.disabled=false;addBtn.textContent='Add / إضافة';return;}
      var movementSaved=await ctlSaveMovementLog({type:'dept_list_add',dept:dept,medId:selected.id,note:'Added to inpatient department list'},'Department medicine assignment');
      bg.remove();resolve(true);renderControlled();
      if(!movementSaved)toast('Medicine was assigned, but the movement log was not saved.','info');
      else toast('Medicine added to department list ✓','succ');
    });
  });
}
async function ctlRemoveDeptMedicine(id){
  if(!ctlCanEditDept()||!await uiConfirm('Remove this medicine from the department list?'))return;
  var dept=ctlCurrentDept(),next=ctlDeptList(dept).filter(function(x){return x.medId!==id});
  try{await ctlSetDeptList(dept,next)}catch(e){console.error('Department medicine removal failed',e);return toast('Medicine removal was not saved.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'dept_list_remove',dept:dept,medId:id,note:'Removed from inpatient department list'},'Department medicine removal');
  renderControlled();if(!movementSaved)toast('Medicine was removed, but the movement log was not saved.','info');return true
}
async function ctlImportRows(rows,source){
  if(!ctlCanEditCatalog())return toast('Only warehouse or controlled-medicines pharmacy officer may import.','err');
  var originalCat=ctlCatalog().map(function(m){return Object.assign({},m)}),originalWh=ctlWarehouse()||{},originalPh=ctlPharmacy()||{};
  var cat=originalCat.map(function(m){return Object.assign({},m)}),wh=Object.assign({},originalWh),ph=Object.assign({},originalPh),added=0,updated=0;
  var start=0;for(var z=0;z<Math.min(rows.length,20);z++){var s=String((rows[z]||[])[0]||'').toLowerCase();if(s.includes('code')){start=z+1;break}}
  for(var i=start;i<rows.length;i++){
    var r=rows[i]||[],moh=String(r[0]||'').trim(),nupco=String(r[1]||'').trim(),name=String(r[2]||r[10]||'').trim();if(!moh&&!nupco&&!name)continue;if(!name)continue;
    var found=cat.find(function(m){return (moh&&m.moh===moh)||(nupco&&m.nupco===nupco)||m.name.toLowerCase()===name.toLowerCase()}),id=found?found.id:ctlKey(moh,nupco,name),med={id:id,moh:moh,nupco:nupco,name:name,classification:found?found.classification:'narcotic',min:ctlNum(r[8]),max:ctlNum(r[9])};
    if(found){Object.assign(found,med);updated++}else{cat.push(med);added++}
    var sys=ctlNum(r[3]),outside=ctlNum(r[4]),q2=ctlNum(r[6]),total=sys+outside,q1=Math.max(total-q2,0),b1=ctlDate(r[5]),b2=ctlDate(r[7]);wh[id]={system:sys,outside:outside,batches:[b1?{qty:q1,expiry:b1,lot:''}:null,b2?{qty:q2,expiry:b2,lot:''}:null].filter(Boolean)};
    var pq=ctlNum(r[11]),pe=ctlDate(r[12]);ph[id]={qty:pq,batches:pe?[{qty:pq,expiry:pe,lot:''}]:[]};
  }
  var saved=[];
  try{await ctlSetCatalog(cat);saved.push('catalog');await ctlSetWarehouse(wh);saved.push('warehouse');await ctlSetPharmacy(ph);saved.push('pharmacy')}
  catch(e){
    console.error('Controlled master import failed',e);var rollbackFailed=false;
    for(var j=saved.length-1;j>=0;j--){try{if(saved[j]==='catalog')await ctlSetCatalog(originalCat);else if(saved[j]==='warehouse')await ctlSetWarehouse(originalWh);else await ctlSetPharmacy(originalPh)}catch(err){rollbackFailed=true;console.error('Controlled import '+saved[j]+' rollback failed',err)}}
    return toast(rollbackFailed?'Import failed and rollback could not be confirmed. Review the controlled catalogue and balances.':'Import was not saved. Previous data was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'master_import',note:'Imported '+source+'; added '+added+', updated '+updated},'Controlled master import');
  toast(movementSaved?'Import completed: '+added+' added, '+updated+' updated ✓':'Import completed, but the movement log was not saved.',movementSaved?'succ':'info');renderControlled();return true
}
async function ctlImportMasterFile(file){if(!file)return;try{await ensureXLSX()}catch(e){return toast('Excel library unavailable','err')};var reader=new FileReader();reader.onload=function(e){try{var wb=XLSX.read(e.target.result,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});ctlImportRows(rows,file.name)}catch(err){console.error(err);toast(err.message||'Import failed','err')}el('ctl-import-file').value=''};reader.readAsArrayBuffer(file)}
function ctlImportMasterText(){var t=el('ctl-import-text').value.trim();if(!t)return toast('Paste text first','err');var rows=t.split(/\r?\n/).map(function(line){return line.split('\t')});ctlImportRows(rows,'pasted text')}

publishLegacy("03b-controlled-psychotropic-medicines.js", {
  ctlCatalog,
  ctlSetCatalog,
  ctlWarehouse,
  ctlSetWarehouse,
  ctlPharmacy,
  ctlSetPharmacy,
  ctlDeptList,
  ctlEnrichDeptList,
  ctlSetDeptList,
  ctlMoves,
  ctlSaveMovementLog,
  ctlIsOfficer,
  ctlIsWarehouse,
  ctlDate,
  ctlNum,
  ctlKey,
  ctlMedicine,
  ctlBatchText,
  ctlCurrentDept,
  renderCtlPending,
  renderCtlLog,
  ctlOpenCustodyLog,
  ctlCustodyLogApplyFilters,
  ctlCustodyLogClearFilters,
  ctlSendToPharmacy,
  ctlReceiveDelivery,
  ctlAssignMedicineToDept,
  ctlRemoveDeptMedicine,
  ctlImportRows,
  ctlImportMasterFile,
  ctlImportMasterText,
});

export {};
