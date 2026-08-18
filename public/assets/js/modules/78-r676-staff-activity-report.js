(function(){
'use strict';
/* Staff activity dashboard — for Master to compare individual users'
   contribution, especially peers doing the SAME job (grouped by role by
   default, since comparing a department clerk against a pharmacy director
   is meaningless — comparing two department clerks against each other is
   the actual ask). Entries/edits come from the existing audit_log; active
   time and top icons come from the new user_activity_daily_v1 rows written
   by core/activity-tracking.js. Bar comparisons reuse the app's own
   existing .brow/.btrk/.bfil bar-chart CSS (already used in the Top
   Medications analytics panel) rather than introducing a new charting
   pattern — numbers are printed directly on each bar so identity/values
   never rely on color alone. */

function el(id){return document.getElementById(id)}
function esc4(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function isManager(){
  return typeof window.isMaster==='function'&&window.isMaster();
}

var ROLE_LABELS={
  department:'Department staff / موظفو الأقسام',
  pharmacy:'Pharmacy / الصيدلية',
  pharmacy_director:'Pharmacy director / مدير الصيدلية',
  pharmacy_staff:'Pharmacy staff / طاقم الصيدلية',
  inpatient_supervisor:'Inpatient supervisor / مشرف صيدلية التنويم',
  outpatient_pharmacy_supervisor:'Outpatient supervisor / مشرف الصيدلية الخارجية',
  controlled_pharmacy:'Controlled medicines officer / مسؤول الأدوية المخدرة',
  warehouse:'Warehouse / المستودع'
};
function roleLabel(role){return ROLE_LABELS[role]||role||'Unknown role / دور غير معروف'}

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
        role:u.role||'',
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
  rows.forEach(function(r){
    r.activeHours=r.activeMinutes/60;
    r.entriesPerActiveHour=r.activeHours>0.05?Math.round((r.entries/r.activeHours)*10)/10:null;
  });
  return rows;
}

function topIcons(icons,n){
  return Object.keys(icons).map(function(key){return {key:key,count:icons[key]}})
    .sort(function(a,b){return b.count-a.count}).slice(0,n||3);
}
function formatMinutes(mins){
  var h=Math.floor(mins/60),m=Math.round(mins%60);
  return h?(h+'h '+m+'m'):(m+'m');
}
function avg(nums){return nums.length?nums.reduce(function(s,n){return s+n},0)/nums.length:0}

function barList(rows,valueKey,formatter,barColor){
  var max=Math.max.apply(null,rows.map(function(r){return r[valueKey]}).concat([1]));
  return rows.map(function(r){
    var pct=Math.max(4,Math.round(r[valueKey]/max*100));
    return '<div class="brow"><div class="blbl" title="'+esc4(r.userName)+'">'+esc4(r.userName)+'</div>'+
      '<div class="btrk"><div class="bfil" style="width:'+pct+'%;background:'+barColor+'"><span class="bval">'+formatter(r[valueKey])+'</span></div></div></div>';
  }).join('');
}

function groupRows(rows,groupBy){
  var groups={};
  rows.forEach(function(r){
    var key=groupBy==='dept'?(r.deptId||'—'):(r.role||'—');
    var label=groupBy==='dept'?(r.deptName||r.deptId||'Unassigned / بلا قسم'):roleLabel(r.role);
    if(!groups[key])groups[key]={key:key,label:label,rows:[]};
    groups[key].rows.push(r);
  });
  return Object.keys(groups).map(function(k){return groups[k]}).sort(function(a,b){return b.rows.length-a.rows.length});
}

function createModal(){
  if(el('mstaff-activity'))return;
  var div=document.createElement('div');div.id='mstaff-activity';div.className='modal-bg';
  var depts=(typeof window.gd==='function'?window.gd():[])||[];
  div.innerHTML=
    '<div class="modal" style="width:1150px;max-width:97vw;max-height:92vh;display:flex;flex-direction:column">'+
      '<div class="mh"><span class="mt">👥 Staff Activity Dashboard / لوحة نشاط الموظفين</span><button class="xbtn" type="button" data-close="mstaff-activity">✕</button></div>'+
      '<div style="padding:14px 18px;overflow:auto;flex:1">'+
        '<div class="fl g8" style="flex-wrap:wrap;margin-bottom:12px">'+
          '<select id="sar-dept"><option value="">All departments / كل الأقسام</option>'+
            depts.map(function(d){return '<option value="'+esc4(d.id)+'">'+esc4(d.name)+'</option>'}).join('')+
          '</select>'+
          '<select id="sar-group"><option value="role">Compare by role / مقارنة حسب المهمة</option><option value="dept">Compare by department / مقارنة حسب القسم</option></select>'+
          '<input id="sar-from" type="date">'+
          '<input id="sar-to" type="date">'+
          '<button class="btn bp bsm" type="button" id="sar-apply">Apply / تطبيق</button>'+
        '</div>'+
        '<div class="fhint" style="margin-bottom:10px">Entries/edits come from the existing audit log (~35 tracked action types — not every possible click). Active time and top icons are tracked from this update onward — no historical data before today. Groups compare peers doing the same job, so a fair ranking needs everyone signed in with their own individual account. / عدد الإدخالات من سجل التدقيق الحالي. الوقت النشط وأكثر الأيقونات تُحسب من الآن فصاعدًا. المقارنة عادلة فقط إذا كان كل موظف يستخدم حسابه الخاص.</div>'+
        '<div id="sar-summary" class="ctl-stat-row" style="margin-bottom:14px"></div>'+
        '<div id="sar-groups"></div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(div);
  div.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){CM('mstaff-activity')}});
  el('sar-apply').onclick=renderReport;
  el('sar-group').onchange=renderReport;
  var today=new Date().toISOString().slice(0,10);
  var monthAgo=new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
  el('sar-from').value=monthAgo;el('sar-to').value=today;
}

