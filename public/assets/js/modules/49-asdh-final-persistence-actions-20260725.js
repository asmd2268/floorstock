(function(){
'use strict';

/* Returnable setters. Local-only printer/UI preferences remain intentionally local. */
/* Audit records are persistent too, but an audit failure never masks a completed primary action. */
window.auditAction=function(action,meta){
  try{var u=typeof actualUser==='function'?actualUser():(window.CU||{}),name=typeof actualActorName==='function'?actualActorName():(u.username||u.email||'Unknown');return S.push('audit_log',{action:action,meta:meta||{},at:typeof nowISO==='function'?nowISO():new Date().toISOString(),actorId:u.id||'',actor:name,effectiveRole:(window.CU&&CU.role)||'',masterActing:typeof isMasterActual==='function'?isMasterActual():!!u.master}).catch(function(err){console.error('Audit save failed',err);return false})}catch(err){console.error('Audit save failed',err);return Promise.resolve(false)}
};
window.ctlMove=function(v){
  var many=Array.isArray(v),input=many?v:[v],stamp=Date.now(),actor=(window.CU&&(CU.username||CU.email))||'Unknown';
  var records=input.filter(Boolean).map(function(item,index){var x=Object.assign({},item);x.id=x.id||'ctl_'+stamp+'_'+index+'_'+Math.random().toString(36).slice(2,7);x.at=x.at||(typeof nowISO==='function'?nowISO():new Date().toISOString());x.by=x.by||actor;return x});
  if(!records.length)return Promise.resolve(many?[]:null);
  var promise=many?S.s('controlled_moves',(typeof ctlMoves==='function'?(ctlMoves()||[]):[]).concat(records)).then(function(){return records}):S.push('controlled_moves',records[0]);
  promise.catch(function(err){console.error('Controlled movement save failed',err)});return promise
};

/* Inventory add/edit: success is shown only after Firestore confirms the write. */
window.saveDrug=async function(){
  var n=el('dname').value.trim();if(!n)return toast('Enter medication name','err');
  var deptId=window.EDID?(window.EDDEPT||el('ddept-sel').value):el('ddept-sel').value;if(!deptId)return toast('Select a department','err');
  var data={name:n,category:el('dcat').value,min:+el('dmin').value||0,max:+el('dmax').value||1,monthly:el('dmly').value?+el('dmly').value:null,high_alert:el('cha2').checked,hazard:el('chaz').checked,lasa:el('chls').checked,refrigerated:!!(el('chcool')&&el('chcool').checked)};
  try{
    if(window.EDID){
      var old=getMeds(deptId).find(function(m){return String(m.id)===String(EDID)});if(!old)throw new Error('Medicine no longer exists');
      await updMed(deptId,EDID,data);
      if(fsR17MedNorm(old.name)!==fsR17MedNorm(n))await fsR17RefreshMedicationReferences(deptId,EDID,old.name,n);
      if(typeof auditAction==='function')auditAction('medicine_renamed_or_edited',{deptId:deptId,medId:EDID,oldName:old.name,newName:n,sortOrder:old.sortOrder});
    }else{
      var added=await pushMed(deptId,Object.assign({},data,{createdAt:fsR17Now()}));
      if(typeof auditAction==='function')auditAction('medicine_added',{deptId:deptId,medId:added.id,name:added.name,sortOrder:added.sortOrder});
    }
    var ds=el('ddept-sel');if(ds)ds.disabled=false;CM('mdrug');renderInv();toast(window.EDID?'Updated without creating a new medicine ✓':'Added as a new medicine ✓','succ');window.EDID=null;window.EDDEPT=null;
  }catch(err){console.error(err);toast('Save failed — '+String(err&&err.message||err),'err')}
};
window.bulkChangeCategory=async function(){var ids=typeof getSelectedMedIds==='function'?getSelectedMedIds():[],newCat=(el('bulk-cat-sel')||{}).value,deptId=typeof getInvDept==='function'?getInvDept():'';if(!ids.length)return toast('Select medications first','err');if(!newCat)return toast('Choose a category to apply','err');try{var set=new Set(ids.map(String)),meds=(getMeds(deptId)||[]).map(function(m){return set.has(String(m.id))?Object.assign({},m,{category:newCat}):m});await setMeds(deptId,meds);toast(ids.length+' medications moved to "'+newCat+'" and saved ✓','succ');if(typeof clearInvSelection==='function')clearInvSelection();renderInv()}catch(err){console.error(err);toast('Category change was not saved.','err')}};

/* Request submission and fulfillment: no early success message. */
var requestSaving=false;
window.submitReq=async function(){
  if(requestSaving)return;
  if(!window.CU||String(CU.role)!=='department')return;
  if(typeof window.getNewRequestGateState==='function'){
    var gate=window.getNewRequestGateState(CU.deptId);
    if(gate&&gate.blocked)return toast((gate.reasonAr||'')+'\n'+(gate.reasonEn||''),'err');
  }else{
    var windowCheck=typeof isRequestAllowed==='function'?isRequestAllowed(CU.deptId):{allowed:true};if(!windowCheck.allowed){var next=windowCheck.next?(windowCheck.next.day+' '+windowCheck.next.time):'';return toast('Ordering is currently unavailable.'+(next?' Next: '+next:''),'err')}
    var monthly=typeof getMonthlyLimit==='function'?getMonthlyLimit(CU.deptId):null;if(monthly!==null&&typeof getMonthlyReqCount==='function'&&getMonthlyReqCount(CU.deptId)>=monthly)return toast('Monthly request limit reached ('+monthly+'/month). Contact pharmacy.','err');
    if(typeof window.checkRequestCountLimits==='function'){var countLimit=window.checkRequestCountLimits(CU.deptId);if(countLimit&&countLimit.blocked)return toast(countLimit.reason,'err')}
  }
  var items=Array.from(document.querySelectorAll('.rqi')).filter(function(i){return Number(i.value)>0}).map(function(i){return {medId:i.dataset.mid,qty:Number(i.value)}});
  if(!items.length)return toast('Enter at least one quantity','err');
  var nextDispense=typeof getNextDispSlot==='function'?getNextDispSlot(CU.deptId):null,btn=document.querySelector('#pg-newreq button[data-asdh-binding="b047"]');
  requestSaving=true;if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Saving… / جاري الحفظ'}
  try{var created=typeof nowISO==='function'?nowISO():new Date().toISOString(),deadline=typeof window.getRequestEditDeadline==='function'?window.getRequestEditDeadline(CU.deptId,created):null,payload={deptId:CU.deptId,deptName:CU.deptName,items:items,status:'pending',created:created,editUntil:Number.isFinite(deadline)?new Date(deadline).toISOString():null,scheduledFor:nextDispense?nextDispense.scheduledAt:null,scheduledLabel:nextDispense&&nextDispense.slot?nextDispense.slot.label:''};await S.push('requests',payload);await auditAction('request_submitted',{deptId:CU.deptId,itemCount:items.length,editUntil:payload.editUntil});toast('Request submitted and saved — '+items.length+' items ✓','succ');if(typeof renderReqForm==='function')renderReqForm();if(typeof renderMyReqs==='function')renderMyReqs()}catch(err){console.error(err);toast('Request was not saved. Check the connection and retry.','err')}finally{requestSaving=false;if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Submit';delete btn.dataset.oldText}if(typeof window.refreshNewRequestGate==='function')window.refreshNewRequestGate()}
};
var fulfillSaving=false;
window.submitFulfill=async function(){
  if(fulfillSaving)return;
  var current=(typeof gr==='function'?gr():[]).find(function(request){return String(request.id)===String(window.FRID)});
  var editing=!!(current&&current.status==='fulfilled');
  if(editing){
    if(typeof window.canEditFulfillmentRequest!=='function'||!window.canEditFulfillmentRequest(current))return toast('The fulfillment editing window has expired or this account is outside the permitted scope.','err');
  }else{
    if(typeof canManageRequests==='function'&&!canManageRequests())return toast('No request edit permission','err');
    if(typeof window.requestScheduledDispenseBlocked==='function'){var scheduleBlock=window.requestScheduledDispenseBlocked(current);if(scheduleBlock)return toast(scheduleBlock,'err');}
  }
  var inputs=Array.from((document.getElementById('ftbl')||document).querySelectorAll('input[data-med]'));inputs.forEach(function(x){x.style.borderColor='';x.style.boxShadow=''});
  var missing=inputs.find(function(x){return String(x.value).trim()===''});if(missing){missing.style.borderColor='var(--rd)';missing.focus();return toast('Enter the dispensed quantity for every item. Enter 0 if not dispensed.','err')}
  var bad=inputs.find(function(x){var q=Number(x.value);return !isFinite(q)||q<0});if(bad){bad.style.borderColor='var(--rd)';bad.focus();return toast('Dispensed quantity must be zero or a positive number.','err')}
  var dispensed=inputs.map(function(x){return {medId:x.dataset.med,qty:Number(x.value)}}),id=window.FRID,btn=document.getElementById('fulfill-btn');fulfillSaving=true;if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Saving…'}
  try{
    var stamp=typeof nowISO==='function'?nowISO():new Date().toISOString(),actor=typeof actualUser==='function'?(actualUser()||{}):(window.CU||{}),actorName=typeof actualActorName==='function'?actualActorName():(actor.username||actor.email||'');
    var beforeDispensed=editing?(current.dispensed||[]).map(function(x){return {medId:x.medId,qty:Number(x.qty)||0}}):[];
    var changes=editing?{dispensed:dispensed,fulfillmentEditedAt:stamp,fulfillmentEditedBy:actorName,fulfillmentEditedById:actor.id||'',fulfillmentEditedEffectiveRole:(window.CU&&CU.role)||'',fulfillmentEditRevision:Number(current.fulfillmentEditRevision||0)+1}:{dispensed:dispensed,status:'fulfilled',fulfilledAt:stamp,fulfilledBy:actorName,fulfilledById:actor.id||'',fulfilledEffectiveRole:(window.CU&&CU.role)||''};
    await S.upd('requests',id,changes);
    if(editing){await auditAction('request_fulfillment_edited',{requestId:id,deptId:current.deptId||'',fulfilledAt:current.fulfilledAt||'',revision:changes.fulfillmentEditRevision,before:beforeDispensed,after:dispensed})}
    else await auditAction('request_fulfilled',{requestId:id,deptId:current&&current.deptId||''});
    CM('mfulfill');renderReqs();if(typeof renderMyReqs==='function'&&window.CU&&CU.role==='department')renderMyReqs();if(typeof renderDash==='function')renderDash();toast(editing?'Fulfillment update saved and audited ✓':'Fulfillment saved permanently ✓','succ')
  }catch(err){console.error(err);toast('Fulfillment was not saved. Please retry.','err')}finally{fulfillSaving=false;if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Confirm';delete btn.dataset.oldText}}
};

/* Expiry and department receipt saves are batched into one Firestore write. */
window.saveAlertSettings=async function(){if(!window.CU)return;var d1=Math.max(1,+el('alert-days1').value||30),d2=Math.max(1,+el('alert-days2').value||7);if(d2>=d1)return toast('Urgent alert must be shorter than early alert','err');try{await setAlertSettings(CU.deptId,{d1:d1,d2:d2});toast('Department alert periods saved ✓','succ');renderShelfAlertSettings()}catch(e){toast('Alert settings were not saved.','err')}};
window.delBatch=async function(id,button){
  if(!await uiConfirm('Delete this expiry record? Batch/Lot may be blank.'))return;
  if(button)button.disabled=true;
  try{
    await delExpBatch(CU.deptId,id);
    renderShelves();
    toast('Expiry record deleted and verified ✓','info');
  }catch(e){
    console.error(e);
    if(button)button.disabled=false;
    toast(String(e&&e.message||'Expiry deletion was not saved.'),'err');
  }
};
window.saveExpiry=async function(){
  if(!window.CU)return;
  // The whole body is wrapped, not just the addExpBatch/updExpBatch call:
  // saveExpiry is async, so any error thrown here — including a null
  // el(id) lookup — never reaches dom-bindings.js's synchronous try/catch
  // (calling an async function never throws synchronously; it only ever
  // rejects the returned promise). Left uncaught, that rejection was only
  // ever recorded silently into window.__asdhRuntime diagnostics with no
  // toast — from the tapper's side, indistinguishable from the button
  // simply not responding. Catching everything here guarantees a visible
  // toast either way.
  var button=el('exp-save-btn');
  try{
    var medEl=el('exp-med-sel'),dateEl=el('exp-date-inp'),editEl=el('exp-edit-id'),lotEl=el('exp-batch-inp');
    if(!medEl||!dateEl||!editEl||!lotEl)return toast('The expiry form was not ready — close and reopen it. / النموذج لم يكن جاهزًا، أغلقه وأعد فتحه.','err');
    var medId=medEl.value;
    var date=dateEl.value;
    if(!medId||!date){
      return toast(
        'Medicine and expiry date are required. Batch/Lot is optional.',
        'err'
      );
    }

    var editId=editEl.value;
    var lot=lotEl.value.trim();
    var row={
      medId:medId,
      batch:lot,
      lot:lot,
      date:date,
      expiry:date
    };

    if(button)button.disabled=true;
    if(editId)await updExpBatch(CU.deptId,editId,row);
    else await addExpBatch(CU.deptId,row);
    if(typeof auditAction==='function')auditAction(editId?'expiry_edited':'expiry_added',{deptId:CU.deptId,medId:medId,date:date});

    CM('mexpiry');
    renderShelves();
    toast(
      'Expiry saved and verified. Batch/Lot remained optional ✓',
      'succ'
    );
  }catch(e){
    console.error(e);
    toast(String(e&&e.message||'Expiry was not saved.'),'err');
  }finally{
    if(button)button.disabled=false;
  }
};
window.v13SaveReceive=async function(){var modal=el('v13-receive-modal'),requestId=modal&&modal.dataset?String(modal.dataset.requestId||''):'';var req=(gr()||[]).find(function(x){return String(x.id)===requestId});if(!req)return toast('Request not available','err');var arr=(getExpiry(CU.deptId)||[]).slice(),received=[];document.querySelectorAll('#v13-receive-body tr[data-med]').forEach(function(tr){var date=tr.querySelector('.v13-r-exp').value,lot=tr.querySelector('.v13-r-lot').value.trim(),medId=tr.dataset.med,qty=Number(tr.dataset.qty||0);if(date){arr.push({id:'ex_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),medId:medId,expiry:date,date:date,batch:lot,lot:lot,qty:qty,sourceRequestId:requestId,receivedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()});received.push({medId:medId,qty:qty,expiry:date,batch:lot})}});try{await setExpiry(CU.deptId,arr);await S.upd('requests',requestId,{receivedAt:typeof nowISO==='function'?nowISO():new Date().toISOString(),receivedBy:typeof actualActorName==='function'?actualActorName():CU.username,receivedExpiry:received});await auditAction('department_request_received',{requestId:requestId,items:received});if(modal&&modal.dataset)delete modal.dataset.requestId;CM('v13-receive-modal');if(typeof renderMyReqs==='function')renderMyReqs();toast('All received items saved permanently ✓','succ')}catch(e){console.error(e);toast('Received items were not fully saved.','err')}};

/* Notes. */
window.submitNote=async function(){if(!window.CU||CU.role!=='department')return;var body=el('note-body').value.trim();if(!body)return toast('Write a note first','err');var notes=(getNotes()||[]).slice(),priority=el('note-priority').value,note={id:'n_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),deptId:CU.deptId,deptName:CU.deptName,username:CU.username,type:el('note-type').value,priority:priority,medName:el('note-med-name').value.trim(),body:body,status:priority==='urgent'?'urgent':'open',reply:'',created:typeof nowISO==='function'?nowISO():new Date().toISOString(),updatedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()};notes.push(note);try{await setNotes(notes);el('note-body').value='';el('note-med-name').value='';renderDeptNotes();updateNotesBadge();toast('Note submitted and saved ✓','succ')}catch(e){toast('Note was not saved.','err')}};
window.saveNoteReply=async function(){var id=el('note-reply-id').value,notes=(getNotes()||[]).map(function(n){return Object.assign({},n)}),i=notes.findIndex(function(n){return String(n.id)===String(id)});if(i<0)return;notes[i].reply=el('note-reply-txt').value.trim();notes[i].status=el('note-reply-status').value;notes[i].updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();try{await setNotes(notes);CM('mnote-reply');renderPharmNotes();updateNotesBadge();toast('Reply saved permanently ✓','succ')}catch(e){toast('Reply was not saved.','err')}};
window.quickResolve=async function(id){var notes=(getNotes()||[]).map(function(n){return Object.assign({},n)}),i=notes.findIndex(function(n){return String(n.id)===String(id)});if(i<0)return;notes[i].status='resolved';notes[i].updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();try{await setNotes(notes);renderPharmNotes();updateNotesBadge();toast('Marked as resolved and saved ✓','succ')}catch(e){toast('Resolution was not saved.','err')}};

/* Shelves. */
window.saveShelf=async function(){if(!window.CU)return;var name=el('shelf-name-inp').value.trim();if(!name)return toast('Enter shelf name','err');var editId=el('shelf-edit-id').value,data={name:name,desc:el('shelf-desc-inp').value.trim()};try{if(editId)await updShelf(CU.deptId,editId,data);else await addShelf(CU.deptId,data);CM('mshelf');renderShelves();toast('Shelf saved permanently ✓','succ')}catch(e){toast('Shelf was not saved.','err')}};
window.removeShelf=async function(id){if(!await uiConfirm('Remove this shelf? Medications will become unassigned.'))return;try{var meds=(getMeds(CU.deptId)||[]).map(function(m){return String(m.shelfId)===String(id)?Object.assign({},m,{shelfId:null}):m});await Promise.all([setMeds(CU.deptId,meds),delShelf(CU.deptId,id)]);renderShelves();toast('Shelf removed and saved ✓','info')}catch(e){toast('Shelf removal was not saved.','err')}};

/* Categories: one write per department, all awaited. */
window.addCategory=async function(){var n=el('new-cat-inp').value.trim();if(!n)return toast('Enter a category name','err');var cats=(getCategories()||[]).slice();if(cats.indexOf(n)>-1)return toast('Already exists','err');var sol=cats.filter(function(x){return String(x).trim().toLowerCase()==='solutions'});cats=cats.filter(function(x){return String(x).trim().toLowerCase()!=='solutions'});cats.push(n);cats=cats.concat(sol.length?sol:['Solutions']);try{await setCategories(cats);el('new-cat-inp').value='';renderCatList();refreshCatSelectors();toast('"'+n+'" added and saved ✓','succ')}catch(e){toast('Category was not saved.','err')}};

/* Schedule and limits. */
// Schedule CRUD moved to modules/68-schedule-controller.js.

/* Departments are committed as one awaited operation set. */
window.addDept=async function(){
  var n=el('ndname').value.trim();if(!n)return toast('Enter department name','err');
  var base=n.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,20)||'dept',id=base,c=2;
  while((gd()||[]).some(function(d){return d.id===id})){id=base+'_'+c++}
  var copyMode=(el('ndcopy')||{value:'empty'}).value||'empty',meds=[];
  if(copyMode==='default')meds=(window.MEDS||[]).map(function(m){return {id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name:m.n,category:m.c,min:m.mn,max:m.mx,monthly:null,high_alert:!!m.ha,hazard:!!m.hz,lasa:!!m.ls,created:typeof nowISO==='function'?nowISO():new Date().toISOString()}});
  else if(copyMode!=='empty')meds=(getMeds(copyMode)||[]).map(function(m){return Object.assign({},m,{id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)})});
  var department={id:id,name:n,created:typeof nowISO==='function'?nowISO():new Date().toISOString()},created=false;
  try{
    await S.push('departments',department);created=true;
    if(meds.length&&typeof window.inventorySafetyApprovedBulk==='function')await window.inventorySafetyApprovedBulk('create_department_inventory',function(){return setMeds(id,meds)});
    else await setMeds(id,meds);
    el('ndname').value='';renderUsers();fillDS();populateInvDeptSel();if(typeof window.renderRequestHourGridUI==='function')window.renderRequestHourGridUI();
    toast('"'+n+'" added and saved with '+meds.length+' medication(s) ✓','succ')
  }catch(error){
    console.error(error);
    if(created){
      try{await S.s('departments',(S.g('departments')||[]).filter(function(d){return String(d.id)!==String(id)}))}catch(rollbackError){console.error('Department rollback failed',rollbackError)}
      try{if(S.g('meds_'+id)!=null)await S.rm('meds_'+id)}catch(cleanupError){console.error('New department inventory cleanup failed',cleanupError)}
    }
    toast('Department creation was rolled back; no partial department was kept.','err')
  }
};
window.delDept=async function(id){
  var dept=(gd()||[]).find(function(item){
    return String(item.id)===String(id);
  });
  if(!dept)return window.purgeOrphanDepartment(id);

  var linked=(gu()||[]).filter(function(user){
    return [
      user&&user.deptId,
      user&&user.departmentId,
      user&&user.department
    ].some(function(value){
      return String(value||'')===String(id);
    });
  });

  if(linked.length){
    if(typeof toast==='function'){
      toast(
        'Delete or reassign '+linked.length+
        ' linked user account(s) before deleting this department.',
        'err'
      );
    }
    if(typeof showPg==='function')showPg('pg-users');
    return false;
  }

  var linkedCarts=(S.g('crash_carts')||[]).filter(function(cart){
    return String(cart&&cart.deptId||'')===String(id);
  });

  if(linkedCarts.length){
    if(typeof toast==='function'){
      toast(
        'Move or delete '+linkedCarts.length+
        ' crash cart(s) before deleting this department.',
        'err'
      );
    }
    if(typeof showPg==='function')showPg('pg-crash-ops');
    return false;
  }

  var count=(getMeds(id)||[]).length;
  var confirmed=await uiConfirm(
    'Delete department "'+(dept.name||id)+'" permanently?\n\n'+
    'This removes '+count+
    ' medications, expiry, shelves, alerts, and controlled department custody, '+
    'request schedules, limits, and current accountability balances. '+
    'Historical completed requests are retained for audit.'
  );
  if(!confirmed)return false;

  var deletionReport;
  try{
    deletionReport=await window.floorstockPurgeDepartmentState(
      id,
      [id,dept.name,dept.code].filter(Boolean),
      true
    );
  }catch(error){
    console.error(error);
    if(typeof toast==='function'){
      toast(
        'Department deletion stopped at: '+
        String(error&&error.message||error),
        'err'
      );
    }
    return false;
  }

  var uiFailures=window.floorstockDeleteUiRefresh();

  if(typeof toast==='function'){
    if(uiFailures.length){
      toast(
        'Department was deleted and verified. One screen refresh failed; '+
        'reopen the page to refresh that panel.',
        'info'
      );
    }else if(deletionReport.optionalFailed.length){
      toast(
        'Department deleted. A public QR cleanup will retry later.',
        'info'
      );
    }else{
      toast('Department deleted permanently and verified ✓','succ');
    }
  }

  return deletionReport;
};

})();

// --- Merged from 68-schedule-controller.js (Phase 6 consolidation) ---
(function(){
  var q=globalThis.el, toast=globalThis.toast, close=globalThis.CM, confirmFn=globalThis.uiConfirm;
  var legacyRenderSchedule=globalThis.renderSchedule;
  window.renderSchedule=function(){return typeof legacyRenderSchedule==='function'?legacyRenderSchedule.apply(this,arguments):undefined};
  function checkedDays(id){return Array.from(q(id).querySelectorAll('input:checked')).map(function(c){return +c.value})}
  function refresh(){if(typeof globalThis.renderSchedule==='function')globalThis.renderSchedule()}
  window.saveReqWindow=async function(){var label=q('rwin-label').value.trim(),from=q('rwin-from').value,to=q('rwin-to').value;if(!label)return toast('Enter a label','err');if(!from||!to)return toast('Set start and end time','err');var days=checkedDays('rwin-days');if(!days.length)return toast('Select at least one day','err');var wins=(globalThis.getReqWindows()||[]).slice(),idx=q('rwin-edit-id').value,w={label:label,dept:q('rwin-dept').value,from:from,to:to,days:days,active:q('rwin-active').checked};if(idx!=='')wins[+idx]=w;else wins.push(w);try{await globalThis.setReqWindows(wins);close('mreq-window');refresh();toast('Request window saved permanently ✓','succ')}catch(e){toast('Request window was not saved.','err')}};
  window.toggleWindow=async function(i){var wins=(globalThis.getReqWindows()||[]).map(function(x){return Object.assign({},x)});if(!wins[i])return;wins[i].active=!wins[i].active;try{await globalThis.setReqWindows(wins);refresh()}catch(e){toast('Window status was not saved.','err')}};
  window.delWindow=async function(i){if(!await confirmFn('Delete this window?'))return;var wins=(globalThis.getReqWindows()||[]).slice();wins.splice(i,1);try{await globalThis.setReqWindows(wins);refresh();toast('Window deleted and saved ✓','info')}catch(e){toast('Window deletion was not saved.','err')}};
  window.saveDispSlot=async function(){var label=q('dslot-label').value.trim(),from=q('dslot-from').value,to=q('dslot-to').value;if(!label)return toast('Enter a label','err');if(!from||!to)return toast('Set start and end time / حدد وقت البداية والنهاية','err');if(from>=to)return toast('End time must be after start time / وقت النهاية يجب أن يكون بعد البداية','err');var days=checkedDays('dslot-days');if(!days.length)return toast('Select at least one day','err');var slots=(globalThis.getDispSlots()||[]).slice(),idx=q('dslot-edit-id').value,v={label:label,dept:q('dslot-dept').value,from:from,to:to,time:from,days:days,notes:q('dslot-notes').value.trim()};if(idx!=='')slots[+idx]=v;else slots.push(v);try{await globalThis.setDispSlots(slots);close('mdisp-slot');refresh();toast('Dispense slot saved permanently ✓','succ')}catch(e){toast('Dispense slot was not saved.','err')}};
  window.delSlot=async function(i){if(!await confirmFn('Delete?'))return;var slots=(globalThis.getDispSlots()||[]).slice();slots.splice(i,1);try{await globalThis.setDispSlots(slots);refresh();toast('Dispense slot deleted and saved ✓','info')}catch(e){toast('Dispense slot deletion was not saved.','err')}};
  function saveLimits(selector,modal,message){var limits=Object.assign({},globalThis.getMonthlyLimits()||{});document.querySelectorAll(selector).forEach(function(input){var value=input.value.trim();if(value&&+value>0)limits[input.dataset.dept]=+value;else delete limits[input.dataset.dept]});return globalThis.setMonthlyLimits(limits).then(function(){if(modal)close(modal);refresh();toast(message,'succ')}).catch(function(){toast('Limits were not saved.','err')})}
  window.saveAllLimits=function(){return saveLimits('.monthly-lim-inp','', 'Limits saved permanently ✓')};
  window.saveBulkLimits=function(){return saveLimits('.blim-inp','mbulk-limits','All limits saved permanently ✓')};
  window.applyBulkLimit=function(){var field=q('bulk-limit-val'),raw=field?field.value:'',normalized=globalThis.normalizeMonthlyLimit(raw),value=normalized.value;if(raw&&String(raw).trim()&&!normalized.valid)return toast('Enter a positive monthly limit, or leave it empty for unlimited.','err');if(value&&field)field.value=value;document.querySelectorAll('#bulk-limits-per-dept .blim-inp').forEach(function(input){input.value=value});toast(value?('Applied '+value+' requests/month to all departments in this form. Click Save All Limits to confirm.'):'Cleared all limits in this form. Click Save All Limits to confirm.','info')};
  window.openBulkLimits=function(){var limits=globalThis.getMonthlyLimits();q('bulk-limit-val').value='';q('bulk-limits-per-dept').innerHTML=globalThis.renderBulkLimitsTable(globalThis.gd(),limits);globalThis.OM('mbulk-limits')};
  window.editReqWindow=function(i){var w=globalThis.getReqWindows()[i];if(!w)return;q('mreqwin-title').textContent='Edit Window';q('rwin-label').value=w.label||'';q('rwin-from').value=w.from||'';q('rwin-to').value=w.to||'';q('rwin-edit-id').value=i;q('rwin-active').checked=w.active!==false;globalThis.setScheduleDepartmentSelect(q('rwin-dept'),w.dept||'all');globalThis.setScheduleDays(q('rwin-days'),w.days||[]);globalThis.OM('mreq-window')};
  window.addDispSlot=function(){q('mdisp-title').textContent='Add Dispense Slot';q('dslot-label').value='';q('dslot-from').value='10:00';q('dslot-to').value='11:00';q('dslot-notes').value='';q('dslot-edit-id').value='';globalThis.setScheduleDepartmentSelect(q('dslot-dept'),'all');globalThis.setScheduleDays(q('dslot-days'),[0,1,2,3,4]);globalThis.OM('mdisp-slot')};
  window.editDispSlot=function(i){var s=globalThis.getDispSlots()[i];if(!s)return;q('mdisp-title').textContent='Edit Dispense Slot';q('dslot-label').value=s.label||'';q('dslot-from').value=s.from||s.time||'';q('dslot-to').value=s.to||'';q('dslot-notes').value=s.notes||'';q('dslot-edit-id').value=i;globalThis.setScheduleDepartmentSelect(q('dslot-dept'),s.dept||'all');globalThis.setScheduleDays(q('dslot-days'),s.days||[]);globalThis.OM('mdisp-slot')};
})();

// --- Merged from 54-r662-accountability-draft-protection.js (Phase 6 consolidation) ---
(function(){
'use strict';
var dirty=false,saving=false;
function root(){return document.getElementById('r17-accountability-root')}
function active(){var page=document.getElementById('pg-med-accountability');return !!(page&&page.classList.contains('on'))}
function dataHash(){
  if(!window.S||!S.g)return '';
  var keys=['accountability_assignments_v2','accountability_usage_v2','accountability_receipts_v2','accountability_regimens_v2'];
  try{return JSON.stringify(keys.map(function(k){return S.g(k)||[]}))}catch(e){return ''}
}
function indicator(){
  var r=root();if(!r)return null;var el=document.getElementById('r662-accountability-draft');
  if(!el){el=document.createElement('div');el.id='r662-accountability-draft';el.textContent='Unsaved form protected — background refresh is paused / النموذج غير محفوظ — تم إيقاف التحديث التلقائي';r.parentNode.insertBefore(el,r)}
  el.classList.toggle('on',dirty);return el
}
function markDirty(){if(!active()||saving)return;dirty=true;indicator()}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('#r17-accountability-root'))markDirty()},true);
document.addEventListener('change',function(e){if(e.target&&e.target.closest&&e.target.closest('#r17-accountability-root'))markDirty()},true);
var originalRefresh=window.refreshCurrentPage;
if(typeof originalRefresh==='function')window.refreshCurrentPage=refreshCurrentPage=function(){
  if(active()&&dirty&&!saving){indicator();return false}
  return originalRefresh.apply(this,arguments)
};
function wrapSave(name){
  var original=window[name];if(typeof original!=='function'||original.__r662)return;
  var wrapped=async function(){
    var before=dataHash();saving=true;
    try{var result=await original.apply(this,arguments),after=dataHash();if(after!==before){dirty=false;setTimeout(indicator,0)}return result}
    finally{saving=false}
  };wrapped.__r662=true;window[name]=wrapped
}
['acc2SaveAssignment','acc2SaveRegimenVersion','acc2SubmitUsage','acc2CreateReceipt','acc2Decision'].forEach(wrapSave);
window.__startAppExtensions=window.__startAppExtensions||[];
window.__startAppExtensions.push(function(){setTimeout(indicator,700)});
window.addEventListener('beforeunload',function(e){if(!dirty)return;e.preventDefault();e.returnValue=''});
})();


// --- Merged from 63-r668-request-lock-drafts-and-session-defaults.js (Phase 6 consolidation) ---
import { deriveNewRequestGateState } from '../core/new-request-gate-policy.js';

(function(){
'use strict';
var VERSION='R6.75.0';
const E=globalThis.E;
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function isDepartment(){return !!(window.CU&&role()==='department')}
function setValue(id,value){var node=E(id);if(!node)return;node.value=value;if(node.type==='checkbox'||node.type==='radio')node.checked=!!value}
function resetCrashView(){
  var tabs=E('v13as-crash-tabs');if(tabs)tabs.querySelectorAll('[data-view]').forEach(function(button){button.classList.toggle('active',button.dataset.view==='carts')});
  var list=E('crash-list');if(list)list.style.display='';
  var filters=E('ccx-filters')||E('v13-crash-filters');if(filters)filters.style.display='';
  var alerts=E('crash-open-alerts');if(alerts)alerts.style.display='';
  var log=E('v13as-opening-log');if(log)log.classList.remove('on');
}
var DEFAULTS={
  'ccx-dept':'','ccx-state':'','ccx-expiry':'','ccx-search':'',
  'v13as-log-dept':'all','v13as-log-month':'',
  'isrch':'','icatf':'','iclsf':'','inv-dept-sel':'','adept':'','aperiod':'month',
  'shelf-med-filter':'all','shelf-med-search':'','print-shelf-sel':'all','print-shelf-cls':'all',
  'notes-filter-dept':'','notes-filter-type':'','notes-filter-status':'',
  'controlled-storage-mode':'map','controlled-storage-filter':'all',
  'ctl-an-dept':'','ctl-clean-search':'','ctl-clean-class':'','ctl-clean-status':'all',
  'v16-r-status':'all','v16-r-age':'all','v16-r-search':'',
  'v16-inv-status-filter':'all','sim-mode-filter':'similar','sim-search':'',
  'all-inv-search':'','wh-receive-search':'','ph-expiry-top-filter':'all',
  'rsrch':''
};
window.resetFloorstockSessionFilters=function(){
  window.RFS='all';
  Object.keys(DEFAULTS).forEach(function(id){setValue(id,DEFAULTS[id])});
  document.querySelectorAll('select[id*="filter"]').forEach(function(select){if(Object.prototype.hasOwnProperty.call(DEFAULTS,select.id))return;select.selectedIndex=0});
  document.querySelectorAll('input[id*="search"]').forEach(function(input){input.value=''});
  ['all-inv-variants','all-inv-class-mismatch'].forEach(function(id){var node=E(id);if(node)node.checked=false});
  var identical=E('all-inv-hide-identical');if(identical)identical.checked=true;
  var requestTabs=document.querySelectorAll('#pg-reqs .tbtn');requestTabs.forEach(function(button,index){button.classList.toggle('on',index===0)});
  resetCrashView();
};
function requestRows(){return typeof window.gr==='function'?(window.gr()||[]):[]}
function currentGateState(){
  var departmentId=window.CU&&CU.deptId||'';
  var schedule=typeof window.isRequestAllowed==='function'?window.isRequestAllowed(departmentId):{allowed:true};
  var rolling=typeof window.checkRequestCountLimits==='function'?window.checkRequestCountLimits(departmentId):{blocked:false};
  var monthly=typeof window.getMonthlyLimit==='function'?window.getMonthlyLimit(departmentId):null;
  var used=monthly!==null&&typeof window.getMonthlyReqCount==='function'?window.getMonthlyReqCount(departmentId):0;
  return deriveNewRequestGateState({
    isDepartment:isDepartment(),
    departmentId:departmentId,
    requests:requestRows(),
    schedule:schedule,
    rollingLimit:rolling,
    monthlyLimit:monthly,
    monthlyUsed:used
  });
}
window.getNewRequestGateState=function(){return currentGateState()};
function removeLegacyBlockingWarnings(){
  ['r18-request-limit-warning','r668-monthly-limit-warning'].forEach(function(id){var old=E(id);if(old)old.remove()});
}
function renderGateWarning(state){
  var old=E('r670-new-request-gate-warning');if(old)old.remove();
  var scheduleInfo=E('req-sched-info');
  if(scheduleInfo)scheduleInfo.hidden=!!(state.blocked&&state.kind!=='schedule');
  if(!state.blocked||state.kind==='schedule'||state.kind==='department'||state.kind==='role')return;
  removeLegacyBlockingWarnings();
  var host=E('rfbody');if(!host)return;
  var warning=document.createElement('div');
  warning.id='r670-new-request-gate-warning';
  warning.className='r18-request-limit-warn blocked';
  warning.style.whiteSpace='normal';
  var ar=document.createElement('div');ar.dir='rtl';ar.textContent=(state.kind==='pending'?'⏳ ':'🚫 ')+(state.reasonAr||'');
  var en=document.createElement('div');en.dir='ltr';en.style.marginTop='5px';en.textContent=state.reasonEn||'';
  warning.appendChild(ar);warning.appendChild(en);
  host.insertAdjacentElement('beforebegin',warning);
}
function applyNewRequestGate(){
  if(!isDepartment())return {blocked:false,kind:'role'};
  var pg=E('pg-newreq');if(!pg)return currentGateState();
  var state=currentGateState(),blocked=!!state.blocked;
  pg.classList.toggle('new-request-gate-locked',blocked);
  pg.classList.toggle('pending-request-locked',state.kind==='pending');
  pg.querySelectorAll('.rqi').forEach(function(input){
    if(blocked){
      if(!input.disabled)input.dataset.newRequestGateLocked='1';
      input.disabled=true;
    }else if(input.dataset.newRequestGateLocked==='1'){
      delete input.dataset.newRequestGateLocked;
      if((+input.dataset.max||0)>0&&!input.dataset.editLocked)input.disabled=false;
    }
  });
  var submit=pg.querySelector('button[data-asdh-binding="b047"]');
  if(submit){
    submit.disabled=blocked;
    submit.setAttribute('aria-disabled',blocked?'true':'false');
    submit.title=blocked?((state.reasonEn||state.reasonAr||'New request is unavailable.')):'';
  }
  renderGateWarning(state);
  return state;
}
window.refreshNewRequestGate=applyNewRequestGate;
window.refreshRequestLimitPageLock=applyNewRequestGate;
function positionR18Banner(){
  var r18=document.getElementById('r18-request-limit-warning');
  var schedInfo=document.getElementById('req-sched-info');
  if(r18&&schedInfo&&schedInfo.nextSibling!==r18){
    schedInfo.parentNode&&schedInfo.parentNode.insertBefore(r18,schedInfo.nextSibling);
  }
}
window.__refreshRequestCountLimitWarningBeforeExtensions=window.__refreshRequestCountLimitWarningBeforeExtensions||[];
window.__refreshRequestCountLimitWarningBeforeExtensions.push(removeLegacyBlockingWarnings);
window.__refreshRequestCountLimitWarningExtensions=window.__refreshRequestCountLimitWarningExtensions||[];
window.__refreshRequestCountLimitWarningExtensions.push(function(){
  positionR18Banner();
  setTimeout(positionR18Banner,0);
  applyNewRequestGate();
});
window.__refreshRequestScheduleMessageExtensions=window.__refreshRequestScheduleMessageExtensions||[];
window.__refreshRequestScheduleMessageExtensions.push(function(){
  positionR18Banner();
  applyNewRequestGate();
});
function preserveDraftAround(name,pageId){
  var previous=window[name];if(typeof previous!=='function'||previous.__r668DraftWrapped)return;
  function wrapped(){
    var page=E(pageId),active=page&&page.classList.contains('on');
    if(active&&typeof window.persistTransientUiState==='function')window.persistTransientUiState();
    var result=previous.apply(this,arguments);
    if(active&&typeof window.restorePageTransientUi==='function')setTimeout(function(){window.restorePageTransientUi(pageId);if(pageId==='pg-newreq')applyNewRequestGate()},0);
    return result;
  }
  wrapped.__r668DraftWrapped=true;window[name]=wrapped;
}
preserveDraftAround('renderCrashOperations','pg-crash-ops');
// renderReqFormDebounced is owned by the canonical request renderer.  Do not
// replace it here: replacing it bypasses draft protection and creates a second
// render path that can erase quantities during realtime updates.
window.__startAppBeforeExtensions=window.__startAppBeforeExtensions||[];
window.__startAppExtensions=window.__startAppExtensions||[];
window.__startAppBeforeExtensions.push(function(){window.resetFloorstockSessionFilters()});
window.__startAppExtensions.push(function(){
  setTimeout(function(){
    window.resetFloorstockSessionFilters();
    var active=document.querySelector('.pg.on');
    if(active&&typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(active.id);
    setTimeout(function(){setValue('rsrch','');applyNewRequestGate()},0);
  },0);
});
// The canonical authentication module owns logout and invokes the reset helper.
// A second global wrapper can be wrapped again by compatibility modules and
// recurse until the browser reports “Maximum call stack size exceeded”.
document.documentElement.dataset.asdhSessionDefaults=VERSION;
})();

// Merged from 61-r666-form-draft-and-crash-report-protection.js (Phase 6).
(function(){
'use strict';
if(window.__asdhR666DraftProtectionInstalled)return;
window.__asdhR666DraftProtectionInstalled=true;
var restoring=false,dirty={newreq:false,bulk:false},timer=null;
var E=window.fsE;
function uid(){var u=window.FB_AUTH&&FB_AUTH.currentUser;return String(u&&u.uid||(window.CU&&(CU.id||CU.uid||CU.username))||'anonymous')}
function key(type){return 'asdh_r666_draft_'+uid()+'_'+type}
function read(type){try{var raw=sessionStorage.getItem(key(type))||localStorage.getItem(key(type))||'null';return JSON.parse(raw)}catch(e){return null}}
function write(type,value){var raw=JSON.stringify(value);try{sessionStorage.setItem(key(type),raw)}catch(e){console.warn('Session draft could not be stored.',e)}try{localStorage.setItem(key(type),raw)}catch(e){console.warn('Durable draft could not be stored.',e)}}
function clear(type){try{sessionStorage.removeItem(key(type))}catch(e){}try{localStorage.removeItem(key(type))}catch(e){}dirty[type]=false;notice('')}
function notice(text){var id='r666-draft-notice',node=E(id),page=document.querySelector('.pg.on');if(!text){if(node)node.remove();return}if(!node){node=document.createElement('div');node.id=id;node.className='alert-banner-y';node.style.margin='8px 0';if(page)page.insertBefore(node,page.firstChild)}if(node)node.textContent=text}
function captureNewRequest(){var host=E('pg-newreq');if(!host)return null;var quantities={};host.querySelectorAll('.rqi[data-mid]').forEach(function(input){if(String(input.value||'').trim())quantities[input.dataset.mid]=input.value});return {search:(E('rsrch')||{}).value||'',quantities:quantities,at:new Date().toISOString()}}
function restoreNewRequest(draft){if(!draft||!E('pg-newreq'))return;restoring=true;try{var search=E('rsrch');if(search)search.value=draft.search||'';Object.keys(draft.quantities||{}).forEach(function(id){var input=document.querySelector('#pg-newreq .rqi[data-mid="'+CSS.escape(String(id))+'"]');if(input)input.value=draft.quantities[id]});if(typeof window.cntItems==='function')window.cntItems()}finally{restoring=false}}
function replacementDraft(){return Array.from(document.querySelectorAll('#r17-cr-replacements .r17-replacement')).map(function(row){return {name:(row.querySelector('.r17-rep-name')||{}).value||'',concentration:(row.querySelector('.r17-rep-conc')||{}).value||'',qty:(row.querySelector('.r17-rep-qty')||{}).value||'',expiry:(row.querySelector('.r17-rep-exp')||{}).value||'',lot:(row.querySelector('.r17-rep-lot')||{}).value||''}})}
function captureBulk(){if(!E('pg-crash-ops'))return null;var carts={};document.querySelectorAll('[data-plan-cart]').forEach(function(box){var reps={};box.querySelectorAll('.r17-plan-include').forEach(function(input){var exp=box.querySelector('.r17-plan-exp[data-rep="'+CSS.escape(String(input.dataset.rep))+'"]');reps[input.dataset.rep]={include:input.checked,expiry:exp&&exp.value||''}});carts[box.dataset.planCart]={remove:(box.querySelector('.r17-plan-remove')||{}).value||'',seal:(box.querySelector('.r17-plan-seal')||{}).value||'',replacements:reps}});return {source:(E('r17-cr-source-med')||{}).value||'',expiry:(E('r17-cr-source-expiry')||{}).value||'',qty:(E('r17-cr-source-qty')||{}).value||'',note:(E('r17-cr-note')||{}).value||'',selected:Array.from(document.querySelectorAll('.r17-cr-cart-check:checked')).map(function(x){return x.value}),replacements:replacementDraft(),carts:carts,at:new Date().toISOString()}}
function setValue(selector,value){var node=document.querySelector(selector);if(node)node.value=value==null?'':value}
function restoreBulk(draft){if(!draft||!E('r17-cr-source-med'))return;restoring=true;try{
  E('r17-cr-source-med').value=draft.source||'';
  if(typeof window.r17CrashSourceChanged==='function')window.r17CrashSourceChanged();
  if(E('r17-cr-source-expiry'))E('r17-cr-source-expiry').value=draft.expiry||'';
  if(E('r17-cr-source-qty'))E('r17-cr-source-qty').value=draft.qty||'';
  if(E('r17-cr-note'))E('r17-cr-note').value=draft.note||'';
  var host=E('r17-cr-replacements');if(host){host.innerHTML='';(draft.replacements||[]).forEach(function(rep){window.r17CrashAddReplacement();var row=host.lastElementChild;if(!row)return;setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-name',rep.name);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-conc',rep.concentration);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-qty',rep.qty);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-exp',rep.expiry);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-lot',rep.lot)});if(!host.children.length&&typeof window.r17CrashAddReplacement==='function')window.r17CrashAddReplacement()}
  if(typeof window.r17CrashScanMatches==='function')window.r17CrashScanMatches();
  (draft.selected||[]).forEach(function(id){var box=document.querySelector('.r17-cr-cart-check[value="'+CSS.escape(String(id))+'"]');if(box)box.checked=true});
  if(typeof window.r17CrashRenderMatrix==='function')window.r17CrashRenderMatrix();
  Object.keys(draft.carts||{}).forEach(function(id){var box=document.querySelector('[data-plan-cart="'+CSS.escape(String(id))+'"]'),saved=draft.carts[id];if(!box)return;var remove=box.querySelector('.r17-plan-remove'),seal=box.querySelector('.r17-plan-seal');if(remove)remove.value=saved.remove||'';if(seal)seal.value=saved.seal||'';var savedReps=Object.values(saved.replacements||{}),includes=box.querySelectorAll('.r17-plan-include'),exps=box.querySelectorAll('.r17-plan-exp');includes.forEach(function(input,index){if(savedReps[index])input.checked=savedReps[index].include!==false});exps.forEach(function(input,index){if(savedReps[index])input.value=savedReps[index].expiry||''})})
 }finally{restoring=false}}
function hasNewRequestData(draft){return !!(draft&&(draft.search||Object.keys(draft.quantities||{}).length))}
function hasBulkData(draft){return !!(draft&&(draft.source||draft.expiry||draft.qty||draft.note||(draft.selected||[]).length||(draft.replacements||[]).some(function(r){return r.name||r.concentration||r.expiry||r.lot||Number(r.qty)!==1})))}
function persist(){var active=document.querySelector('.pg.on'),id=active&&active.id;if(id==='pg-newreq'){var d=captureNewRequest();if(hasNewRequestData(d)){write('newreq',d);dirty.newreq=true}else if(dirty.newreq)clear('newreq')}else if(id==='pg-crash-ops'){var b=captureBulk();if(hasBulkData(b)){write('bulk',b);dirty.bulk=true}else if(dirty.bulk)clear('bulk')}}
window.__persistTransientUiExtensions=window.__persistTransientUiExtensions||[];
window.__persistTransientUiExtensions.push(persist);
window.__restorePageTransientUiExtensions=window.__restorePageTransientUiExtensions||[];
window.__restorePageTransientUiExtensions.push(function(id){setTimeout(function(){if(id==='pg-newreq')restoreNewRequest(read('newreq'));if(id==='pg-crash-ops')restoreBulk(read('bulk'))},0)});
document.addEventListener('input',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(!page)return;if(page.id==='pg-newreq'){dirty.newreq=true}else if(page.id==='pg-crash-ops'){dirty.bulk=true}else return;clearTimeout(timer);timer=setTimeout(persist,120)});
document.addEventListener('change',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(page&&(page.id==='pg-newreq'||page.id==='pg-crash-ops')){dirty[page.id==='pg-newreq'?'newreq':'bulk']=true;persist()}});
window.addEventListener('beforeunload',persist);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')persist()});
window.floorstockShouldProtectAutoRefresh=function(pageId){var type=pageId==='pg-newreq'?'newreq':pageId==='pg-crash-ops'?'bulk':'';if(!type||!dirty[type])return false;persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return true};
var originalRefresh=window.refreshCurrentPage;
if(typeof originalRefresh==='function')window.refreshCurrentPage=function(){var active=document.querySelector('.pg.on'),type=active&&active.id==='pg-newreq'?'newreq':active&&active.id==='pg-crash-ops'?'bulk':'';if(type&&dirty[type]){persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return}return originalRefresh.apply(this,arguments)};
var originalSubmit=window.submitReq;if(typeof originalSubmit==='function')window.submitReq=async function(){var before=(typeof gr==='function'?(gr()||[]):[]).length,result=await originalSubmit.apply(this,arguments),after=(typeof gr==='function'?(gr()||[]):[]).length;if(after>before)clear('newreq');return result};
var r17BulkBeforeCount=0;
window.__r17CrashExecuteBulkBeforeExtensions=window.__r17CrashExecuteBulkBeforeExtensions||[];
window.__r17CrashExecuteBulkBeforeExtensions.push(function(){r17BulkBeforeCount=(typeof crashReports==='function'?(crashReports()||[]):[]).length});
window.__r17CrashExecuteBulkExtensions=window.__r17CrashExecuteBulkExtensions||[];
window.__r17CrashExecuteBulkExtensions.push(function(){var after=(typeof crashReports==='function'?(crashReports()||[]):[]).length;if(after>r17BulkBeforeCount)clear('bulk')});
// crashCloseReport is defined by module 80, which loads after this module, so a
// wrapper here would always find window.crashCloseReport undefined and never run.
// Left removed rather than kept as unreachable code (confirmed dead via
// TRACE_COMPENSATION_NOTICE_DUP.md investigation).
window.clearFloorstockFormDraft=function(type){clear(type)};
})();


// --- Merged from 48-asdh-final-request-completion-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function num(v){v=Number(v);return isFinite(v)?v:0}
function normalText(v){
  return typeof window.fsMedNorm==='function'
    ?window.fsMedNorm(v)
    :String(v==null?'':v).trim().toLowerCase().replace(/\s+/g,' ');
}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function canEdit(){return typeof window.isMaster==='function'&&window.isMaster()}
function actor(){return window.fsActor?window.fsActor():{name:'Unknown',user:'Unknown',id:''}}
function now(){return typeof nowISO==='function'?nowISO():new Date().toISOString()}
function rules(){var x={};try{x=(window.S&&S.g)?(S.g('pharmacy_department_expiry_rules')||{}):{}}catch(e){}var u=Math.max(1,num(x.urgentDays||7)),n=Math.max(u+1,num(x.nearDays||30));return {urgentDays:u,nearDays:n}}
function canonical(nameOrItem,strength){if(typeof window.fsCrashCanonicalMedication==='function')return window.fsCrashCanonicalMedication(nameOrItem,strength);var it=(nameOrItem&&typeof nameOrItem==='object')?nameOrItem:{name:nameOrItem,strength:strength,concentration:strength};return {generic:String(it.name||it.genericName||'').trim(),concentration:String(it.strength||it.concentration||strength||'').trim()}}
function medicationIdentity(itemOrName){return normalText(canonical(itemOrName).generic)}
function cartHasMedication(cart,source){var wanted=medicationIdentity(source);return !!wanted&&(cart.items||[]).some(function(item){return medicationIdentity(item)===wanted})}
function cleanRequestedGeneric(name,strength){var resolved=canonical({name:name,strength:strength,concentration:strength});return resolved.generic||String(name||'').trim()}
function normalizedMedication(name,concentration){var m=canonical(name,concentration);return {name:m.generic,concentration:m.concentration}}
function id(){return 'cci_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)}
function closeEditor(){var m=E('cc-final-editor');if(m)m.remove()}
function batchHtml(b){b=b||{};return '<div class="ccfe-batch"><input class="ccfe-exp" type="date" value="'+esc(b.expiry||'')+'"><input class="ccfe-bqty" type="number" min="0" step="any" value="'+esc(b.qty==null?'':b.qty)+'" placeholder="Qty"><input class="ccfe-lot" value="'+esc(b.lot||'')+'" placeholder="Lot / Batch"><button class="btn bd2c bxs ccfe-remove-batch" type="button">×</button></div>'}
function itemHtml(it){it=it||{};var med=canonical(it),req=Math.max(0,num(it.qty)),av=Math.max(0,num(it.present==null?it.qty:it.present)),status=av<=0?'out':(av<req?'partial':'available');return '<tr class="ccfe-item" data-id="'+esc(it.id||id())+'"><td><input class="ccfe-item-name" value="'+esc(med.generic)+'" placeholder="Generic name / الاسم العلمي"></td><td><input class="ccfe-item-conc" value="'+esc(med.concentration)+'" placeholder="Strength"></td><td><input class="ccfe-item-required" type="number" min="0" step="any" value="'+req+'"></td><td><input class="ccfe-item-available" type="number" min="0" step="any" value="'+av+'"></td><td><select class="ccfe-item-status"><option value="available" '+(status==='available'?'selected':'')+'>Available / متوفر</option><option value="partial" '+(status==='partial'?'selected':'')+'>Partially available / متوفر جزئياً</option><option value="out" '+(status==='out'?'selected':'')+'>Out of Stock / غير متوفر</option></select></td><td><div class="ccfe-batch-list">'+((it.batches||[]).map(batchHtml).join(''))+'</div><button class="btn bg bxs ccfe-add-batch" type="button">+ Add expiry / إضافة انتهاء</button></td><td><button class="btn bd2c bxs ccfe-delete-item" type="button">Delete</button></td></tr>'}
function ensureEditor(cart,addBlank){closeEditor();var html='<div class="modal-bg on" id="cc-final-editor" role="dialog" aria-modal="true"><div class="modal"><div class="ccfe-head"><div><div class="mt">Manage Crash Cart contents / تعديل محتويات العربة</div><div class="fhint">'+esc(cart.name||'Crash Cart')+'</div></div><button class="xbtn" id="ccfe-close" type="button">×</button></div><div class="ccfe-body"><div class="ccfe-help"><b>Authorized roles:</b> Pharmacy Director and Inpatient Pharmacy Supervisor only. Every available quantity must be allocated to expiry dates. Lot/Batch is always optional. Available quantity cannot exceed required quantity.</div><input id="ccfe-cart-id" type="hidden" value="'+esc(cart.id)+'"><div class="tw"><table class="ccfe-table"><thead><tr><th class="ccfe-name">Medication</th><th class="ccfe-conc">Strength</th><th class="ccfe-required">Required</th><th class="ccfe-available">Available</th><th class="ccfe-status">Status</th><th class="ccfe-batches">Expiry date → Qty → Lot</th><th class="ccfe-delete"></th></tr></thead><tbody id="ccfe-rows">'+((cart.items||[]).map(itemHtml).join(''))+(addBlank?itemHtml({id:id(),qty:1,present:1,batches:[]}):'')+'</tbody></table></div><button class="btn bg bsm" id="ccfe-add-item" type="button" style="margin-top:10px">+ Add medication / إضافة علاج</button></div><div class="ccfe-footer"><div id="ccfe-error" class="ccfe-error"></div><div class="fl g8"><button class="btn bg" id="ccfe-cancel" type="button">Cancel</button><button class="btn bs" id="ccfe-save" type="button">Save contents / حفظ المحتويات</button></div></div></div></div>';document.body.insertAdjacentHTML('beforeend',html);var m=E('cc-final-editor');E('ccfe-close').onclick=closeEditor;E('ccfe-cancel').onclick=closeEditor;E('ccfe-save').onclick=saveEditor;E('ccfe-add-item').onclick=function(){E('ccfe-rows').insertAdjacentHTML('beforeend',itemHtml({id:id(),qty:1,present:1,batches:[]}))};m.onclick=function(ev){if(ev.target===m)closeEditor();var add=ev.target.closest&&ev.target.closest('.ccfe-add-batch');if(add){add.parentElement.querySelector('.ccfe-batch-list').insertAdjacentHTML('beforeend',batchHtml({}));return}var rem=ev.target.closest&&ev.target.closest('.ccfe-remove-batch');if(rem){rem.closest('.ccfe-batch').remove();return}var del=ev.target.closest&&ev.target.closest('.ccfe-delete-item');if(del){del.closest('.ccfe-item').remove();return}};m.onchange=function(ev){var row=ev.target.closest&&ev.target.closest('.ccfe-item');if(!row)return;var st=row.querySelector('.ccfe-item-status'),req=row.querySelector('.ccfe-item-required'),av=row.querySelector('.ccfe-item-available');if(ev.target===st){if(st.value==='out')av.value='0';else if(st.value==='available')av.value=String(Math.max(0,num(req.value)))}};
  // Status is a derived value, not an independent one — editing Required or
  // Available directly must keep the Status dropdown in sync live, otherwise
  // a stale "Partial" survives a correction that makes the two numbers equal
  // and saveEditor's validation (which used to trust this dropdown) rejects
  // an otherwise-valid correction.
  m.oninput=function(ev){var row=ev.target.closest&&ev.target.closest('.ccfe-item');if(!row)return;if(ev.target.classList.contains('ccfe-item-required')||ev.target.classList.contains('ccfe-item-available')){var st=row.querySelector('.ccfe-item-status'),req=row.querySelector('.ccfe-item-required'),av=row.querySelector('.ccfe-item-available');st.value=ccfeStatusFromQty(num(av.value),num(req.value))}};
  var firstName=E('ccfe-rows').querySelector('.ccfe-item-name');if(firstName)firstName.focus()}
function ccfeStatusFromQty(available,required){if(available<=0)return 'out';if(available<required)return 'partial';return 'available'}
function openEditor(cartId,addBlank){if(!canEdit()){if(typeof toast==='function')toast('Only the Pharmacy Director or Inpatient Pharmacy Supervisor can edit Crash Cart contents.','err');return false}var c=typeof crashCart==='function'?crashCart(cartId):null;if(!c)return false;ensureEditor(c,!!addBlank);return true}
async function saveEditor(){if(!canEdit())return;var cartId=(E('ccfe-cart-id')||{}).value,carts=typeof crashCarts==='function'?(crashCarts()||[]):[],cart=carts.find(function(c){return String(c.id)===String(cartId)}),err=E('ccfe-error'),save=E('ccfe-save');if(!cart)return;function fail(m){if(err)err.textContent=m;if(typeof toast==='function')toast(m,'err');return false}var items=[],names={};var rows=Array.from(E('ccfe-rows').querySelectorAll('.ccfe-item'));for(var i=0;i<rows.length;i++){var row=rows[i],rawName=row.querySelector('.ccfe-item-name').value,rawConc=row.querySelector('.ccfe-item-conc').value,med=normalizedMedication(rawName,rawConc),required=num(row.querySelector('.ccfe-item-required').value),available=num(row.querySelector('.ccfe-item-available').value);if(!med.name)return fail('Medication name is required in row '+(i+1)+'.');var nk=(med.name+'|'+med.concentration).toLowerCase();if(names[nk])return fail('Duplicate medication in row '+(i+1)+'.');names[nk]=1;if(required<0||available<0)return fail('Quantities cannot be negative in row '+(i+1)+'.');if(available>required)return fail('Available quantity cannot exceed required quantity in row '+(i+1)+'.');var batches=[];Array.from(row.querySelectorAll('.ccfe-batch')).forEach(function(b){var expiry=b.querySelector('.ccfe-exp').value,qty=num(b.querySelector('.ccfe-bqty').value),lot=b.querySelector('.ccfe-lot').value.trim();if(expiry||qty||lot)batches.push({expiry:expiry,qty:qty,lot:lot})});if(available===0)batches=[];else{if(!batches.length)return fail('At least one expiry date is required for every available medication in row '+(i+1)+'.');for(var j=0;j<batches.length;j++){if(!batches[j].expiry||!(batches[j].qty>0))return fail('Every expiry row requires a date and quantity greater than zero in medication row '+(i+1)+'.')}var total=batches.reduce(function(s,b){return s+num(b.qty)},0);if(Math.abs(total-available)>0.000001)return fail('Expiry quantities ('+total+') must equal available quantity ('+available+') in row '+(i+1)+'.')}items.push({id:row.dataset.id||id(),name:med.name,genericName:med.name,strength:med.concentration,concentration:med.concentration,qty:required,present:available,batches:batches,stockStatus:available<=0?'out_of_stock':(available<required?'partial':'available'),stockUpdatedAt:now(),stockUpdatedBy:actor().name})}if(save){save.disabled=true;save.textContent='Saving... / جاري الحفظ'}try{cart.items=items;cart.updatedAt=now();cart.updatedBy=actor().name;cart.updatedByUser=actor().user;await setCrashCarts(carts);if(typeof auditAction==='function')auditAction('crash_cart_contents_update',{cartId:cart.id,itemCount:items.length,updatedBy:actor().user,authorizedRole:role()});closeEditor();if(typeof renderCrashCarts==='function')renderCrashCarts();if(typeof toast==='function')toast('Crash Cart contents saved ✓','succ')}catch(ex){fail(String((ex&&ex.message)||ex))}finally{if(save&&document.body.contains(save)){save.disabled=false;save.textContent='Save contents / حفظ المحتويات'}}}
window.crashAddItem=function(id){return openEditor(id,true)};
function closeBulkMedicationModal(){var m=E('cc-bulk-med-modal');if(m)m.remove()}
function cartMedicationNames(cart){return (cart.items||[]).map(function(it){return canonical(it).generic}).filter(Boolean)}
window.openCrashBulkMedicationModal=function(){
 if(!canEdit()){if(typeof toast==='function')toast('Only authorized pharmacy roles can update Crash Cart medication names.','err');return false}
 closeBulkMedicationModal();
 var carts=typeof crashCarts==='function'?(crashCarts()||[]):[];
 var names={};carts.forEach(function(c){cartMedicationNames(c).forEach(function(n){names[n]=1})});
 var options=Object.keys(names).sort().map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');
 var cartRows=carts.map(function(c){return '<label class="ccbm-cart"><input type="checkbox" class="ccbm-cart-check" value="'+esc(c.id)+'"><span><b>'+esc(c.name||'Crash Cart')+'</b><br><small>'+esc(deptName(c.deptId))+'</small><small class="ccbm-availability" style="display:block"></small></span></label>'}).join('');
 var html='<div class="modal-bg on" id="cc-bulk-med-modal"><div class="modal"><div class="mh"><div class="mt">Apply medication identity to selected Crash Carts / تطبيق اسم علاج على عربات محددة</div><button class="xbtn" id="ccbm-x" type="button">×</button></div><div class="ccfe-help">This changes only the Generic Name and Strength for the matching medication. Quantities, expiry dates, lots, IDs and history remain unchanged.</div><label>Medication to replace / العلاج المراد استبدال اسمه</label><select id="ccbm-source"><option value="">Select medication...</option>'+options+'</select><div class="ccbm-grid"><div><label>Generic Name / الاسم العلمي</label><input id="ccbm-generic" placeholder="Example: Calcium Chloride 10%"></div><div><label>Strength / التركيز</label><input id="ccbm-strength" placeholder="Example: 1g/10ml"></div></div><div class="fl jb ic" style="margin:4px 0 8px"><b>Select Crash Carts / اختر العربات</b><button class="btn bg bxs" id="ccbm-all" type="button">Select all</button></div><div class="ccbm-carts">'+cartRows+'</div><div class="ccbm-error" id="ccbm-error"></div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" id="ccbm-cancel" type="button">Cancel</button><button class="btn bs" id="ccbm-save" type="button">Apply to selected carts</button></div></div></div>';
 document.body.insertAdjacentHTML('beforeend',html);
 E('ccbm-x').onclick=closeBulkMedicationModal;E('ccbm-cancel').onclick=closeBulkMedicationModal;
 function refreshCartEligibility(showMessage){
   var source=String((E('ccbm-source')||{}).value||''),missing=[];
   Array.from(document.querySelectorAll('.ccbm-cart-check')).forEach(function(input){
     var cart=carts.find(function(row){return String(row.id)===String(input.value)}),available=!!(source&&cart&&cartHasMedication(cart,source)),note=input.closest('label').querySelector('.ccbm-availability');
     input.disabled=!available;
     if(!available){input.checked=false;if(source&&cart)missing.push(cart.name||cart.id)}
     if(note){note.textContent=!source?'Choose a medication first':(available?'Available / العلاج موجود':'Not present — selection removed / العلاج غير موجود وتم إلغاء التحديد');note.style.color=available?'var(--gnl)':'var(--rdl)'}
   });
   if(showMessage&&missing.length){var message='Medication is not present in: '+missing.join(', ')+'. Selection was removed from those carts. / العلاج غير موجود في العربات المذكورة وتم إلغاء تحديدها.';var box=E('ccbm-error');if(box)box.textContent=message;if(typeof toast==='function')toast(message,'info')}
 }
 E('ccbm-all').onclick=function(){var xs=Array.from(document.querySelectorAll('.ccbm-cart-check:not(:disabled)')),all=xs.length&&xs.every(function(x){return x.checked});xs.forEach(function(x){x.checked=!all})};
 E('ccbm-source').onchange=function(){var source=this.value;if(!source){refreshCartEligibility(false);return}var found=null;carts.some(function(c){return (c.items||[]).some(function(it){var m=canonical(it);if(medicationIdentity(m.generic)===medicationIdentity(source)){found=m;return true}return false})});if(found){E('ccbm-generic').value=found.generic;E('ccbm-strength').value=found.concentration||''}refreshCartEligibility(true)};
 refreshCartEligibility(false);
 E('ccbm-save').onclick=saveCrashBulkMedication;
 return true
};
async function saveCrashBulkMedication(){
 var source=String((E('ccbm-source')||{}).value||'').trim(),generic=String((E('ccbm-generic')||{}).value||'').trim(),strength=String((E('ccbm-strength')||{}).value||'').trim(),ids=Array.from(document.querySelectorAll('.ccbm-cart-check:checked')).map(function(x){return String(x.value)}),err=E('ccbm-error'),btn=E('ccbm-save');
 function fail(m){if(err)err.textContent=m;if(typeof toast==='function')toast(m,'err');return false}
 if(!source)return fail('Select the medication to replace.');if(!generic)return fail('Generic Name is required.');if(!strength)return fail('Strength is required.');if(!ids.length)return fail('Select at least one Crash Cart.');
 var carts=typeof crashCarts==='function'?(crashCarts()||[]):[],changedItems=0,changedCarts=0,missing=[],sourceIdentity=medicationIdentity(source);
 ids=ids.filter(function(cartId){var cart=carts.find(function(row){return String(row.id)===String(cartId)});if(cart&&cartHasMedication(cart,source))return true;if(cart)missing.push(cart.name||cart.id);var checkbox=document.querySelector('.ccbm-cart-check[value="'+String(cartId).replace(/["\\]/g,'\\$&')+'"]');if(checkbox)checkbox.checked=false;return false});
 if(missing.length){var missingMessage='Medication is not present in: '+missing.join(', ')+'. Selection was removed from those carts. / العلاج غير موجود في هذه العربات وتم إلغاء تحديدها.';if(err)err.textContent=missingMessage;if(typeof toast==='function')toast(missingMessage,'info')}
 if(!ids.length)return fail('The medication is not present in any selected Crash Cart. / العلاج غير موجود في أي عربة محددة.');
 generic=cleanRequestedGeneric(generic,strength);
 var next=carts.map(function(c){if(ids.indexOf(String(c.id))<0)return c;var local=0,items=(c.items||[]).map(function(it){if(medicationIdentity(it)!==sourceIdentity)return it;local++;changedItems++;return Object.assign({},it,{name:generic,genericName:generic,strength:strength,concentration:strength,identityLocked:true,updatedAt:now(),updatedBy:actor().name})});if(local){changedCarts++;return Object.assign({},c,{items:items,updatedAt:now(),updatedBy:actor().name,updatedByUser:actor().user})}return c});
 if(!changedItems)return fail('The selected medication was not found in the selected carts.');
 if(btn){btn.disabled=true;btn.textContent='Applying...'}
 try{await setCrashCarts(next);if(typeof auditAction==='function')auditAction('crash_cart_bulk_medication_identity_update',{source:source,genericName:generic,strength:strength,cartIds:ids,changedCarts:changedCarts,changedItems:changedItems});closeBulkMedicationModal();if(typeof renderCrashCarts==='function')renderCrashCarts();if(typeof toast==='function')toast('Updated '+changedItems+' medication record(s) in '+changedCarts+' Crash Cart(s) ✓','succ')}catch(ex){fail(String((ex&&ex.message)||ex))}finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='Apply to selected carts'}}
}
function enhanceButtons(){var pg=E('pg-crashcart');if(!pg)return;var head=pg.querySelector('.fl.ic.jb.mb14');if(canEdit()&&head&&!E('cc-bulk-medication-btn')){var bb=document.createElement('button');bb.id='cc-bulk-medication-btn';bb.type='button';bb.className='btn bp';bb.textContent='↔ Apply medication to selected carts';bb.onclick=window.openCrashBulkMedicationModal;var actions=head.querySelector('.fl.g8.ic')||head;actions.appendChild(bb)}document.querySelectorAll('#pg-crashcart .ccx-cart').forEach(function(card){var cartId=String(card.id||'').replace(/^ccx-cart-/,'');if(!cartId)return;var bar=card.querySelector('.ccx-toolbar-actions')||card.querySelector('.ch .fl')||card.querySelector('.ch');if(!bar)return;/* Legacy decorators used to append a second report action. Keep the canonical action rendered by module 44 and remove every duplicate. */Array.prototype.slice.call(card.querySelectorAll('button[onclick*="crashReportOpen"]')).slice(1).forEach(function(button){button.remove()});var old=card.querySelector('.cc-final-manage-btn');if(!canEdit()){if(old)old.remove();return}if(!old){var b=document.createElement('button');b.type='button';b.className='btn bg bsm cc-final-manage-btn';b.textContent='✎ Manage contents / تعديل المحتويات';b.onclick=function(){openEditor(cartId,false)};bar.appendChild(b)}})}
window.enhanceCrashButtons=enhanceButtons;


/* Keep the public no-login snapshot aligned with printing, including Expiry Track rules. */
async function publishPublic(carts){if(!window.FB_DB||!Array.isArray(carts))return;var r=rules(),depts=typeof gd==='function'?(gd()||[]):[],collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');await Promise.all(carts.map(function(c){var d=depts.find(function(x){return String(x.id)===String(c.deptId)})||{},items=(c.items||[]).map(function(it){var med=normalizedMedication(it.name,it.concentration||it.strength),required=num(it.qty),available=num(it.present==null?it.qty:it.present);return {name:med.name,concentration:med.concentration,strength:med.concentration,required:required,available:available,status:available<=0?'Out of stock':(available<required?'Less than required':'Available'),batches:(it.batches||[]).map(function(b){return {expiry:b.expiry||'',qty:b.qty==null?'':num(b.qty)}})}});return collection.doc('crash_'+String(c.id)).set({cartId:c.id,name:c.name||'',department:d.name||c.deptId||'',lastClosedAt:c.lastClosedAt||null,expiryRules:r,expiryTrackRules:{urgent:'0–'+r.urgentDays+' days',near:(r.urgentDays+1)+'–'+r.nearDays+' days',expired:'Before today'},updatedAt:firebase.firestore.FieldValue.serverTimestamp(),items:items},{merge:false})}))}
function reconcileCrashCartData(carts){
 var changed=false;
 var output=(Array.isArray(carts)?carts:[]).map(function(cart){
   var groups={},order=[];
   (cart.items||[]).forEach(function(original){
     var med=canonical(original),key=normalText(med.generic)+'|'+normalText(med.concentration),it=Object.assign({},original,{name:med.generic,genericName:med.generic,strength:med.concentration,concentration:med.concentration});
     if(it.name!==original.name||it.strength!==original.strength||it.concentration!==original.concentration||it.genericName!==original.genericName)changed=true;
     it.batches=(original.batches||[]).filter(function(b){return b&&(b.expiry||Number(b.qty)>0||b.lot)}).map(function(b){return {expiry:b.expiry||'',qty:num(b.qty),lot:b.lot||''}});
     if(!groups[key]){groups[key]=it;order.push(key);return}
     changed=true;var target=groups[key],batchMap={};
     (target.batches||[]).concat(it.batches||[]).forEach(function(b){var bk=String(b.expiry||'')+'|'+String(b.lot||'');if(!batchMap[bk]||num(b.qty)>num(batchMap[bk].qty))batchMap[bk]=b});
     target.batches=Object.keys(batchMap).map(function(k){return batchMap[k]});
     target.qty=Math.max(num(target.qty),num(it.qty));
     target.present=Math.max(num(target.present==null?target.qty:target.present),num(it.present==null?it.qty:it.present),target.batches.reduce(function(sum,b){return sum+num(b.qty)},0));
     if((it.batches||[]).length>(target.batches||[]).length&&it.id)target.id=it.id;
   });
   var items=order.map(function(k){return groups[k]});
   if(items.length!==(cart.items||[]).length)changed=true;
   return Object.assign({},cart,{items:items});
 });
 return {carts:output,changed:changed};
}
window.setCrashCarts=async function(v){var repaired=reconcileCrashCartData(v),out=await S.s('crash_carts',repaired.carts);try{await publishPublic(repaired.carts)}catch(e){warnPublicSync('Crash Cart data',e)}return out};
window.fsReconcileCrashCartData=async function(){var current=typeof crashCarts==='function'?(crashCarts()||[]):[],fixed=reconcileCrashCartData(current);if(fixed.changed){await window.setCrashCarts(fixed.carts);if(typeof renderCrashCarts==='function')renderCrashCarts()}return fixed};

function daysUntil(v){return window.fsDaysUntil?window.fsDaysUntil(v):null}
function fmtDateFinal(v){try{return typeof fmtDate==='function'?fmtDate(v):String(v||'—')}catch(e){return String(v||'—')}}
function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
window.crashPrint=function(id){
  var c=typeof crashCart==='function'?crashCart(id):null;
  if(!c){if(typeof toast==='function')toast('Crash Cart not found.','err');return false}
  function e(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function q(v){var x=Number(v);return isFinite(x)?x:0}
  function near30(item){return (item.batches||[]).some(function(batch){var days=daysUntil(batch&&batch.expiry);return days!==null&&days>=0&&days<=30})}
  function status(item){var required=q(item.qty),available=q(item.present==null?item.qty:item.present);return available<=0?'Out of stock':(available<required?'Less than required':'Available')}
  var reports=typeof crashReports==='function'?(crashReports()||[]):[],closed=reports.filter(function(r){return String(r.cartId)===String(c.id)&&r.status==='closed'}).sort(function(a,b){return String(b.closedAt||b.lastEditedAt||b.openedAt||'').localeCompare(String(a.closedAt||a.lastEditedAt||a.openedAt||''))})[0]||{};
  var actorInfo=typeof window.fsActor==='function'?window.fsActor():{},printUser=actorInfo.name||actorInfo.user||(window.CU&&(CU.username||CU.email))||'Unknown user';
  var publicUrl=new URL(typeof getAppUrl==='function'?getAppUrl():location.href);publicUrl.searchParams.set('view','crash-cart-public');publicUrl.searchParams.set('id',String(c.id));var tenant=window.fsTenantId&&fsTenantId();if(tenant)publicUrl.searchParams.set('tenant',tenant);
  var qr=window.makeReadableQR(publicUrl.toString());
  var qrPrintRuntime=window.ASD_QR&&ASD_QR.printRuntimeScript?ASD_QR.printRuntimeScript():'';
  var official=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var nowDate=new Date(),printDate=String(nowDate.getDate()).padStart(2,'0')+'/'+String(nowDate.getMonth()+1).padStart(2,'0')+'/'+nowDate.getFullYear();
  var rows=(c.items||[]).map(function(it,i){
    var m=canonical(it),b=(it.batches||[]).filter(function(x){return x&&x.expiry}).map(function(x){return '<div>'+e(fmtDateFinal(x.expiry))+' → '+e(x.qty==null?'—':x.qty)+'</div>'}).join('')||'No expiry';
    return '<tr class="'+(near30(it)?'near-30':'')+' '+(q(it.present==null?it.qty:it.present)<=0?'out-row':'')+'"><td class="number">'+(i+1)+'</td><td class="medicine"><b>'+e(m.generic)+'</b></td><td>'+e(m.concentration||'—')+'</td><td>'+q(it.qty)+'</td><td>'+q(it.present==null?it.qty:it.present)+'</td><td>'+e(status(it))+'</td><td class="expiry">'+b+'</td></tr>';
  }).join('');
  if(!rows)rows='<tr><td colspan="7" style="text-align:center;padding:20px">No Crash Cart medications found.</td></tr>';
  var dn=deptName(c.deptId);
  var h='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(c.name||'Crash Cart')+'</title><style>'+
  '@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:#fff!important;color:#111!important;margin:0}body{font-family:Arial,Tahoma,sans-serif}.page{width:100%}.official-print-header{margin-bottom:4mm!important}.title-grid{display:grid;grid-template-columns:1fr 27mm;gap:4mm;align-items:center;border-bottom:2px solid #222;padding:1mm 0 3mm}.titles{text-align:center}.titles .cart-kind-badge{display:inline-block;font-size:8pt;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#7a271a;background:#fee4e2;border:1px solid #b42318;border-radius:3mm;padding:.6mm 3mm;margin-bottom:1.5mm}.titles h1{font-size:18pt;margin:0 0 1mm}.titles h2{font-size:11pt;margin:0;text-transform:uppercase}.qr{text-align:center}.qr img{width:24mm;height:24mm;border:1px solid #111;padding:1mm}.qr small{display:block;font-size:5.5pt}.meta{width:100%;border-collapse:collapse;margin-top:2mm;font-size:7.5pt}.meta td{border:1px solid #555;padding:1.2mm 2mm}.track{display:flex;justify-content:space-between;gap:3mm;border:1px solid #555;border-top:0;padding:1.2mm 2mm;font-size:7pt}.legend{font-size:6.5pt;border:1px solid #555;border-top:0;padding:1mm 2mm}.swatch{display:inline-block;width:5mm;height:3mm;background:#000;vertical-align:middle;margin-right:1.5mm}table.list{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt}table.list th,table.list td{border:1px solid #444;padding:1.25mm;vertical-align:middle;overflow-wrap:anywhere}table.list th{background:#e8e8e8;text-align:left;font-weight:800}table.list .number{width:2.5%;text-align:center;padding-left:.5mm;padding-right:.5mm}table.list .medicine{font-weight:800}.expiry{background:#d9ead3}.near-30 td,.near-30 td *{background:#000!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.out-row:not(.near-30) td{background:#f4cccc!important}.footer{text-align:center;font-size:5.5pt;margin-top:1.3mm;color:#333}.byline{text-align:center;font-size:5pt;margin-top:.6mm}.toolbar{text-align:center;margin:10px}.toolbar button{font:600 14px Arial;padding:9px 18px}@media print{.toolbar{display:none}}'+
  '</style></head><body><div class="toolbar"><button type="button" data-qr-print-button disabled>Print / طباعة</button></div><div class="page">'+official+
  '<div class="title-grid"><div class="titles"><div class="cart-kind-badge">Crash Cart / عربة الطوارئ</div><h1>'+e(c.name||'Crash Cart')+'</h1><h2>'+e(dn)+'</h2></div><div class="qr"><img class="asd-qr-image" id="crash-live-qr" src="'+e(qr)+'" alt="Live Crash Cart QR"><small>Live check — no login</small></div></div>'+
  '<table class="meta"><tr><td><b>Cart:</b> '+e(c.number||c.name||'—')+'</td><td><b>Seal number:</b> '+e(c.seal||closed.newSeal||'—')+'</td><td><b>Location:</b> '+e(c.location||dn||'—')+'</td></tr><tr><td><b>Last closure:</b> '+e(fmtDateFinal(closed.closedAt||c.lastClosedAt||'—'))+'</td><td><b>Closed by:</b> '+e(closed.closedByName||c.lastClosedByName||'—')+'</td><td><b>System user:</b> '+e(closed.closedByUser||c.lastClosedByUser||'—')+'</td></tr></table>'+
  '<div class="track"><span><b>Expiry Track:</b> Expired before today · Urgent 0–7 days · Near expiry 8–30 days</span><span><b>Print date / تاريخ الطباعة:</b> '+e(printDate)+'</span></div>'+
  '<div class="legend"><span class="swatch"></span> Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</div>'+
  '<table class="list"><colgroup><col style="width:2.5%"><col style="width:31.5%"><col style="width:13%"><col style="width:9%"><col style="width:9%"><col style="width:14%"><col style="width:21%"></colgroup><thead><tr><th>#</th><th>Generic name</th><th>Concentration</th><th>Standard quantity</th><th>Available</th><th>Stock status</th><th>Expiry date → Quantity</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '<div class="footer">Printed by: '+e(printUser)+' · '+e(actorInfo.user||window.CU&&CU.email||printUser)+'</div><div class="byline">By Ali Abudahash</div></div>'+
  '<script>'+qrPrintRuntime+'<\/script></body></html>';
  // Blob URL + openBlobPrint (same pattern every other print path in this
  // app already uses), not window.open('','_blank') + document.write():
  // Safari does not reliably fire the 'load' event on a document written
  // via document.write() into a blank popup, so the QR-ready→window.print()
  // runtime script above (printRuntimeScript, which waits for 'load') would
  // silently never run — the window opened with content but the print
  // dialog itself never appeared. A blob: URL is a real navigation, whose
  // load lifecycle Safari handles the same as any other page.
  var w=typeof openBlobPrint==='function'?openBlobPrint(h):null;
  if(!w){if(typeof toast==='function')toast('Allow pop-ups to print.','err');return false}
  try{Promise.resolve(publishPublic([c])).catch(function(err){console.warn('Crash Cart public sync deferred',err)})}catch(err){}
  return true
};


})();


// --- Merged from 47-asdh-authoritative-final-fixes-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
var PREVIEW_KEY='asdh_master_role_preview_v3';
const E=globalThis.E;
function previewRead(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_KEY)||'null')}catch(e){return null}}
function previewClear(){try{sessionStorage.removeItem(PREVIEW_KEY)}catch(e){}}
function deptZ(id){try{return ((typeof gd==='function'?gd():[])||[]).find(function(d){return String(d.id)===String(id)})||null}catch(e){return null}}
function toastZ(m,t){if(typeof toast==='function')toast(m,t||'info')}
var departmentLinksRepairBusyZ=false,departmentLinksRepairedZ=false;
async function repairDepartmentLinksZ(){
  if(departmentLinksRepairBusyZ||departmentLinksRepairedZ||!window.S||typeof S.g!=='function')return false;
  var deps=S.g('departments')||[];if(!Array.isArray(deps)||!deps.length)return false;
  var norm=function(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]/g,'')},byName={};
  deps.forEach(function(d){[d&&d.id,d&&d.name,d&&d.departmentName,d&&d.code,d&&d.shortName].forEach(function(k){if(k)byName[norm(k)]=String(d.id)})});
  departmentLinksRepairBusyZ=true;
  try{
    var carts=(S.g('crash_carts')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),cartChanged=false;
    carts.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;cartChanged=true}});
    var requests=(S.g('requests')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),requestChanged=false;
    requests.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;requestChanged=true}});
    var jobs=[];
    /* Department sessions are read-only for cart stock. They may submit a
       report, but must never run a background migration against crash_carts. */
    var canWriteCart=typeof window.fsCanWriteStateKey!=='function'||window.fsCanWriteStateKey('crash_carts');
    if(cartChanged&&canWriteCart&&typeof setCrashCarts==='function')jobs.push(setCrashCarts(carts));
    if(requestChanged)jobs.push(S.s('requests',requests));
    if(jobs.length)await Promise.all(jobs);
    departmentLinksRepairedZ=true;
    if(jobs.length&&typeof refreshCurrentPage==='function')refreshCurrentPage();
    return jobs.length>0;
  }catch(e){console.error('Department link repair failed',e);return false}
  finally{departmentLinksRepairBusyZ=false}
}

