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
  }else if(typeof canManageRequests==='function'&&!canManageRequests())return toast('No request edit permission','err');
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
  var medId=el('exp-med-sel').value;
  var date=el('exp-date-inp').value;
  if(!medId||!date){
    return toast(
      'Medicine and expiry date are required. Batch/Lot is optional.',
      'err'
    );
  }

  var button=el('exp-save-btn');
  var editId=el('exp-edit-id').value;
  var lot=el('exp-batch-inp').value.trim();
  var row={
    medId:medId,
    batch:lot,
    lot:lot,
    date:date,
    expiry:date
  };

  if(button)button.disabled=true;
  try{
    if(editId)await updExpBatch(CU.deptId,editId,row);
    else await addExpBatch(CU.deptId,row);

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
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){var result=previousStart.apply(this,arguments);setTimeout(indicator,700);return result};
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
var previousCountWarning=window.refreshRequestCountLimitWarning;
window.refreshRequestCountLimitWarning=function(){
  removeLegacyBlockingWarnings();
  var result=typeof previousCountWarning==='function'?previousCountWarning.apply(this,arguments):undefined;
  positionR18Banner();
  setTimeout(positionR18Banner,0);
  applyNewRequestGate();
  return result;
};
var previousScheduleMessage=window.refreshRequestScheduleMessage;
window.refreshRequestScheduleMessage=function(){
  var result=typeof previousScheduleMessage==='function'?previousScheduleMessage.apply(this,arguments):undefined;
  positionR18Banner();
  applyNewRequestGate();
  return result;
};
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
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){window.resetFloorstockSessionFilters();var result=previousStart.apply(this,arguments);setTimeout(function(){window.resetFloorstockSessionFilters();var active=document.querySelector('.pg.on');if(active&&typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(active.id);setTimeout(function(){setValue('rsrch','');applyNewRequestGate()},0)},0);return result};
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
var previousPersist=window.persistTransientUiState,previousRestore=window.restorePageTransientUi;
window.persistTransientUiState=function(){if(typeof previousPersist==='function')previousPersist();persist()};
window.restorePageTransientUi=function(id){if(typeof previousRestore==='function')previousRestore(id);setTimeout(function(){if(id==='pg-newreq')restoreNewRequest(read('newreq'));if(id==='pg-crash-ops')restoreBulk(read('bulk'))},0)};
document.addEventListener('input',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(!page)return;if(page.id==='pg-newreq'){dirty.newreq=true}else if(page.id==='pg-crash-ops'){dirty.bulk=true}else return;clearTimeout(timer);timer=setTimeout(persist,120)});
document.addEventListener('change',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(page&&(page.id==='pg-newreq'||page.id==='pg-crash-ops')){dirty[page.id==='pg-newreq'?'newreq':'bulk']=true;persist()}});
window.addEventListener('beforeunload',persist);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')persist()});
window.floorstockShouldProtectAutoRefresh=function(pageId){var type=pageId==='pg-newreq'?'newreq':pageId==='pg-crash-ops'?'bulk':'';if(!type||!dirty[type])return false;persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return true};
var originalRefresh=window.refreshCurrentPage;
if(typeof originalRefresh==='function')window.refreshCurrentPage=function(){var active=document.querySelector('.pg.on'),type=active&&active.id==='pg-newreq'?'newreq':active&&active.id==='pg-crash-ops'?'bulk':'';if(type&&dirty[type]){persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return}return originalRefresh.apply(this,arguments)};
var originalSubmit=window.submitReq;if(typeof originalSubmit==='function')window.submitReq=async function(){var before=(typeof gr==='function'?(gr()||[]):[]).length,result=await originalSubmit.apply(this,arguments),after=(typeof gr==='function'?(gr()||[]):[]).length;if(after>before)clear('newreq');return result};
var originalBulk=window.r17CrashExecuteBulk;if(typeof originalBulk==='function')window.r17CrashExecuteBulk=async function(){var before=(typeof crashReports==='function'?(crashReports()||[]):[]).length,result=await originalBulk.apply(this,arguments),after=(typeof crashReports==='function'?(crashReports()||[]):[]).length;if(after>before)clear('bulk');return result};
var originalClose=window.crashCloseReport;if(typeof originalClose==='function')window.crashCloseReport=function(reportId){var result=originalClose.apply(this,arguments);setTimeout(function(){var report=(typeof crashReports==='function'?(crashReports()||[]):[]).find(function(r){return String(r.id)===String(reportId)});if(!report||!report.inventoryDeductedAtReport)return;document.querySelectorAll('#ccc-items tr').forEach(function(row){var action=row.querySelector('.ccc-action'),source=row.querySelector('.ccc-source-exp');if(action){action.value='add';action.disabled=true}if(source){source.value='';source.disabled=true}});var box=E('ccc-validation');if(box)box.insertAdjacentHTML('beforebegin','<div class="alert-banner-y">Reported quantities were already deducted when the department submitted the report. This step adds replacements only. / تم خصم الكميات عند إرسال البلاغ، وهذه الخطوة للتعويض فقط.</div>');if(typeof window.ccCrashResponsePreview==='function')window.ccCrashResponsePreview()},0);return result};
window.clearFloorstockFormDraft=function(type){clear(type)};
})();

export {};
