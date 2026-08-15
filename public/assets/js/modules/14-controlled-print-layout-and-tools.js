(function(){
  function q(id){return document.getElementById(id)}
  function val(id){return (q(id)||{}).value||''}
  function n(v){v=Number(v);return isFinite(v)?v:0}
  function medKey(it){return String((it&&it.name)||'').trim().toLowerCase()}
  function openReports(){return (crashReports()||[]).filter(function(r){return r.status==='open'||r.status==='pending'})}
  function isPharmacyCrashRole(){if(window.fsHasCapability)return window.fsHasCapability('crashCart.operate');var rRole=String((window.CU&&CU.role)||'');return !!window.CU&&['pharmacy','inpatient_supervisor','pharmacy_staff'].includes(rRole)}

  /* Role menus exactly as requested. */
  window.buildNav=function(){
    if(!window.CU)return;
    var nav=q('mnav');nav.innerHTML='';
    var commonFull=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-schedule','⏰ Schedule'],['pg-print','Print'],['pg-analytics','Analytics'],['pg-import','⬇ Import'],['pg-controlled','🔒 Controlled custody'],['pg-ctl-analytics','📊 Controlled analytics'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    var items;
    var rRole=String((window.CU&&CU.role)||'');
    if(rRole==='pharmacy')items=commonFull.filter(function(x){return x[0]!=='pg-controlled'}).concat([['pg-users','Users']]);
    else if(rRole==='inpatient_supervisor')items=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-schedule','⏰ Schedule'],['pg-print','Print'],['pg-analytics','Analytics'],['pg-import','⬇ Import'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='outpatient_pharmacy_supervisor')items=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-print','Print'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='pharmacy_staff')items=[['pg-dash','Dashboard'],['pg-inv','Inventory status / حالة الأدوية'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-print','Print'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='controlled_pharmacy')items=[['pg-controlled','🔒 Controlled & psychotropic medicines'],['pg-ctl-analytics','📊 Controlled analytics']];
    else if(rRole==='warehouse')items=[['pg-controlled','🔒 Warehouse controlled custody'],['pg-ctl-analytics','📊 Dispensing analytics']];
    else items=[['pg-newreq','New Request / طلب جديد'],['pg-myreqs','My Requests / طلباتي'],['pg-shelves','📦 Shelves / أرفف'],['pg-crashcart','🚑 Crash Cart'],['pg-notes-dept','📝 Notes / ملاحظات'],['pg-deptprint','🖨 Print Drug List'],['pg-controlled','🔒 Controlled custody'],['pg-med-accountability','🧾 Medication documentation']];
    if(typeof isMasterActual==='function'&&isMasterActual()){var mb=document.createElement('button');mb.className='nb';mb.id='master-nav-switch';mb.innerHTML=window.MASTER_EFFECTIVE?'🧪 تغيير الدور الحالي':'🔄 الانتقال بين الأدوار';mb.onclick=openMasterRoleSwitch;nav.appendChild(mb)}
    items.forEach(function(x){var b=document.createElement('button');b.className='nb';b.innerHTML=x[1];b.dataset.pg=x[0];b.onclick=function(){showPg(this.dataset.pg)};nav.appendChild(b)});
    if((typeof isMasterActual==='function'&&isMasterActual())||(CU&&rRole==='pharmacy')){var zb=document.createElement('button');zb.id='zebra-labels-nav';zb.className='nb';zb.dataset.pg='pg-zebra-labels';zb.innerHTML='🦓 Zebra Labels <small style="opacity:.72">Beta</small>';zb.onclick=function(){showPg('pg-zebra-labels')};nav.appendChild(zb)}
    ccUpdateBadges();
    if(typeof window.scheduleNavigationRefresh==='function')window.scheduleNavigationRefresh('');
    if(typeof window.enforceRoleUi==='function')window.enforceRoleUi();
  };

  function ccUpdateBadges(){
    var open=openReports().length, reqRows=(typeof gr==='function'?(gr()||[]):[]), badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
    var req=reqRows.filter(function(r){return r.status==='pending'}).length;
    var cb=document.querySelector('[data-pg="pg-crashcart"]'),rb=document.querySelector('[data-pg="pg-reqs"]');
    if(cb){cb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(open)cb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+open+'</span>')}
    if(rb){rb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(req)rb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+req+'</span>')}
  }
  window.ccUpdateBadges=ccUpdateBadges;

  window.renderCrashDashboardSummary=function(){var d=q('dstats');if(d&&isPharmacyCrashRole()){
    var open=openReports().length,reqRows=(typeof gr==='function'?(gr()||[]):[]),badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
    var req=reqRows.filter(function(r){return r.status==='pending'}).length;
    var existing=q('cc-dashboard-extra');if(existing)existing.remove();var wrap=document.createElement('div');wrap.id='cc-dashboard-extra';wrap.className='g2 mb14';wrap.innerHTML='<div class="sc"><div class="sl">Open Crash Cart Reports</div><div class="sv">'+open+'</div><div class="ss">Awaiting pharmacy response</div></div><div class="sc"><div class="sl">Pending Requests</div><div class="sv">'+req+'</div><div class="ss">Awaiting fulfillment</div></div>';d.parentNode.insertBefore(wrap,d.nextSibling)}ccUpdateBadges()};

  /* Crash Cart reporting and exact dated replacement. */
  function ccDateKey(value){return String(value||'').slice(0,10)}
  function ccItemPresent(item){return n(item&&item.present!=null?item.present:item&&item.qty)}
  function ccItemStandard(item){return n(item&&item.qty)}
  function ccDatedBatches(item){return ((item&&item.batches)||[]).filter(function(b){return ccDateKey(b.expiry)&&n(b.qty)>0})}
  function ccExpiryQuantity(item,date){return ccDatedBatches(item).filter(function(b){return ccDateKey(b.expiry)===ccDateKey(date)}).reduce(function(sum,b){return sum+n(b.qty)},0)}
  function ccExpiryOptions(item,selected,allowBlank){var dates={};ccDatedBatches(item).forEach(function(b){var d=ccDateKey(b.expiry);dates[d]=(dates[d]||0)+n(b.qty)});var html=allowBlank?'<option value="">Not specified / غير محدد</option>':'';return html+Object.keys(dates).sort().map(function(d){return '<option value="'+esc(d)+'" '+(ccDateKey(selected)===d?'selected':'')+'>'+esc(d)+' — '+dates[d]+' unit(s)</option>'}).join('')}
  function ccBatchSummary(item){var rows=ccDatedBatches(item);if(!rows.length)return '<span class="fhint">No dated batches / لا توجد دفعات مؤرخة</span>';return rows.sort(function(a,b){return ccDateKey(a.expiry).localeCompare(ccDateKey(b.expiry))}).map(function(b){return '<span class="crash-batch-chip">'+esc(ccDateKey(b.expiry))+' → '+n(b.qty)+'</span>'}).join('')}
  function ccRemoveFromExpiry(item,date,qty){var left=n(qty),next=[];((item&&item.batches)||[]).forEach(function(batch){var copy=Object.assign({},batch);if(left>0&&ccDateKey(copy.expiry)===ccDateKey(date)){var take=Math.min(left,n(copy.qty));copy.qty=n(copy.qty)-take;left-=take}if(n(copy.qty)>0)next.push(copy)});if(left>0.000001)throw new Error('The selected old expiry does not contain enough quantity. / التاريخ القديم المحدد لا يحتوي على كمية كافية.');item.batches=next}
  function ccAddDatedQuantity(item,date,qty,reportId){qty=n(qty);if(!(qty>0))return;var batches=Array.isArray(item.batches)?item.batches.map(function(b){return Object.assign({},b)}):[],target=batches.find(function(b){return ccDateKey(b.expiry)===ccDateKey(date)&&!String(b.lot||'').trim()});if(target){target.qty=n(target.qty)+qty;target.sourceReportId=reportId;target.updatedAt=nowISO()}else{batches.push({id:'ccb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),qty:qty,expiry:ccDateKey(date),lot:'',source:'pharmacy_report_replacement',sourceReportId:reportId,updatedAt:nowISO(),updatedBy:actualActorName()})}item.batches=batches.sort(function(a,b){return ccDateKey(a.expiry).localeCompare(ccDateKey(b.expiry))})}
  function ccDeductReported(item,qty,reportedExpiry){
    var left=n(qty),taken=[],batches=Array.isArray(item.batches)?item.batches.map(function(batch){return Object.assign({},batch)}):[];
    var order=batches.map(function(batch,index){return {batch:batch,index:index}}).filter(function(entry){return n(entry.batch.qty)>0&&(!reportedExpiry||ccDateKey(entry.batch.expiry)===ccDateKey(reportedExpiry))}).sort(function(a,b){return ccDateKey(a.batch.expiry).localeCompare(ccDateKey(b.batch.expiry))||a.index-b.index});
    order.forEach(function(entry){if(left<=0)return;var take=Math.min(left,n(entry.batch.qty));if(!(take>0))return;entry.batch.qty=n(entry.batch.qty)-take;left-=take;taken.push({batchId:entry.batch.batchId||entry.batch.id||'',expiry:ccDateKey(entry.batch.expiry),lot:entry.batch.lot||entry.batch.batch||'',qty:take})});
    if(reportedExpiry&&left>0.000001)throw new Error('The selected expiry does not contain enough quantity. / التاريخ المحدد لا يحتوي على كمية كافية.');
    item.batches=batches.filter(function(batch){return n(batch.qty)>0});
    var untracked=Math.max(0,left),present=ccItemPresent(item);if(qty>present+0.000001)throw new Error('Reported quantity exceeds the current cart quantity.');
    item.present=Math.max(0,present-qty);item.stockStatus=item.present<=0?'out_of_stock':item.present<ccItemStandard(item)?'partial':'available';item.updatedAt=nowISO();item.updatedBy=actualActorName();
    return {deductionBatches:taken,untrackedDeductedQty:untracked,deductedQty:qty,deductedAtReport:true};
  }
  function ccRestoreReported(cart,report){
    if(!report||!report.inventoryDeductedAtReport)return;
    (report.consumed||[]).forEach(function(row){var item=(cart.items||[]).find(function(entry){return String(entry.id)===String(row.itemId)});if(!item)return;var restored=n(row.deductedQty||row.qty),batches=Array.isArray(item.batches)?item.batches.map(function(batch){return Object.assign({},batch)}):[];(row.deductionBatches||[]).forEach(function(part){var target=batches.find(function(batch){return (part.batchId&&String(batch.batchId||batch.id||'')===String(part.batchId))||(!part.batchId&&ccDateKey(batch.expiry)===ccDateKey(part.expiry)&&String(batch.lot||batch.batch||'')===String(part.lot||''))});if(target)target.qty=n(target.qty)+n(part.qty);else batches.push({batchId:part.batchId||('ccb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),expiry:ccDateKey(part.expiry),lot:part.lot||'',qty:n(part.qty),source:'restored_report_edit'})});item.batches=batches;item.present=Math.min(ccItemStandard(item),ccItemPresent(item)+restored);item.stockStatus=item.present<=0?'out_of_stock':item.present<ccItemStandard(item)?'partial':'available'});
  }
  function ccUniqueSealAllowed(seal,cartId,reportId){var key=String(seal||'').trim().toLowerCase();if(!key)return false;var used=false;(crashCarts()||[]).forEach(function(c){if(String(c.id)!==String(cartId)&&String(c.seal||'').trim().toLowerCase()===key)used=true});(crashReports()||[]).forEach(function(r){if(String(r.id)===String(reportId))return;[r.oldSeal,r.newSeal].forEach(function(s){if(String(s||'').trim().toLowerCase()===key)used=true})});return !used}

  window.crashReportOpen=function(id){
    var effectiveRole=window.fsEffectiveRole?window.fsEffectiveRole():String(window.CU&&CU.role||'');
    var c=crashCart(id);if(!c||!window.CU||['department','department_employee'].indexOf(String(effectiveRole))<0||String(c.deptId)!==String(CU.deptId))return toast('No permission','err');
    var existing=(crashReports()||[]).find(function(report){return String(report.cartId)===String(id)&&(report.status==='open'||report.status==='pending')})||null,reasonInput=q('ccr-reason'),otherInput=q('v16-crash-other');
    q('ccr-cart-id').value=id;q('ccr-old-seal').value=existing&&existing.oldSeal||c.seal||'';
    if(reasonInput){var savedReason=String(existing&&existing.reason||'');if(savedReason.indexOf('Other / سبب آخر: ')===0){reasonInput.value='other';if(otherInput){otherInput.value=savedReason.slice('Other / سبب آخر: '.length);otherInput.style.display=''}}else{reasonInput.value=savedReason;if(otherInput){otherInput.value='';otherInput.style.display='none'}}}
    q('ccr-items').innerHTML=(c.items||[]).map(function(it){
      var prior=existing&&(existing.consumed||[]).find(function(row){return String(row.itemId)===String(it.id)}),displayItem=JSON.parse(JSON.stringify(it));
      if(prior&&existing.inventoryDeductedAtReport)ccRestoreReported({items:[displayItem]},{inventoryDeductedAtReport:true,consumed:[prior]});
      var max=ccItemPresent(displayItem),checked=!!prior,qty=prior?n(prior.qty):(max>0?1:0),reportedExpiry=prior&&prior.reportedExpiry||'';
      return '<div class="cc-med-choice '+(checked?'on':'')+'" data-id="'+esc(it.id)+'"><div class="cc-med-head"><label><input type="checkbox" '+(checked?'checked ':'')+(max>0?'':'disabled ')+'onchange="this.closest(\'.cc-med-choice\').classList.toggle(\'on\',this.checked)"><span>'+esc(it.name)+' <small style="color:var(--tx2)">'+esc(it.strength||it.concentration||'')+'</small></span></label><span class="chip">Available: '+max+' / Standard: '+ccItemStandard(it)+'</span></div><div class="cc-med-qty"><div class="cc-report-item-grid"><div class="fg"><label>Consumed quantity / الكمية المستخدمة</label><input class="ccr-qty" type="number" min="0.001" max="'+max+'" step="any" value="'+qty+'"><div class="fhint">Maximum allowed: '+max+'</div></div><div class="fg"><label>Consumed expiry — optional / تاريخ الكمية المستخدمة — اختياري</label><select class="ccr-expiry">'+ccExpiryOptions(displayItem,reportedExpiry,true)+'</select><div class="fhint">Leave blank if the department does not know the batch date.</div></div></div></div></div>';
    }).join('')||'<div class="fhint">No medicines configured.</div>';
    OM('mcc-report');
  };
  function ccResponseRowPlan(row){return {itemId:row.dataset.id,reportedQty:n(row.dataset.reported),action:(row.querySelector('.ccc-action')||{}).value||'replace',sourceExpiry:ccDateKey((row.querySelector('.ccc-source-exp')||{}).value),qty:n((row.querySelector('.ccc-qty')||{}).value),expiry:ccDateKey((row.querySelector('.ccc-exp')||{}).value)}}
  window.ccCrashResponsePreview=function(){var id=val('ccc-report-id'),r=(crashReports()||[]).find(function(x){return String(x.id)===String(id)}),c=r&&crashCart(r.cartId),alreadyDeducted=!!(r&&r.inventoryDeductedAtReport),messages=[],valid=true;document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=c&&(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)}),current=ccItemPresent(it),standard=ccItemStandard(it),remove=alreadyDeducted?0:(p.action==='replace'?p.reportedQty:0),result=current-remove+p.qty,error='';if(!alreadyDeducted&&p.action==='replace'&&!p.sourceExpiry)error='Choose the exact old expiry to deduct.';else if(!alreadyDeducted&&p.action==='replace'&&ccExpiryQuantity(it,p.sourceExpiry)<p.reportedQty)error='Old expiry quantity is insufficient.';else if(p.qty<0)error='Replacement quantity cannot be negative.';else if(p.qty>0&&!p.expiry)error='Every replacement quantity requires an expiry date.';else if(result<0)error='Resulting quantity cannot be negative.';else if(result>standard+0.000001)error='Result '+result+' exceeds standard '+standard+'.';row.classList.toggle('crash-response-error',!!error);var out=row.querySelector('.ccc-row-result');if(out)out.textContent=error||('Final '+result+' / '+standard+(alreadyDeducted?' · reported quantity already deducted':''));if(error){valid=false;messages.push((it&&it.name||'Medicine')+': '+error)}});var box=q('ccc-validation');if(box){box.className='crash-response-validation '+(valid?'ok':'err');box.innerHTML=valid?'✓ All rows are within the approved standard quantity. / جميع الكميات ضمن العدد المعتمد.':esc(messages.join(' | '))}var save=q('ccc-save-btn');if(save)save.disabled=!valid;return valid};
  window.ccCrashActionChanged=function(select){var row=select.closest('tr'),source=row&&row.querySelector('.ccc-source-exp');if(source)source.disabled=select.value==='add';ccCrashResponsePreview()};
  window.crashCloseReport=function(reportId){
    if(!canManageCrashCart())return toast('No permission','err');var r=(crashReports()||[]).find(function(x){return String(x.id)===String(reportId)});if(!r)return;var c=crashCart(r.cartId);if(!c)return toast('Crash Cart not found.','err');
    q('ccc-report-id').value=reportId;q('ccc-new-seal').value=r.newSeal||'';q('ccc-note').value=r.pharmacyNote||'';
    q('ccc-items').innerHTML=(r.consumed||[]).map(function(x){var it=(c.items||[]).find(function(z){return String(z.id)===String(x.itemId)})||{},saved=(r.replacements||[]).find(function(z){return String(z.itemId)===String(x.itemId)})||{},defaultAction=saved.action||(ccDatedBatches(it).length?'replace':'add'),source=saved.sourceExpiry||x.reportedExpiry||'',qty=saved.qty!=null?n(saved.qty):n(x.qty),expiry=saved.expiry||'';return '<tr data-id="'+esc(x.itemId)+'" data-reported="'+n(x.qty)+'"><td><b>'+esc(x.name)+'</b><div class="fhint">'+esc(x.strength||'')+'</div><div class="ccc-row-result"></div></td><td>'+n(x.qty)+(x.reportedExpiry?'<div class="fhint">Reported expiry: '+esc(x.reportedExpiry)+'</div>':'<div class="fhint">Expiry not reported</div>')+'</td><td><div class="crash-current-batches">'+ccBatchSummary(it)+'</div><div class="fhint">Present '+ccItemPresent(it)+' / Standard '+ccItemStandard(it)+'</div></td><td><select class="ccc-action" onchange="ccCrashActionChanged(this)"><option value="replace" '+(defaultAction==='replace'?'selected':'')+'>Replace from old expiry / استبدال من تاريخ قديم</option><option value="add" '+(defaultAction==='add'?'selected':'')+'>Add only / إضافة فقط</option></select></td><td><select class="ccc-source-exp" '+(defaultAction==='add'?'disabled':'')+' onchange="ccCrashResponsePreview()"><option value="">Select old expiry...</option>'+ccExpiryOptions(it,source,false)+'</select></td><td><input class="ccc-qty" type="number" min="0" step="any" value="'+qty+'" oninput="ccCrashResponsePreview()"></td><td><input class="ccc-exp" type="date" value="'+esc(expiry)+'" onchange="ccCrashResponsePreview()"></td></tr>'}).join('');
    var h=q('ccx-close-actor');if(h){var u=window.CU||{},name=typeof actualActorName==='function'?actualActorName():(u.name||u.username||u.email||'Unknown'),user=u.username||u.email||u.id||'Unknown';h.innerHTML='<b>Closing pharmacist / الصيدلي الذي سيغلق العربة:</b><br>'+esc(name)+'<br><b>System user / مستخدم النظام:</b> '+esc(user)}OM('mcc-close');setTimeout(ccCrashResponsePreview,0);
  };
  window.ccSavePharmacyResponse=async function(){
    var id=val('ccc-report-id'),originalReports=crashReports(),originalCarts=crashCarts(),rs=JSON.parse(JSON.stringify(originalReports||[])),carts=JSON.parse(JSON.stringify(originalCarts||[])),r=rs.find(function(x){return String(x.id)===String(id)});if(!r)return;var c=carts.find(function(x){return String(x.id)===String(r.cartId)});if(!c)return toast('Crash Cart not found.','err');var seal=val('ccc-new-seal').trim();if(!seal)return toast('Enter the new seal number / أدخل رقم القفل الجديد.','err');if(!ccUniqueSealAllowed(seal,c.id,id))return toast('The new seal number is already used. Enter a unique seal.','err');if(!ccCrashResponsePreview())return toast('Correct the highlighted replacement rows first.','err');
    var replacements=[],alreadyDeducted=!!r.inventoryDeductedAtReport;
    try{document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)});if(!it)throw new Error('A reported medicine no longer exists in the cart.');var current=ccItemPresent(it),standard=ccItemStandard(it),removed=0;if(!alreadyDeducted&&p.action==='replace'){if(!p.sourceExpiry)throw new Error(it.name+': choose the old expiry.');removed=p.reportedQty;ccRemoveFromExpiry(it,p.sourceExpiry,removed)}if(p.qty>0){if(!p.expiry)throw new Error(it.name+': replacement expiry is required.');ccAddDatedQuantity(it,p.expiry,p.qty,id)}var result=current-removed+p.qty;if(result<0||result>standard+0.000001)throw new Error(it.name+': final quantity '+result+' exceeds the allowed range 0–'+standard+'.');it.present=result;it.stockStatus=result<=0?'out_of_stock':result<standard?'partial':'available';it.updatedAt=nowISO();it.updatedBy=actualActorName();replacements.push({itemId:p.itemId,name:it.name||'',action:alreadyDeducted?'replace_after_report_deduction':p.action,sourceExpiry:alreadyDeducted?'':p.sourceExpiry,reportedQty:p.reportedQty,removedQty:removed,qty:p.qty,expiry:p.expiry,resultingPresent:result,standardQty:standard})});
      var actorUser=window.CU||{},actorName=actualActorName(),actorLogin=actorUser.username||actorUser.email||actorUser.id||'Unknown',actorId=actorUser.id||actorUser.uid||'',stamp=nowISO();c.seal=seal;c.updatedAt=stamp;c.updatedBy=actorName;c.lastClosedByName=actorName;c.lastClosedByUser=actorLogin;c.lastClosedAt=stamp;r.status='closed';r.closedAt=stamp;r.closedBy=actorName;r.closedByName=actorName;r.closedByUser=actorLogin;r.closedById=actorId;r.newSeal=seal;r.pharmacyNote=val('ccc-note').trim();r.replacements=replacements;r.lastEditedAt=stamp;r.lastEditedBy=actorName;r.lastEditedByName=actorName;r.lastEditedByUser=actorLogin;
      await setCrashCarts(carts);try{await setCrashReports(rs)}catch(reportError){await setCrashCarts(originalCarts);throw reportError}auditAction('crash_cart_report_closed_exact_dated_replacement',{reportId:id,newSeal:seal,replacements:replacements,inventoryAlreadyDeducted:alreadyDeducted});if(q('ccx-state'))q('ccx-state').value='';CM('mcc-close');renderCrashCarts();ccUpdateBadges();toast(alreadyDeducted?'Replacement saved; reported deductions were not deducted twice ✓':'Pharmacy response saved; old dated quantities were deducted exactly ✓','succ');
    }catch(e){console.error(e);toast('Pharmacy response was not saved: '+String(e&&e.message||e),'err')}
  };

  /* Print: no details/signatures below department head, add strength and clear expiry→quantity arrows. */
  
  /* Wrap Crash Cart rendering to add bulk button, edit closed reports, and badges. */
/* Pharmacy inventory: expiry filtering is integrated into the existing list card. */
  function pharmacyExpiryRules(){
    var x=S.g('pharmacy_department_expiry_rules')||{};
    var urgent=Math.max(1,n(x.urgentDays||7)),near=Math.max(urgent+1,n(x.nearDays||30));
    return {urgentDays:urgent,nearDays:near};
  }
  window.phExpiryView=window.phExpiryView||'inventory';
  window.phExpiryDeptIds=Array.isArray(window.phExpiryDeptIds)?window.phExpiryDeptIds:[];
  function allDeptExpiryRows(){
    var rows=[];
    (gd()||[]).forEach(function(d){
      var meds=getMeds(d.id)||[];
      (getExpiry(d.id)||[]).forEach(function(b){
        var date=b.expiry||b.date||'',days=daysUntil(date),m=meds.find(function(x){return x.id===b.medId})||{};
        rows.push({deptId:d.id,dept:d.name,med:m.name||b.medId,strength:m.strength||'',qty:b.qty,date:date,days:days});
      });
    });
    return rows.sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  }
  function phExpiryStatus(days,rules){
    if(days===null||days===undefined||isNaN(days))return 'unknown';
    if(days<0)return 'expired';
    if(days<=rules.urgentDays)return 'urgent';
    if(days<=rules.nearDays)return 'near';
    return 'normal';
  }
  function phExpiryKnownDeptIds(){return (gd()||[]).map(function(d){return String(d.id)})}
  function phExpirySelectedDeptIds(){
    var known=phExpiryKnownDeptIds();
    var selected=(window.phExpiryDeptIds||[]).map(String).filter(function(id){return known.includes(id)});
    return selected.length?selected:known;
  }
  window.phExpirySetView=function(v){window.phExpiryView=v||'inventory';renderPhExpiryIntegrated()};
  window.phExpiryToggleDept=function(id,checked){
    var known=phExpiryKnownDeptIds(),cur=(window.phExpiryDeptIds||[]).map(String).filter(function(x){return known.includes(x)});
    if(!cur.length)cur=known.slice();
    if(checked&&!cur.includes(String(id)))cur.push(String(id));
    if(!checked)cur=cur.filter(function(x){return x!==String(id)});
    window.phExpiryDeptIds=cur.length===known.length?[]:cur;
    renderPhExpiryIntegrated();
  };
  window.phExpirySelectAllDepartments=function(){window.phExpiryDeptIds=[];renderPhExpiryIntegrated()};
  window.phExpiryClearDepartments=function(){window.phExpiryDeptIds=['__none__'];renderPhExpiryIntegrated()};
  window.phExpiryEditRules=function(){
    if(!window.CU||!['pharmacy','inpatient_supervisor'].includes(CU.role))return toast('No permission','err');
    if(typeof window.ccxEditRules==='function')return window.ccxEditRules();
    return toast('Expiry rules editor is unavailable.','err')
  };
  function phExpiryEnsureIntegratedUI(){
    var body=q('itbl'),originalWrap=body&&body.closest('.tw'),card=originalWrap&&originalWrap.closest('.card'),head=card&&card.querySelector('.ch');
    if(!card||!head)return null;
    var bar=q('ph-expiry-top-filter');
    if(!bar){
      bar=document.createElement('div');bar.id='ph-expiry-top-filter';bar.className='expiry-top-filter';head.appendChild(bar);
    }
    var result=q('ph-expiry-integrated-results');
    if(!result){result=document.createElement('div');result.id='ph-expiry-integrated-results';result.className='tw';result.style.display='none';originalWrap.insertAdjacentElement('afterend',result)}
    return {bar:bar,result:result,originalWrap:originalWrap};
  }
  function renderPhExpiryIntegrated(){
    if(!q('pg-inv')||!window.CU||!['pharmacy','inpatient_supervisor'].includes(CU.role))return;
    var ui=phExpiryEnsureIntegratedUI();if(!ui)return;
    var view=window.phExpiryView||'inventory',rules=pharmacyExpiryRules(),depts=gd()||[];
    var rawSel=(window.phExpiryDeptIds||[]).map(String),noneSelected=rawSel.includes('__none__');
    var selectedIds=noneSelected?[]:phExpirySelectedDeptIds();
    var all=allDeptExpiryRows().filter(function(x){return selectedIds.includes(String(x.deptId))});
    var counts={all:all.length,urgent:0,near:0,expired:0};
    all.forEach(function(x){var st=phExpiryStatus(x.days,rules);if(st==='urgent')counts.urgent++;else if(st==='near')counts.near++;else if(st==='expired')counts.expired++});
    var selectedLabel=noneSelected?'No departments':(selectedIds.length===depts.length?'All departments':selectedIds.length+' departments');
    var deptChecks=depts.map(function(d){var checked=!noneSelected&&selectedIds.includes(String(d.id));return '<label class="expiry-dept-option"><input type="checkbox" '+(checked?'checked':'')+' onchange="phExpiryToggleDept(\''+esc(d.id)+'\',this.checked)"><span>'+esc(d.name)+'</span></label>'}).join('');
    ui.bar.innerHTML='<div class="expiry-filter-row">'+
      '<select class="psel expiry-view-select" onchange="phExpirySetView(this.value)"><option value="inventory" '+(view==='inventory'?'selected':'')+'>Medication list / قائمة الأدوية</option><option value="all" '+(view==='all'?'selected':'')+'>All expiry records ('+counts.all+')</option><option value="urgent" '+(view==='urgent'?'selected':'')+'>Urgent ('+counts.urgent+')</option><option value="near" '+(view==='near'?'selected':'')+'>Near expiry ('+counts.near+')</option><option value="expired" '+(view==='expired'?'selected':'')+'>Expired ('+counts.expired+')</option></select>'+
      '<details class="expiry-dept-picker" '+(view==='inventory'?'style="display:none"':'')+'><summary>Departments: '+selectedLabel+'</summary><div class="expiry-dept-menu"><div class="expiry-dept-actions"><button type="button" class="btn bg bxs" onclick="phExpirySelectAllDepartments()">All</button><button type="button" class="btn bg bxs" onclick="phExpiryClearDepartments()">Clear</button></div>'+deptChecks+'</div></details>'+
      '<button type="button" class="btn bg bsm expiry-rules-btn" '+(view==='inventory'?'style="display:none"':'')+' onclick="phExpiryEditRules()">⚙ Rules: urgent ≤ '+rules.urgentDays+'d · near ≤ '+rules.nearDays+'d</button></div>';
    if(view==='inventory'){ui.originalWrap.style.display='';ui.result.style.display='none';return}
    ui.originalWrap.style.display='none';ui.result.style.display='block';
    var rows=all.filter(function(x){var st=phExpiryStatus(x.days,rules);return view==='all'||st===view});
    ui.result.innerHTML='<table><thead><tr><th>Department</th><th>Medication</th><th>Strength</th><th>Qty</th><th>Expiry</th><th>Days</th><th>Status</th></tr></thead><tbody>'+rows.map(function(x){var st=phExpiryStatus(x.days,rules),label=st==='urgent'?'Urgent':st==='near'?'Near expiry':st==='expired'?'Expired':st==='normal'?'Normal':'Unknown',cls=st==='urgent'||st==='expired'?'exp-red':st==='near'?'exp-yellow':'';return '<tr class="'+(st==='urgent'||st==='expired'?'rha':st==='near'?'rhz':'')+'"><td>'+esc(x.dept)+'</td><td>'+esc(x.med)+'</td><td>'+esc(x.strength||'—')+'</td><td>'+esc(x.qty==null?'—':x.qty)+'</td><td>'+esc(fmtDate(x.date))+'</td><td class="'+cls+'">'+esc(x.days==null?'—':x.days)+'</td><td><span class="badge '+(st==='urgent'||st==='expired'?'brd':st==='near'?'byl':'bgr')+'">'+label+'</span></td></tr>'}).join('')+(rows.length?'':'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--tx2)">No medicines match the selected filters.</td></tr>')+'</tbody></table>';
  }
  window.renderPhExpiryIntegrated=renderPhExpiryIntegrated;
})();

// --- Merged from 15-controlled-print-pages.js (Phase 6 consolidation) ---
(function(){

  window.ctlPrintHTML=function(title,body,preparedWindow){
    var w=preparedWindow||window.open('','_blank');
    if(!w){toast('Allow pop-ups to print.','err');return null}
    try{
      w.document.open();
      w.document.write('<!doctype html><html dir="ltr"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+
        '@page{size:A4 landscape;margin:5mm}'+
        '*{box-sizing:border-box}html,body{width:100%;height:auto!important;max-height:none!important;margin:0;padding:0;overflow:visible!important;direction:ltr!important}'+
        'body{font-family:Arial,Tahoma,sans-serif;color:#111;text-align:left;padding:0}'+
        '.print-page{width:100%;height:auto!important;max-height:none!important;max-width:none;margin:0;overflow:visible!important;transform:none!important}'+
        'h1,h2{text-align:center;margin:2px 0;direction:ltr}'+
        '.head{display:grid;grid-template-columns:105px minmax(0,1fr) 105px;align-items:center;width:100%;gap:8px;break-inside:avoid;page-break-inside:avoid}'+
        '.logo{max-width:95px;max-height:68px}.qr{width:88px;height:88px}'+
        '.printed-date{text-align:left;font-size:9px;margin:4px 0 6px;direction:ltr}'+
        'table{width:100%!important;max-width:none;border-collapse:collapse;table-layout:auto;margin:6px 0 0;direction:ltr!important;page-break-inside:auto;break-inside:auto}'+
        'thead{display:table-header-group}tbody{display:table-row-group}tfoot{display:table-footer-group}'+
        'tr{page-break-inside:avoid!important;break-inside:avoid!important}'+
        'th,td{border:1px solid #333;padding:4px 5px;text-align:left!important;font-size:9.5px;line-height:1.25;direction:ltr!important;vertical-align:middle}'+
        'th{background:#e8eef7;font-weight:700}'+
        'th:first-child,td:first-child{width:30px;text-align:center!important}'+
        '.med{width:auto!important;min-width:230px;text-align:left!important;font-weight:bold}'+
        '.expiry{text-align:left!important;line-height:1.45;white-space:normal;overflow:visible!important}'+
        '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:16px;direction:ltr;page-break-inside:avoid!important;break-inside:avoid!important}'+
        '.sig{text-align:center;border-top:1px solid #222;padding-top:5px;margin-top:24px;page-break-inside:avoid;break-inside:avoid}'+
        '.electronic-cert{margin-top:10px;padding:6px;border:1px solid #333;text-align:center;font-size:9px;font-weight:bold;page-break-inside:avoid;break-inside:avoid}'+
        '.by{font-size:8px;text-align:center;margin-top:8px;page-break-inside:avoid;break-inside:avoid}.handover{margin:8px 0;padding:7px;border:1px solid #444;page-break-inside:avoid;break-inside:avoid}.ltr{direction:ltr!important}'+
        '@media print{html,body,.print-page{height:auto!important;max-height:none!important;overflow:visible!important}table{page-break-inside:auto!important;break-inside:auto!important}thead{display:table-header-group!important}tr{page-break-inside:avoid!important;break-inside:avoid!important}}'+
        '</style></head><body><div class="print-page">'+officialPrintHeaderHTML()+body+'<div class="electronic-cert">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم<br>This list is electronically approved and certified and does not require a stamp.</div><div class="by">By Ali Abudahash</div></div><script>(function(){var fired=false;function go(){if(fired)return;fired=true;try{window.focus()}catch(e){}window.print()}window.addEventListener("load",function(){setTimeout(go,250)},{once:true});setTimeout(go,1800)})();<\/script></body></html>');
      w.document.close();
      return w
    }catch(err){
      try{w.document.open();w.document.write('<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>Print failed / تعذر تجهيز الطباعة</h2><pre>'+String(err&&err.message||err).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</pre></body></html>');w.document.close()}catch(e){}
      throw err
    }
  };
})();


// --- Merged from 06-zebra-label-printing.js (Phase 6 consolidation) ---
(function(){
  var ZDB_KEY='asdhealth_zebra_label_db_v12',ZPR_KEY='asdhealth_zebra_printer_v12';
  var zdb=[],zprinters=[],zebraDevice=null;
  const E=globalThis.E;
  function clean(v){return String(v==null?'':v).trim()}
  function htmlSafe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function safeNum(v,d){v=Number(v);return isFinite(v)&&v>0?v:d}
  function allowed(){return !!(window.CU&&(CU.role==='pharmacy'||CU.master===true))}
  function message(t,kind){var x=E('zebra-message');if(x){x.textContent=t||'';x.style.color=kind==='err'?'var(--rdl)':kind==='ok'?'var(--gnl)':'var(--tx2)'}}
  function status(t,cls){var x=E('zebra-status');if(x){x.textContent=t;x.className='badge '+(cls||'bgr')}}
  function loadDB(){try{zdb=JSON.parse(localStorage.getItem(ZDB_KEY)||'[]');if(!Array.isArray(zdb))zdb=[]}catch(e){zdb=[]}renderDB()}
  function saveDB(){localStorage.setItem(ZDB_KEY,JSON.stringify(zdb));renderDB()}
  function keyOf(x){return (clean(x.name)+'|'+clean(x.strength)).toLowerCase()}
  function zebraCollectMed(map,name,strength,source,expiry){name=clean(name);strength=clean(strength);if(!name)return;var k=(name+'|'+strength).toLowerCase(),x=map[k]||{name:name,strength:strength,sources:[],expiries:[]};if(source&&x.sources.indexOf(source)<0)x.sources.push(source);if(expiry&&x.expiries.indexOf(expiry)<0)x.expiries.push(expiry);map[k]=x}
  function extractAll(source){
    var map={};
    try{
      if(source==='all'||source==='inventory'){
        var depts=typeof gd==='function'?(gd()||[]):[];
        depts.forEach(function(d){(getMeds(d.id)||[]).forEach(function(m){zebraCollectMed(map,m.name||m.medication,m.strength||m.dose,'Inventory: '+(d.name||d.id),(m.expiry||''));(m.batches||[]).forEach(function(b){zebraCollectMed(map,m.name||m.medication,m.strength||m.dose,'Inventory: '+(d.name||d.id),b.expiry||b.date)})})});
      }
      if(source==='all'||source==='controlled'){
        try{(typeof ctlCatalog==='function'?(ctlCatalog()||[]):[]).forEach(function(m){zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled medicines','')})}catch(e){}
        try{(gd()||[]).forEach(function(d){(ctlDeptList(d.id)||[]).forEach(function(x){var m=ctlMedicine(x.medId)||{};(x.batches||[]).forEach(function(b){zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled custody: '+(d.name||d.id),b.expiry)});zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled custody: '+(d.name||d.id),'')})})}catch(e){}
      }
      if(source==='all'||source==='crash'){
        try{(crashCarts()||[]).forEach(function(c){(c.items||[]).forEach(function(it){zebraCollectMed(map,it.name,it.strength,'Crash Cart: '+(c.name||c.deptName||c.id||''),'');(it.batches||[]).forEach(function(b){zebraCollectMed(map,it.name,it.strength,'Crash Cart: '+(c.name||c.deptName||c.id||''),b.expiry)})})})}catch(e){}
      }
    }catch(e){console.error('Zebra import extraction',e)}
    return Object.keys(map).map(function(k){return map[k]}).sort(function(a,b){return a.name.localeCompare(b.name)})
  }
  window.zebraImportDatabase=function(){if(!allowed())return;var src=E('zebra-source')?E('zebra-source').value:'all',items=extractAll(src);var merged={};zdb.forEach(function(x){merged[keyOf(x)]=x});items.forEach(function(x){var k=keyOf(x),old=merged[k];if(old){x.sources.forEach(function(v){if(old.sources.indexOf(v)<0)old.sources.push(v)});x.expiries.forEach(function(v){if(old.expiries.indexOf(v)<0)old.expiries.push(v)})}else merged[k]=x});zdb=Object.keys(merged).map(function(k){return merged[k]}).sort(function(a,b){return a.name.localeCompare(b.name)});saveDB();message('Imported '+items.length+' medicines from '+src+'. Database now contains '+zdb.length+' unique medicines.','ok');if(typeof toast==='function')toast('Zebra label database refreshed: '+zdb.length+' medicines','succ')};
  function renderDB(){var c=E('zebra-db-count');if(c)c.textContent=zdb.length+' medicines';window.zebraFilterMedicines()}
  window.zebraFilterMedicines=function(){var sel=E('zebra-med');if(!sel)return;var q=clean(E('zebra-search')&&E('zebra-search').value).toLowerCase(),cur=sel.value;sel.innerHTML='';zdb.filter(function(x){return !q||(x.name+' '+x.strength).toLowerCase().indexOf(q)>=0}).forEach(function(x){var o=document.createElement('option');o.value=keyOf(x);o.textContent=x.name+(x.strength?' — '+x.strength:'');sel.appendChild(o)});if(cur)sel.value=cur};
  window.zebraSelectMedicine=function(){var k=E('zebra-med').value,x=zdb.find(function(v){return keyOf(v)===k});if(!x)return;E('zebra-name').value=x.name||'';E('zebra-strength').value=x.strength||'';if(E('zebra-expiry')&&!E('zebra-expiry').value&&x.expiries&&x.expiries.length)E('zebra-expiry').value=x.expiries.slice().sort()[0];zebraUpdatePreview()};
  window.zebraTemplateChanged=function(){var show=E('zebra-template').value==='name_strength_expiry';E('zebra-expiry-wrap').style.display=show?'block':'none';zebraUpdatePreview()};
  function mmToPx(mm){return Math.max(80,Math.round(mm*6))}
  window.zebraUpdatePreview=function(){var w=safeNum(E('zebra-width')&&E('zebra-width').value,50),h=safeNum(E('zebra-height')&&E('zebra-height').value,25),box=E('zebra-preview');if(!box)return;var name=clean(E('zebra-name').value)||'MEDICINE NAME',strength=clean(E('zebra-strength').value)||'Strength',expiry=E('zebra-expiry').value,footer=clean(E('zebra-footer').value),hasExp=E('zebra-template').value==='name_strength_expiry';box.style.width=mmToPx(w)+'px';box.style.height=mmToPx(h)+'px';var ratio=Math.min(1.6,Math.max(.65,w/50)),base=Math.max(15,Math.min(44,Math.floor((h*1.5)*ratio)));box.innerHTML='<div class="zl-name" style="font-size:'+base+'px">'+(typeof esc==='function'?esc(name):name)+'</div><div class="zl-strength" style="font-size:'+Math.max(13,Math.round(base*.68))+'px">'+(typeof esc==='function'?esc(strength):strength)+'</div>'+(hasExp?'<div class="zl-expiry" style="font-size:'+Math.max(12,Math.round(base*.55))+'px">EXP '+(expiry||'DD/MM/YYYY')+'</div>':'')+(footer?'<div class="zl-footer" style="font-size:'+Math.max(10,Math.round(base*.38))+'px">'+(typeof esc==='function'?esc(footer):footer)+'</div>':'');E('zebra-size-label').textContent=w+' × '+h+' mm'};
  function zplEscape(v){return clean(v).replace(/[\\^~]/g,' ')}
  function dots(mm,dpi){return Math.max(1,Math.round(mm*dpi/25.4))}
  function buildZPL(test){var wmm=safeNum(E('zebra-width').value,50),hmm=safeNum(E('zebra-height').value,25),dpi=safeNum(E('zebra-dpi').value,203),W=dots(wmm,dpi),H=dots(hmm,dpi),copies=Math.min(500,Math.max(1,Math.floor(safeNum(E('zebra-copies').value,1)))),name=test?'ZEBRA TEST LABEL':zplEscape(E('zebra-name').value),strength=test?(wmm+' x '+hmm+' mm · '+dpi+' dpi'):zplEscape(E('zebra-strength').value),hasExp=!test&&E('zebra-template').value==='name_strength_expiry',expiry=hasExp?zplEscape(E('zebra-expiry').value):'',footer=test?'ASDHealth v1.2':zplEscape(E('zebra-footer').value),margin=Math.max(8,Math.round(W*.035)),usable=W-margin*2,nameH=Math.max(24,Math.round(H*(hasExp?.28:.38))),strH=Math.max(20,Math.round(H*.21)),expH=Math.max(18,Math.round(H*.18)),y=Math.round(H*.09),z='^XA^CI28^PW'+W+'^LL'+H+'^LH0,0';z+='^FO'+margin+','+y+'^A0N,'+nameH+','+Math.max(18,Math.round(nameH*.72))+'^FB'+usable+',2,0,C,0^FD'+name+'^FS';y+=Math.round(H*.36);z+='^FO'+margin+','+y+'^A0N,'+strH+','+Math.max(15,Math.round(strH*.72))+'^FB'+usable+',1,0,C,0^FD'+strength+'^FS';if(hasExp){y+=Math.round(H*.22);z+='^FO'+margin+','+y+'^A0N,'+expH+','+Math.max(14,Math.round(expH*.72))+'^FB'+usable+',1,0,C,0^FDEXP '+expiry+'^FS'}if(footer){z+='^FO'+margin+','+Math.round(H*.88)+'^A0N,'+Math.max(14,Math.round(H*.09))+','+Math.max(10,Math.round(H*.06))+'^FB'+usable+',1,0,C,0^FD'+footer+'^FS'}z+='^PQ'+copies+',0,1,N^XZ';return z}
  function installLocalBrowserPrintShim(base){window.BrowserPrint={getLocalDevices:function(ok,fail,type){fetch(base+'/available').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(data){var list=Array.isArray(data)?data:(data.printer||data.printers||data.devices||[]);list=list.map(function(d){d.deviceType=d.deviceType||d.type||'printer';d.send=function(payload,success,error){fetch(base+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:d,data:payload})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(){if(success)success()}).catch(function(e){if(error)error(e)})};return d});if(type)list=list.filter(function(d){return d.deviceType===type||type==='printer'});ok(list)}).catch(function(e){if(fail)fail(e)})}};return true}
  function tryLoadBrowserPrint(cb){if(window.BrowserPrint)return cb(true);var urls=['http://localhost:9100/BrowserPrint-3.1.250.min.js','https://localhost:9101/BrowserPrint-3.1.250.min.js'];var i=0;function probeShim(){fetch('http://localhost:9100/available').then(function(r){if(!r.ok)throw new Error();installLocalBrowserPrintShim('http://localhost:9100');cb(true)}).catch(function(){fetch('https://localhost:9101/available').then(function(r){if(!r.ok)throw new Error();installLocalBrowserPrintShim('https://localhost:9101');cb(true)}).catch(function(){cb(false)})})}function next(){if(window.BrowserPrint)return cb(true);if(i>=urls.length)return probeShim();var sc=document.createElement('script');sc.src=urls[i++];sc.onload=function(){if(window.BrowserPrint)cb(true);else next()};sc.onerror=next;document.head.appendChild(sc)}next()}
  window.zebraRefreshPrinters=function(){if(!allowed())return;status('Detecting…','byl');message('Searching for Zebra printers connected to this device…');tryLoadBrowserPrint(function(ok){if(!ok){status('Browser Print unavailable','brd');message('Zebra Browser Print is not available. Install/run Zebra Browser Print, then use Detect printers again. Browser print and ZPL download remain available.','err');return}BrowserPrint.getLocalDevices(function(devs){zprinters=(devs||[]).filter(function(d){return !d.deviceType||d.deviceType==='printer'});var sel=E('zebra-printer'),saved=localStorage.getItem(ZPR_KEY)||'';sel.innerHTML='';if(!zprinters.length){sel.innerHTML='<option value="">No Zebra printers detected</option>';status('No printer','brd');message('No Zebra printer was detected. Check USB/network connection and Zebra Browser Print.','err');return}zprinters.forEach(function(d,i){var o=document.createElement('option');o.value=String(i);o.textContent=d.name||d.uid||('Zebra printer '+(i+1));sel.appendChild(o)});var idx=zprinters.findIndex(function(d){return (d.uid||d.name)===saved});sel.value=String(idx>=0?idx:0);zebraDevice=zprinters[Number(sel.value)];status(zprinters.length+' printer'+(zprinters.length>1?'s':''),'bgn');message('Detected '+zprinters.length+' Zebra printer(s). Select the printer to use.','ok');sel.onchange=function(){zebraDevice=zprinters[Number(sel.value)]||null;if(zebraDevice)localStorage.setItem(ZPR_KEY,zebraDevice.uid||zebraDevice.name||'')}} ,function(e){status('Detection failed','brd');message('Printer detection failed: '+(e&&e.message?e.message:e),'err')},'printer')})};
  function browserPrint(){var w=safeNum(E('zebra-width').value,50),h=safeNum(E('zebra-height').value,25),copies=Math.min(500,Math.max(1,Math.floor(safeNum(E('zebra-copies').value,1)))),name=htmlSafe(clean(E('zebra-name').value)),strength=htmlSafe(clean(E('zebra-strength').value)),hasExp=E('zebra-template').value==='name_strength_expiry',expiry=htmlSafe(E('zebra-expiry').value),footer=htmlSafe(clean(E('zebra-footer').value)),win=window.open('','_blank');if(!win)return message('Allow pop-ups to print labels.','err');var labels='';for(var i=0;i<copies;i++)labels+='<section class="label"><div class="name">'+name+'</div><div class="strength">'+strength+'</div>'+(hasExp?'<div class="expiry">EXP '+expiry+'</div>':'')+(footer?'<div class="footer">'+footer+'</div>':'')+'</section>';win.document.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:'+w+'mm '+h+'mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif}.label{width:'+w+'mm;height:'+h+'mm;page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1.5mm;overflow:hidden}.name{font-size:'+Math.max(12,Math.min(34,h*1.05))+'pt;font-weight:800;line-height:1}.strength{font-size:'+Math.max(10,Math.min(24,h*.65))+'pt;font-weight:700;line-height:1.05;margin-top:1mm}.expiry{font-size:'+Math.max(9,Math.min(20,h*.52))+'pt;font-weight:800;margin-top:1mm}.footer{font-size:'+Math.max(7,Math.min(13,h*.30))+'pt;font-weight:600;margin-top:1mm}</style></head><body>'+labels+'<script>onload=function(){print()}<\/script></body></html>');win.document.close()}
  window.zebraDownloadZPL=function(test){var z=buildZPL(!!test),blob=new Blob([z],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ASDHealth_Zebra_Label_v1_2.zpl';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);message('ZPL file downloaded.','ok')};
  function sendZPL(test){var z=buildZPL(!!test);if(!zebraDevice){var sel=E('zebra-printer');zebraDevice=zprinters[Number(sel&&sel.value)]||null}if(!zebraDevice)return message('No Zebra printer selected. Click Detect printers first.','err');localStorage.setItem(ZPR_KEY,zebraDevice.uid||zebraDevice.name||'');zebraDevice.send(z,function(){message('Labels sent successfully to '+(zebraDevice.name||'Zebra printer')+'.','ok');if(typeof toast==='function')toast('Zebra labels sent successfully','succ')},function(e){message('Zebra print failed: '+(e&&e.message?e.message:e),'err')})}
  window.zebraPrintLabels=function(){if(!allowed())return;if(!clean(E('zebra-name').value))return message('Select or enter a medicine name.','err');if(E('zebra-template').value==='name_strength_expiry'&&!E('zebra-expiry').value)return message('Enter the expiry date.','err');var mode=E('zebra-mode').value;if(mode==='browser')return browserPrint();if(mode==='download')return zebraDownloadZPL(false);sendZPL(false)};
  window.zebraTestLabel=function(){if(E('zebra-mode').value==='browser')return browserPrint();if(E('zebra-mode').value==='download')return zebraDownloadZPL(true);sendZPL(true)};
  function initPage(){var ok=allowed();if(E('zebra-access-denied'))E('zebra-access-denied').style.display=ok?'none':'block';if(E('zebra-main'))E('zebra-main').style.display=ok?'block':'none';if(!ok)return;loadDB();zebraTemplateChanged();['zebra-width','zebra-height','zebra-dpi','zebra-copies'].forEach(function(id){var x=E(id);if(x)x.oninput=zebraUpdatePreview});zebraUpdatePreview();if(!zdb.length)zebraImportDatabase();setTimeout(zebraRefreshPrinters,250)}
  window.renderZebraPageUi=initPage;
})();

export {};