function groupSectionHtml(group){
  var rows=group.rows.slice();
  var byEntries=rows.slice().sort(function(a,b){return b.entries-a.entries});
  var byTime=rows.slice().sort(function(a,b){return b.activeMinutes-a.activeMinutes});
  var avgEntries=Math.round(avg(rows.map(function(r){return r.entries}))*10)/10;
  var avgMinutes=Math.round(avg(rows.map(function(r){return r.activeMinutes})));

  var tableRows=rows.slice().sort(function(a,b){return b.entries-a.entries}).map(function(r){
    var top=topIcons(r.icons,3).map(function(t){return esc4(iconLabel(t.key))+' ('+t.count+')'}).join(', ')||'—';
    var rate=r.entriesPerActiveHour==null?'—':r.entriesPerActiveHour;
    var vsAvgEntries=avgEntries>0?Math.round((r.entries-avgEntries)/avgEntries*100):null;
    var vsAvgBadge=vsAvgEntries==null?'':(vsAvgEntries>=0?'<span class="badge bgn">▲ '+vsAvgEntries+'%</span>':'<span class="badge brd">▼ '+Math.abs(vsAvgEntries)+'%</span>');
    return '<tr><td style="text-align:left;font-weight:700">'+esc4(r.userName)+'</td>'+
      '<td style="font-family:var(--mono)">'+r.entries+' '+vsAvgBadge+'</td>'+
      '<td style="font-family:var(--mono)">'+formatMinutes(r.activeMinutes)+'</td>'+
      '<td style="font-family:var(--mono)">'+rate+'</td>'+
      '<td class="fhint">'+top+'</td></tr>';
  }).join('');

  return '<div class="card" style="margin:0 0 14px">'+
    '<div class="ch"><span class="ct">'+esc4(group.label)+'</span><span class="badge bbl">'+rows.length+' staff / موظف</span></div>'+
    '<div class="cb">'+
    (rows.length>1?
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">'+
        '<div><div class="fhint" style="margin-bottom:6px">Entries/edits / إدخالات وتعديلات — avg '+avgEntries+'</div>'+barList(byEntries,'entries',function(v){return String(v)},'var(--ac)')+'</div>'+
        '<div><div class="fhint" style="margin-bottom:6px">Active time / الوقت النشط — avg '+formatMinutes(avgMinutes)+'</div>'+barList(byTime,'activeMinutes',formatMinutes,'var(--gnl,#1a7f37)')+'</div>'+
      '</div>'
      :'')+
    '<div class="tw"><table><thead><tr><th>User / الموظف</th><th>Entries/Edits</th><th>Active time</th><th>Entries / active hour</th><th>Most-used / الأكثر استخدامًا</th></tr></thead><tbody>'+
    (tableRows||'<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--tx2)">No activity / لا يوجد نشاط</td></tr>')+
    '</tbody></table></div>'+
    '</div></div>';
}

function renderReport(){
  var deptFilter=el('sar-dept').value,from=el('sar-from').value,to=el('sar-to').value,groupBy=el('sar-group').value;
  var rows=buildReport(deptFilter,from,to);

  var totalEntries=rows.reduce(function(s,r){return s+r.entries},0);
  var totalMinutes=rows.reduce(function(s,r){return s+r.activeMinutes},0);
  el('sar-summary').innerHTML=
    _statCard('Staff with activity / موظفون نشطون',rows.length)+
    _statCard('Total entries/edits / إجمالي الإدخالات',totalEntries)+
    _statCard('Total active time / إجمالي الوقت النشط',formatMinutes(totalMinutes))+
    _statCard('Avg entries/staff / متوسط الإدخالات',rows.length?Math.round(totalEntries/rows.length*10)/10:0);

  var groups=groupRows(rows,groupBy);
  el('sar-groups').innerHTML=groups.length?groups.map(groupSectionHtml).join(''):'<div class="fhint" style="text-align:center;padding:20px">No activity in this range / لا يوجد نشاط بهذه الفترة</div>';
}
function _statCard(label,val){
  return '<div class="ctl-stat-card"><div class="ctl-stat-card-label">'+label+'</div><div class="ctl-stat-card-value">'+val+'</div></div>';
}

window.ctlOpenStaffActivity=function(){
  if(!isManager())return window.toast&&window.toast('Access restricted to Master. / الوصول مقصور على الماستر فقط.','err');
  createModal();
  OM('mstaff-activity');
  renderReport();
};

function injectButton(){
  var tabs=el('anl-tabs');
  // #anl-tabs is static HTML present from first page load, before any
  // login — so on the very first call CU/isManager() is never ready yet.
  // Poll continuously and add/remove the button based on live isManager()
  // state (also handles logout and Master "acting as" role switching).
  if(!tabs)return;
  var existing=el('sar-open-btn');
  if(isManager()){
    if(!existing){
      var btn=document.createElement('button');
      btn.className='btn bg bsm';btn.type='button';btn.id='sar-open-btn';
      btn.style.marginInlineStart='auto';
      btn.textContent='👥 Staff Activity / نشاط الموظفين';
      btn.onclick=window.ctlOpenStaffActivity;
      tabs.parentNode.insertBefore(btn,tabs);
    }
  }else if(existing){
    existing.remove();
  }
}
setInterval(injectButton,1000);
injectButton();
})();
export {};