/* A full reload is the authoritative role transition. It clears every stale page, modal,
   body class and delayed render callback left by Department preview mode. */
var previewStartSavedZ=null;
window.preparePreviewStart=function(){
  var saved=previewStartSavedZ=previewRead();
  var validPreviewRoles=['department','pharmacy','pharmacy_director','inpatient_supervisor','controlled_pharmacy','warehouse','pharmacy_staff'];
  if(saved&&validPreviewRoles.indexOf(String(saved.role||''))<0){previewClear();previewStartSavedZ=null;saved=null}
  if(saved&&window.CU&&CU.master===true){
    var actual=Object.assign({},CU),d=saved.deptId?deptZ(saved.deptId):null;
    window.MASTER_ACTUAL=actual;
    window.MASTER_EFFECTIVE={userId:'master-preview-'+saved.role,email:actual.email||actual.username||'Master',role:saved.role,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||'')};
    window.CU={id:actual.id,username:actual.username||actual.email||'Master',email:actual.email||'',role:saved.role,master:false,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||''),controlledCustodian:saved.role==='department'?true:!!actual.controlledCustodian};
  }else if(saved&&window.CU&&CU.master!==true){
    previewClear();previewStartSavedZ=null;
  }
};
window.finalizePreviewStart=function(){
  previewStartSavedZ=null;
  /* Data migrations are explicit maintenance actions, never page-load work.
     Running them during Crash Cart boot caused a valid read-only page to show
     a misleading Firebase save failure when a tenant was read-only or a role
     lacked the corresponding write permission. */
};


