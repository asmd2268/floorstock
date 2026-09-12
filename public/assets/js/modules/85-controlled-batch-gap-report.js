import { installActions } from '../core/delegated-actions.js?v=078b8d25e6';
import { collectBatchGaps, batchGapLabel } from '../core/controlled-batch-gaps.js?v=d037cb3076';

/* The work queue for custody rows that cannot yet say how much sits under each
   expiry date.

   A bulk editor wrote {expiry, qty:0} across several wards before the register
   started refusing that shape, so the rows are spread across departments with no
   way to find them except opening each one. This lists them, worst first, and
   changes nothing: it reads the same lists the custody page reads and writes
   nothing back. Entering the split stays a deliberate act in the per-medicine
   editor, which enforces that the lots add up.

   Its own module rather than a few more lines in 07j, which sits one line under
   its budget — the ratchet's answer to new behaviour is a new file. */

(function(){
'use strict';
var E=window.fsE, esc=window.fsEsc;

function allowed(){
  var role=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
  return !!(window.CU&&(CU.master===true||role==='pharmacy'||role==='controlled_pharmacy'||role==='inpatient_supervisor'));
}

function departments(){
  var list=typeof window.fsAllowedDepts==='function'?(window.fsAllowedDepts()||[]):(typeof gd==='function'?(gd()||[]):[]);
  return list.filter(function(d){return typeof window.fsCanAccessDepartment!=='function'||window.fsCanAccessDepartment(d.id)});
}

function queue(){
  return collectBatchGaps(
    departments(),
    function(deptId){return typeof globalThis.ctlDeptList==='function'?globalThis.ctlDeptList(deptId):[]},
    function(row){
      var med=typeof globalThis.fsR5ControlledMedicine==='function'?globalThis.fsR5ControlledMedicine(row.medId):null;
      return (row&&row.name)||(med&&med.name)||'';
    }
  );
}

function render(){
  var rows=queue();
  var body=rows.length
    ? '<div class="tw"><table><thead><tr><th>#</th><th>Department / القسم</th><th>Medicine / الدواء</th><th>Actual / الفعلي</th><th>Counted / المُدخل</th><th>Needs / المطلوب</th></tr></thead><tbody>'
      +rows.map(function(r,i){
          return '<tr><td>'+(i+1)+'</td><td>'+esc(r.deptName)+'</td><td><b>'+esc(r.medName)+'</b></td>'
            +'<td style="font-family:var(--mono)">'+r.actual+'</td>'
            +'<td style="font-family:var(--mono)">'+(r.counted||'—')+'</td>'
            +'<td>'+esc(batchGapLabel(r.reason))+'</td></tr>';
        }).join('')
      +'</tbody></table></div>'
      +'<div class="fhint" style="margin-top:10px">Enter the split in each medicine’s custody editor; it will not save unless the lots add up to the actual. / أدخل التوزيع من محرر عهدة كل دواء، ولن يُحفظ ما لم تساوِ الدفعات الكمية الفعلية.</div>'
    : '<div class="alert-banner" style="border-color:var(--gn);background:rgba(46,160,67,.08)">✓ Every custody row accounts for its quantity by expiry date. / كل صفوف العهدة موزّعة على تواريخها.</div>';

  var old=E('ctl-gap-modal'); if(old)old.remove();
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-bg on" id="ctl-gap-modal"><div class="modal" style="width:min(900px,97vw)">'
    +'<div class="mh"><div><div class="mt">⚠ Quantities still to enter / كميات لم تُوزَّع بعد</div>'
    +'<div class="fhint">'+rows.length+' custody row(s) across '+departments().length+' department(s) · read-only / للاطلاع فقط</div></div>'
    +'<button type="button" class="xbtn" data-clickact="ctlGapClose">×</button></div>'
    +'<div class="cb">'+body+'</div></div></div>');
  var modal=E('ctl-gap-modal');
  modal.addEventListener('click',function(ev){if(ev.target===modal)modal.remove()});
}

/* Owned by this module — see core/delegated-actions.js. */
installActions(document.body,{
  ctlGapReport:function(){if(allowed())render()},
  ctlGapClose:function(){var m=E('ctl-gap-modal');if(m)m.remove()}
},{event:'click',attribute:'clickact'});

/* The button rides the custody page's own header, and only for the roles that
   could act on the answer. */
function mount(){
  if(!allowed())return;
  var host=document.querySelector('#pg-controlled .ch');
  if(!host||E('ctl-gap-btn'))return;
  var b=document.createElement('button');
  b.id='ctl-gap-btn';b.type='button';b.className='btn bg bsm';
  b.dataset.clickact='ctlGapReport';
  b.innerHTML='⚠ Quantities to enter / كميات لم تُوزَّع';
  host.appendChild(b);
}
window.__showPgAfterExtensions=window.__showPgAfterExtensions||[];
window.__showPgAfterExtensions.push(function(id){if(id==='pg-controlled')mount()});

})();

export {};
