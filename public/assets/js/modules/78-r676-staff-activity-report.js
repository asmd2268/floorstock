(function(){
'use strict';
/* Staff activity report — for management (Master/pharmacy roles) to see
   each individual user's contribution: entries/edits made (from the
   existing audit_log — not re-logged here), active time spent in the app,
   and their most-used buttons/icons (both from the new
   user_activity_daily_v1 rows written by core/activity-tracking.js).
   Filterable by department and date range. */

function el(id){return document.getElementById(id)}
function esc4(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function isManager(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  return (typeof window.isMaster==='function'&&window.isMaster())||['pharmacy','pharmacy_director'].indexOf(role)>=0;
}

function usersDirectory(){return (window.S&&window.S.g?window.S.g('users')||[]:[])}
function auditRows(){return (window.S&&window.S.g?window.S.g('audit_log')||[]:[])}
function activityRows(){return (window.S&&window.S.g?window.S.g('user_activity_daily_v1')||[]:[])}

function inRange(dateStr,from,to){
  if(!dateStr)return false;
  var d=dateStr.slice(0,10);
  if(from&&d<from)return false;
  if(to&&d>to)return false;
  return true;
}

function iconLabel(key){
  if(key.indexOf('#')===0)return key.slice(1);
  if(key.indexOf('bind:')===0)return key.slice(5);
  if(key.indexOf('txt:')===0)return key.slice(4);
  if(key.indexOf('cls:')===0)return key.slice(4);
  return key;
}

function buildReport(deptFilter,from,to){
  var users=usersDirectory();
  var usersById={};users.forEach(function(u){usersById[String(u.id||u.uid||'')]=u});

  var byUser={};
  function ensure(uid){
    if(!byUser[uid]){
      var u=usersById[uid]||{};
      byUser[uid]={
        userId:uid,
        userName:u.username||u.displayName||u.email||uid,
        deptId:u.deptId||'',
        deptName:u.deptName||'',
        entries:0,
        activeMinutes:0,
        icons:{}
      };
    }
    return byUser[uid];
  }

  auditRows().forEach(function(a){
    if(!a||!a.actorId||!inRange(a.at,from,to))return;
    var row=ensure(String(a.actorId));
    row.entries+=1;
  });

  activityRows().forEach(function(r){
    if(!r||!r.userId||!inRange(r.date,from,to))return;
    var row=ensure(String(r.userId));
    row.activeMinutes+=Number(r.activeMinutes)||0;
    if(!row.deptId&&r.deptId){row.deptId=r.deptId;row.deptName=r.deptName||row.deptName}
    Object.keys(r.iconCounts||{}).forEach(function(key){row.icons[key]=(row.icons[key]||0)+r.iconCounts[key]});
  });

  var rows=Object.keys(byUser).map(function(uid){return byUser[uid]}).filter(function(row){
    return !deptFilter||String(row.deptId)===String(deptFilter);
  });
  rows.sort(function(a,b){return (b.entries+b.activeMinutes)-(a.entries+a.activeMinutes)});
  return rows;
}

function topIcons(icons,n){
  return Object.keys(icons).map(function(key){return {key:key,count:icons[key]}})
    .sort(function(a,b){return b.count-a.count}).slice(0,n||3);
}
function formatMinutes(mins){
  var h=Math.floor(mins/60),m=mins%60;
  return h?(h+'h '+m+'m'):(m+'m');
}

function createModal(){
  if(el('mstaff-activity'))return;
  var div=document.createElement('div');div.id='mstaff-activity';div.className='modal-bg';
  var depts=(typeof window.gd==='function'?window.gd():[])||[];
  div.innerHTML=
    '<div class="modal" style="width:1100px;max-width:97vw;max-height:92vh;display:flex;flex-direction:column">'+
      '<div class="mh"><span class="mt">👥 Staff Activity / نشاط الموظفين</span><button class="xbtn" type="button" data-close="mstaff-activity">✕</button></div>'+
      '<div style="padding:14px 18px;overflow:auto;flex:1">'+
        '<div class="fl g8" style="flex-wrap:wrap;margin-bottom:12px">'+
          '<select id="sar-dept"><option value="">All departments / كل الأقسام</option>'+
            depts.map(function(d){return '<option value="'+esc4(d.id)+'">'+esc4(d.name)+'</option>'}).join('')+
          '</select>'+
          '<input id="sar-from" type="date">'+
          '<input id="sar-to" type="date">'+
          '<button class="btn bp bsm" type="button" id="sar-apply">Apply / تطبيق</button>'+
        '</div>'+
        '<div class="fhint" style="margin-bottom:10px">Entries/edits come from the existing audit log (~35 tracked action types — not every possible click). Active time and top icons are tracked from this update onward — no historical data before today. / عدد الإدخالات من سجل التدقيق الحالي (لا يغطي كل عملية ممكنة). الوقت النشط وأكثر الأيقونات استخدامًا تُحسب من الآن فصاعدًا فقط.</div>'+
        '<div class="card" style="margin:0"><div class="tw"><table><thead><tr>'+
          '<th>User / الموظف</th><th>Department / القسم</th><th>Entries/Edits / إدخالات وتعديلات</th><th>Active time / الوقت النشط</th><th>Most-used / الأكثر استخدامًا</th>'+
        '</tr></thead><tbody id="sar-rows"></tbody></table></div></div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(div);
  div.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){CM('mstaff-activity')}});
  el('sar-apply').onclick=renderReport;
  var today=new Date().toISOString().slice(0,10);
  var monthAgo=new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
  el('sar-from').value=monthAgo;el('sar-to').value=today;
}

function renderReport(){
  var deptFilter=el('sar-dept').value,from=el('sar-from').value,to=el('sar-to').value;
  var rows=buildReport(deptFilter,from,to);
  el('sar-rows').innerHTML=rows.length?rows.map(function(r){
    var top=topIcons(r.icons,3).map(function(t){return esc4(iconLabel(t.key))+' ('+t.count+')'}).join(', ')||'—';
    return '<tr><td style="text-align:left;font-weight:700">'+esc4(r.userName)+'</td>'+
      '<td>'+esc4(r.deptName||r.deptId||'—')+'</td>'+
      '<td style="font-family:var(--mono)">'+r.entries+'</td>'+
      '<td style="font-family:var(--mono)">'+formatMinutes(r.activeMinutes)+'</td>'+
      '<td class="fhint">'+top+'</td></tr>';
  }).join(''):'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tx2)">No activity in this range / لا يوجد نشاط بهذه الفترة</td></tr>';
}

window.ctlOpenStaffActivity=function(){
  if(!isManager())return window.toast&&window.toast('Access restricted to Master or Pharmacy management. / الوصول مقصور على الماستر أو إدارة الصيدلية.','err');
  createModal();
  OM('mstaff-activity');
  renderReport();
};

var _btnAttempts=0;
function injectButton(){
  var tabs=el('anl-tabs');
  if(!tabs){if(++_btnAttempts<80)setTimeout(injectButton,500);return}
  if(el('sar-open-btn'))return;
  if(!isManager())return;
  var btn=document.createElement('button');
  btn.className='btn bg bsm';btn.type='button';btn.id='sar-open-btn';
  btn.style.marginInlineStart='auto';
  btn.textContent='👥 Staff Activity / نشاط الموظفين';
  btn.onclick=window.ctlOpenStaffActivity;
  tabs.parentNode.insertBefore(btn,tabs);
}
injectButton();
})();
export {};