/* Keep every officer print option. Department employees retain only the one exact print action
   installed by asdh-final-department-controlled-fix-script. */
/* Crash Cart configuration permission is enforced by the canonical functions and renderer. */

/* Correct the wrongly labelled 4mg/ml Adrenaline entry in every Crash Cart.
   This is a persistent Firestore migration. The migration marker prevents the success
   message from appearing on every sign-in, while a silent scan still fixes any newly
   imported legacy record. */
var NOREPI_MIGRATION_KEY_Z='migration_crash_cart_norepinephrine_v3';
var repairBusyZ=false,repairDoneZ=false;
function norepiWordZ(v){return /(^|[^a-z])norepinephrine(?=$|[^a-z])/i.test(String(v||''))}
function adrenalineWordZ(v){return /(^|[^a-z])(adrenaline|epinephrine)(?=$|[^a-z])/i.test(String(v||''))}
function fourMgMlZ(v){return /(^|[^0-9])4\s*mg\s*(?:\/|per)?\s*ml(?=$|[^a-z0-9])/i.test(String(v||''))||/(^|[^a-z0-9])4mgml(?=$|[^a-z0-9])/i.test(String(v||''))}
function isWrongNorepiZ(it){
  var name=String((it&&it.name)||''),generic=String((it&&it.genericName)||''),strength=String((it&&it.strength)||''),concentration=String((it&&it.concentration)||'');
  var all=[name,generic,strength,concentration].join(' ');
  /* Word-boundary matching is intentional: "epinephrine" inside "norepinephrine"
     must never be treated as a separate Epinephrine medicine. */
  if(adrenalineWordZ(name+' '+generic)&&fourMgMlZ(all))return true;
  /* Canonicalize legacy Norepinephrine labels that still carry 4 mg/ml as the displayed strength. */
  if(norepiWordZ(name+' '+generic)){
    var canonicalName=name.trim().toLowerCase()==='norepinephrine';
    var canonicalGeneric=!generic||generic.trim().toLowerCase()==='norepinephrine';
    var canonicalStrength=strength.trim()==='1:1,000'&&concentration.trim()==='1:1,000';
    return !(canonicalName&&canonicalGeneric&&canonicalStrength);
  }
  return false;
}
async function repairNorepinephrineZ(force,silent){
  if(repairBusyZ||repairDoneZ||typeof crashCarts!=='function'||typeof setCrashCarts!=='function'||!window.S||typeof S.g!=='function'||typeof S.s!=='function')return;
  /* This is a database migration, not a login task for operational roles. */
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey('crash_carts')){repairDoneZ=true;return}
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey(NOREPI_MIGRATION_KEY_Z)){repairDoneZ=true;return}
  var previous=S.g(NOREPI_MIGRATION_KEY_Z)||null;
  var carts=(crashCarts()||[]).slice(),changed=0;repairBusyZ=true;
  carts.forEach(function(c){(c.items||[]).forEach(function(it){if(!isWrongNorepiZ(it))return;it.name='Norepinephrine';it.genericName='Norepinephrine';it.strength='1:1,000';it.concentration='1:1,000';it.updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();changed++})});
  try{
    if(changed){
      await setCrashCarts(carts);
      if(typeof auditAction==='function')auditAction('crash_cart_norepinephrine_name_correction',{items:changed,from:'Adrenaline/Epinephrine 4mg/ml',to:'Noradrenaline 1:1,000',migration:'v3'});
      if(typeof renderCrashCarts==='function')renderCrashCarts();
    }
    var stamp=typeof nowISO==='function'?nowISO():new Date().toISOString();
    if(!previous||previous.version!==3||changed){
      await S.s(NOREPI_MIGRATION_KEY_Z,{completed:true,version:3,completedAt:(previous&&previous.completedAt)||stamp,lastCheckedAt:stamp,lastChanged:changed,updatedBy:String((window.CU&&(CU.email||CU.username||CU.id))||'system')});
    }
    /* Show the confirmation only on the first database migration, never on every login. */
    /* Automatic sign-in repair is intentionally silent. Show confirmation only when the master runs the repair manually. */
    if(changed&&force===true&&silent!==true)toastZ('Corrected Noradrenaline 1:1,000 in '+changed+' Crash Cart item(s) ✓','succ');
    repairDoneZ=true;
  }catch(e){console.error('Crash Cart Norepinephrine correction failed',e)}finally{repairBusyZ=false}
}

/* Publish the closure identity and latest stock/expiry state to the existing public no-login record. */

})();

export {};
