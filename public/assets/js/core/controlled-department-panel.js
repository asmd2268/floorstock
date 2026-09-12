/* The department's own view of its controlled custody: a read-only panel with a
   near-expiry filter, and the two controls that drive it.

   A department cannot edit this list — it is the pharmacy's record of what the
   department holds — so the panel's whole job is to show it honestly: what is
   held, what is due to expire inside the chosen window, and where the numbers
   were read from when the private document was not readable.

   It renders into a child panel rather than over `ctl-departments-view`, because
   that container also carries the static custodian markup the page needs to keep.

   The last screen to leave modules/51. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText, fsNum } from './text-normalize.js?v=aa16ae9ac0';
import { uiToast } from './module-ui-helpers.js?v=3657403ad7';
import { fsR5ControlledDept, fsR5ControlledRows } from './controlled-custody-data.js?v=995b32b44b';
import { fsR5DMY, fsR12BatchSummaryHtml, fsR5Class, fsR5ExpiryDays, fsR5NearDays } from './controlled-expiry-format.js?v=7370bbb9a3';
import { installActions } from './delegated-actions.js?v=078b8d25e6';

/* One listener for the panel's own buttons, installed at module load — the four
   functions it calls are the window.* ones this file publishes below, so the
   bare-name/global boundary never matters here / مستمع واحد لأزرار اللوحة. */
installActions(document.body,{
  ctlDeptFinalApply:function(){return window.ctlDeptFinalApply()},
  ctlDeptFinalToggle:function(){return window.ctlDeptFinalToggle()},
  ctlConfirmDepartmentPrint:function(el,event){return window.ctlConfirmDepartmentPrint(event)},
  renderDepartmentControlledPanel:function(){return window.renderDepartmentControlledPanel()}
},{event:'click',attribute:'clickact'});

window.ctlDeptFinalApply=function(){
  var dept=fsR5ControlledDept(),input=fsE('ctl-dept-final-days'),days=Math.floor(fsNum(input&&input.value));
  if(days<1)return uiToast('Enter a valid number of days / أدخل عدد أيام صحيحًا','err');
  try{sessionStorage.setItem('asdhealth-controlled-near-days-'+dept,String(days))}catch(e){/* storage is unavailable: a private window, or site data the browser cleared. The feature works without it. */}
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.ctlDeptFinalToggle=function(){
  window.CTL_DEPT_ONLY_SOON=!window.CTL_DEPT_ONLY_SOON;
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.renderDepartmentControlledPanel=async function(){
  var effective=(typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():window.CU||{});
  if(String(effective.role||'')!=='department')return false;
  var outer=fsE('ctl-departments-view');
  // Render into a dedicated child panel instead of overwriting ctl-departments-view's
  // innerHTML directly: that container also holds the static custodian markup
  // (#ctl-dept, #ctl-dept-table) that renderCtlDepartments() depends on for
  // controlled_pharmacy/warehouse sessions. Clobbering it here permanently destroys
  // those elements for the rest of the SPA session (no page reload between logins),
  // leaving a stale department view visible after a later custodian sign-in.
  var host=fsE('ctl-dept-only-panel');
  if(!outer||!host)return false;
  var custodianPanel=fsE('ctl-departments-custodian-panel');
  if(custodianPanel)custodianPanel.style.display='none';
  if(host.dataset.controlledLoading==='1')return false;
  host.dataset.controlledLoading='1';

  window.CTL_VIEW='departments';
  var overview=fsE('ctl-overview-view');
  if(overview)overview.style.display='none';
  outer.style.display='block';
  host.style.display='block';
  host.innerHTML='<div class="card"><div class="cb">Loading My controlled list… / جاري تحميل عهدتي…</div></div>';

  try{
    var requested=fsR5ControlledDept();
    var result=await fsLoginTimeout(
      fsR5ControlledRows(requested),
      18000,
      'Controlled custody loading timed out.'
    );
    var dept=result.dept||requested;
    var rows=result.rows||[];
    var days=fsR5NearDays(dept);

    var shown=window.CTL_DEPT_ONLY_SOON?rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days;
    }):rows;

    var soon=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days&&remaining>0;
    }).length;

    var expired=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=0;
    }).length;

    var body=shown.map(function(row,index){
      return '<tr>'+
        '<td>'+(index+1)+'</td>'+
        '<td>'+fsEsc(row.moh||'—')+'</td>'+
        '<td>'+fsEsc(row.nupco||'—')+'</td>'+
        '<td><b>'+fsEsc(row.name)+'</b></td>'+
        '<td>'+fsEsc(fsR5Class(row.classification))+'</td>'+
        '<td>'+fsEsc(row.required)+'</td>'+
        '<td>'+fsEsc(row.actual)+'</td>'+
        '<td class="ctl-batch-number-cell">'+fsR12BatchSummaryHtml(row.batches)+'</td>'+
      '</tr>';
    }).join('');

    if(!body){
      body='<tr><td colspan="8" style="text-align:center;padding:24px">'+
        'No medicines are assigned to this department custody / لا توجد أدوية مسندة لعهدة هذا القسم'+
      '</td></tr>';
    }

    var deptName=effective.deptName||effective.departmentName||
      window.floorstockDepartmentName({id:dept});

    host.innerHTML=
      '<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px">'+
        '<div><div class="stitle">My controlled list / عهدتي</div>'+
        '<div class="ssub" style="margin:0">Controlled Custody — '+
          fsEsc(deptName)+' · Read-only</div></div>'+
        '<span class="badge bbl">View only / للاطلاع</span>'+
      '</div>'+
      '<div class="card"><div class="cb"><div class="ctl-rulebar">'+
        '<div class="fg"><label>Near-expiry rule (days)</label>'+
          '<input id="ctl-dept-final-days" type="number" min="1" value="'+days+'"></div>'+
        '<button class="btn bp" type="button" data-clickact="ctlDeptFinalApply">Apply rule</button>'+
        '<button class="btn bg" type="button" data-clickact="ctlDeptFinalToggle">'+
          (window.CTL_DEPT_ONLY_SOON?'Show all medicines':'Show near-expiry only')+
        '</button>'+
        '<button class="btn bp" type="button" id="ctl-dept-authoritative-print-btn" '+
          'data-clickact="ctlConfirmDepartmentPrint">🖨 Print My controlled list / طباعة عهدتي</button>'+
      '</div>'+
      '<div class="ctl-summary">'+
        '<div class="sc"><div class="sl">Total medicines</div><div class="sv">'+rows.length+'</div></div>'+
        '<div class="sc"><div class="sl">Near expiry ≤ '+days+' days</div><div class="sv">'+soon+'</div></div>'+
        '<div class="sc"><div class="sl">Expired</div><div class="sv">'+expired+'</div></div>'+
      '</div>'+
      '<div class="fhint" style="margin-top:8px">Data source: '+
        fsEsc(result.source||'unknown')+'</div></div></div>'+
      '<div class="card">'+
        '<div class="ch"><span class="ct">Controlled and Restricted Medicines List / قائمة الأدوية المخدرة والمقيدة</span></div>'+
                '<div class="tw ctl-dept-custody-scroll">'+
          '<table class="ctl-dept-custody-table">'+
            '<colgroup>'+
              '<col style="width:4%"><col style="width:9%"><col style="width:10%">'+
              '<col style="width:24%"><col style="width:11%"><col style="width:8%">'+
              '<col style="width:8%"><col style="width:26%">'+
            '</colgroup>'+
            '<thead><tr>'+
              '<th>#</th><th>MOH Code</th><th>NUPCO Code</th><th>Medicine</th>'+
              '<th>Class</th><th>Required</th><th>Actual</th>'+
              '<th>Batches / الدفعات — Lot · Qty · Expiry</th>'+
            '</tr></thead>'+
            '<tbody>'+body+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';

    host.style.display='block';
    delete host.dataset.controlledLoading;
    return true;
  }catch(error){
    console.error('Department controlled custody render failed.',error);
    host.style.display='block';
    host.innerHTML='<div class="card"><div class="cb">'+
      '<div class="alert-banner">Controlled custody could not be loaded / تعذر تحميل عهدة القسم</div>'+
      '<p style="margin-top:10px">'+fsEsc(error&&error.message||error)+'</p>'+
      '<button class="btn bp" type="button" data-clickact="renderDepartmentControlledPanel">'+
        'Retry / إعادة المحاولة</button></div></div>';
    delete host.dataset.controlledLoading;
    return false;
  }
};
