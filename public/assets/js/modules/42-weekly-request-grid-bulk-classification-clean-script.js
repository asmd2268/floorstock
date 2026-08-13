import { canEditRequestWhileWindowIsOpen, requestWindowDeadlineFromGrid } from '../core/request-edit-policy.js';

(function(){
'use strict';
const E=globalThis.E;
function escH(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var GRID_KEY='request_hour_grids_v1';
var DAYS_EN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var DAYS_AR=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
var draft=null,sourceDept='',painting=false,paintValue=true;
function allAllowed(){return Array.from({length:7},function(){return Array(24).fill(true)})}
function allBlocked(){return Array.from({length:7},function(){return Array(24).fill(false)})}
function normalizeGrid(g){var out=allBlocked();if(!Array.isArray(g))return out;for(var d=0;d<7;d++)for(var h=0;h<24;h++)out[d][h]=!!(g[d]&&g[d][h]);return out}
function cloneGrid(g){return normalizeGrid(g).map(function(r){return r.slice()})}
function flattenGrid(g){var n=normalizeGrid(g),out=[];for(var d=0;d<7;d++)for(var h=0;h<24;h++)out.push(!!n[d][h]);return out}
function unflattenGrid(flat){var out=allBlocked();if(!Array.isArray(flat))return out;for(var i=0;i<168;i++)out[Math.floor(i/24)][i%24]=!!flat[i];return out}
function getMaps(){try{var m=(window.S&&S.g&&S.g(GRID_KEY))||{};return m&&typeof m==='object'?m:{}}catch(e){return{}}}
function deptAliases(dept){
 var raw=String(dept==null?'':dept),out=[];
 function add(v){v=String(v==null?'':v).trim();if(v&&out.indexOf(v)<0)out.push(v)}
 add(raw);
 var depts=typeof gd==='function'?(gd()||[]):[];
 var match=depts.find(function(d){return String(d.id)===raw||String(d.name||'')===raw||String(d.code||'')===raw});
 if(match){add(match.id);add(match.name);add(match.code)}
 if(window.CU&&String(CU.role)==='department'&&(String(CU.deptId||'')===raw||String(CU.deptName||'')===raw||!raw)){add(CU.deptId);add(CU.deptName)}
 return out
}
function mappedGrid(dept){
 var maps=getMaps(),aliases=deptAliases(dept),keys=Object.keys(maps||{});
 for(var i=0;i<aliases.length;i++)if(Object.prototype.hasOwnProperty.call(maps,aliases[i])&&Array.isArray(maps[aliases[i]]))return normalizeGrid(maps[aliases[i]]);
 for(var k=0;k<keys.length;k++)if(aliases.some(function(a){return String(keys[k]).toLowerCase()===String(a).toLowerCase()})){var g=maps[keys[k]];if(Array.isArray(g))return normalizeGrid(g)}
 return null
}
function legacyGrid(dept){
 var wins=typeof window.getReqWindows==='function'?(getReqWindows()||[]):[];
 var aliases=deptAliases(dept);
 var applicable=wins.filter(function(w){return w&&w.active!==false&&(w.dept==='all'||aliases.indexOf(String(w.dept))>-1)});
 if(!applicable.length)return allAllowed();
 var g=allBlocked();
 applicable.forEach(function(w){var days=Array.isArray(w.days)?w.days:[],a=timeM(w.from),b=timeM(w.to);days.forEach(function(d){for(var h=0;h<24;h++){var hs=h*60,he=(h+1)*60;if(a<=b){if(he>a&&hs<b)g[d][h]=true}else{if(he>a||hs<b)g[d][h]=true}}})});
 return g
}
function storedWeeklyGrid(dept){
 var wins=typeof window.getReqWindows==='function'?(getReqWindows()||[]):[],aliases=deptAliases(dept).map(function(x){return String(x).toLowerCase()});
 var rec=wins.find(function(w){return w&&w.type==='weekly_grid_v2'&&aliases.indexOf(String(w.dept||'').toLowerCase())>-1&&(Array.isArray(w.gridFlat)||Array.isArray(w.grid))});
 if(!rec)return null;
 return Array.isArray(rec.gridFlat)?unflattenGrid(rec.gridFlat):normalizeGrid(rec.grid)
}
function gridFor(dept){var stored=storedWeeklyGrid(dept);if(stored)return stored;var mapped=mappedGrid(dept);return mapped||legacyGrid(dept)}
function timeM(t){var p=String(t||'00:00').split(':');return (+p[0]||0)*60+(+p[1]||0)}
function hourLabel(h){return String(h).padStart(2,'0')+':00'}
function rowRanges(row){var out=[],start=null;for(var h=0;h<=24;h++){var on=h<24&&!!row[h];if(on&&start===null)start=h;if(!on&&start!==null){out.push(hourLabel(start)+'–'+(h===24?'24:00':hourLabel(h)));start=null}}return out}
function riyadhParts(){var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),o={};parts.forEach(function(p){o[p.type]=p.value});var y=+o.year,m=+o.month,d=+o.day,h=+o.hour,mi=+o.minute,dow=new Date(Date.UTC(y,m-1,d)).getUTCDay();return{year:y,month:m,day:d,hour:h,minute:mi,dow:dow}}
function nextAllowed(g,p){for(var step=1;step<=168;step++){var total=p.hour+step,day=(p.dow+Math.floor(total/24))%7,h=total%24;if(g[day][h])return{dayIndex:day,day:DAYS_EN[day],time:hourLabel(h),hour:h,minsAway:step*60-p.minute}}return null}
function currentClose(g,d,h){var x=h;while(x<24&&g[d][x])x++;return x===24?'24:00':hourLabel(x)}
function allowedText(dept,check){var g=check&&Array.isArray(check.scheduleGrid)?check.scheduleGrid:gridFor(dept),p=riyadhParts(),today=rowRanges(g[p.dow]);var n=check&&check.next?check.next:nextAllowed(g,p);return{today:today.length?today.join('، '):'لا يوجد وقت مسموح اليوم / No allowed hours today',next:n?(DAYS_EN[n.dayIndex]+' / '+DAYS_AR[n.dayIndex]+' '+hourLabel(n.hour)):'لا يوجد وقت مسموح خلال الأسبوع / No allowed time this week',week:weeklyAllowedRows(g)}}
function splitRange(r){var p=String(r||'').split(/\s*[–-]\s*/);return{from:p[0]||'',to:p[1]||''}}
function weeklyAllowedRows(g){var rows=[],order=[6,0,1,2,3,4,5];order.forEach(function(d){var rs=rowRanges(g[d]||[]);if(rs.length)rows.push({dayIndex:d,ar:DAYS_AR[d],en:DAYS_EN[d],ranges:rs})});return rows}
function weeklyRowsHtml(rows){if(!rows||!rows.length)return '<div class="fhint">لا توجد أوقات طلب مفعلة خلال الأسبوع / No request hours are enabled this week.</div>';return '<ul>'+rows.map(function(row){var arParts=row.ranges.map(function(r){var p=splitRange(r);return p.from==='00:00'&&p.to==='24:00'?'متاح طوال اليوم (24 ساعة)':'من '+p.from+' إلى '+p.to}),enParts=row.ranges.map(function(r){var p=splitRange(r);return p.from==='00:00'&&p.to==='24:00'?'Open 24 hours':p.from+'–'+p.to});return '<li><span class="ar">يوم '+escH(row.ar)+': '+escH(arParts.join('، ثم '))+'</span><span class="en">'+escH(row.en)+': '+escH(enParts.join(', '))+'</span></li>'}).join('')+'</ul>'}
window.isRequestAllowed=function(deptId){var g=gridFor(deptId),p=riyadhParts(),allowed=!!(g[p.dow]&&g[p.dow][p.hour]),base={scheduleGrid:cloneGrid(g),scheduleSource:mappedGrid(deptId)?'weekly-grid':'legacy'};if(allowed)return Object.assign(base,{allowed:true,reason:'',window:{to:currentClose(g,p.dow,p.hour)},grid:true});return Object.assign(base,{allowed:false,reason:'Outside request hours',next:nextAllowed(g,p),grid:true})}
window.getRequestEditDeadline=function(deptId,submittedAt){return requestWindowDeadlineFromGrid(gridFor(deptId),submittedAt)};
window.getCurrentRequestEditDeadline=function(deptId,nowValue){return requestWindowDeadlineFromGrid(gridFor(deptId),nowValue==null?Date.now():nowValue)};
window.canEditRequestBySchedule=function(request){var check=window.isRequestAllowed(request&&request.deptId);return canEditRequestWhileWindowIsOpen(request,!!(check&&check.allowed))};
var requestGridRetryCount=0,requestGridRetryTimer=null;

function requestGridDepartments(){
  var official=[];
  try{
    official=typeof window.gd==='function'?(window.gd()||[]):[];
  }catch(error){
    official=[];
  }

  var seen={};
  return (Array.isArray(official)?official:[]).filter(function(department){
    if(!department||department.id==null)return false;
    var id=String(department.id).trim();
    if(!id||id==='all'||seen[id])return false;
    seen[id]=1;
    return true;
  });
}

function requestGridOrphans(){
  var official=requestGridDepartments();
  var officialIds={};
  official.forEach(function(department){officialIds[String(department.id).toLowerCase()]=1;});
  var deleted={};
  try{
    var tombstones=window.S&&typeof S.g==='function'?(S.g('deleted_departments')||[]):[];
    (Array.isArray(tombstones)?tombstones:[]).forEach(function(value){deleted[String(value).toLowerCase()]=1;});
  }catch(error){}

  var records={};
  function add(id,name,source){
    id=String(id==null?'':id).trim();
    if(!id||id==='all'||officialIds[id.toLowerCase()])return;
    var key=id.toLowerCase();
    if(!records[key])records[key]={id:id,name:String(name||id),sources:[],userCount:0,tombstoned:!!deleted[key]};
    if(name&&records[key].name===records[key].id)records[key].name=String(name);
    if(source&&records[key].sources.indexOf(source)<0)records[key].sources.push(source);
  }

  try{
    var windows=typeof window.getReqWindows==='function'?(getReqWindows()||[]):[];
    windows.forEach(function(item){if(item&&item.dept)add(item.dept,item.deptName,'Request schedule');});
  }catch(error){}

  try{
    var slots=typeof window.getDispSlots==='function'?(getDispSlots()||[]):[];
    slots.forEach(function(item){if(item)add(item.dept||item.deptId,item.deptName,'Dispense slot');});
  }catch(error){}

  try{
    var limits=typeof window.getMonthlyLimits==='function'?(getMonthlyLimits()||{}):{};
    Object.keys(limits||{}).forEach(function(id){add(id,'','Monthly limit');});
  }catch(error){}

  try{
    var maps=window.S&&typeof S.g==='function'?(S.g(GRID_KEY)||{}):{};
    Object.keys(maps||{}).forEach(function(id){add(id,'','Legacy hour grid');});
  }catch(error){}

  try{
    var prefixes=['meds_','expiry_','shelves_','alerts_','controlled_dept_list_','controlled_settings_'];
    if(window.S&&S.cache){
      Object.keys(S.cache).forEach(function(key){
        for(var i=0;i<prefixes.length;i++){
          if(key.indexOf(prefixes[i])===0){
            add(key.slice(prefixes[i].length),'','State: '+prefixes[i].slice(0,-1));
            break;
          }
        }
      });
    }
  }catch(error){}

  try{
    var users=typeof window.gu==='function'?(gu()||[]):[];
    users.forEach(function(user){
      var id=user&&String(user.deptId||user.departmentId||user.department||'').trim();
      if(!id)return;
      add(id,user.deptName||user.departmentName||user.departmentLabel,'Linked user');
      var record=records[id.toLowerCase()];
      if(record)record.userCount++;
    });
  }catch(error){}

  return Object.keys(records).map(function(key){return records[key];}).sort(function(a,b){
    return String(a.name||a.id).localeCompare(String(b.name||b.id));
  });
}

function renderRequestGridOrphans(){
  var host=E('request-grid-orphans');
  if(!host)return;
  var orphans=requestGridOrphans();
  var canPurge=!!(window.CU&&CU.master===true);
  if(!orphans.length){host.innerHTML='';host.style.display='none';return;}
  host.style.display='block';
  host.innerHTML='<div class="request-grid-orphan-head"><b>Orphaned department records / سجلات أقسام محذوفة</b><span>These records are not selectable departments.</span></div>'+
    orphans.map(function(record){
      var sources=record.sources.length?record.sources.join(' · '):'Unknown source';
      var userNote=record.userCount?'<span class="request-grid-orphan-warning">'+record.userCount+' linked user(s) — delete or reassign them first.</span>':'';
      var action=record.userCount
        ?'<button class="btn bg bxs" type="button" onclick="showPg(\'pg-users\')">Manage users</button>'
        :'<button class="btn bd2c bxs" type="button" '+(canPurge?'':'disabled ')+
          'onclick="purgeOrphanDepartment('+JSON.stringify(record.id).replace(/"/g,'&quot;')+')">Delete permanently</button>';
      return '<div class="request-grid-orphan-row">'+
        '<div><b>'+escH(record.name||record.id)+'</b><code>'+escH(record.id)+'</code><small>'+escH(sources)+'</small>'+userNote+'</div>'+action+
      '</div>';
    }).join('');
}

async function floorstockDeletionStep(report,name,task){
  try{
    await task();
    report.completed.push(name);
    return true;
  }catch(error){
    var message=String(error&&error.message||error||'Unknown error');
    report.failed.push({step:name,message:message});
    var wrapped=new Error(name+': '+message);
    wrapped.deletionReport=report;
    throw wrapped;
  }
}

function floorstockDeleteMatchesFactory(values){
  var map={};
  (values||[]).forEach(function(value){
    value=String(value==null?'':value).trim().toLowerCase();
    if(value)map[value]=true;
  });
  return function(value){
    return !!map[String(value==null?'':value).trim().toLowerCase()];
  };
}

function floorstockDeleteUiRefresh(){
  var failures=[];
  [
    ['Users',function(){if(typeof renderUsers==='function')renderUsers();}],
    ['Department selectors',function(){if(typeof fillDS==='function')fillDS();}],
    ['Inventory department selector',function(){
      if(typeof populateInvDeptSel==='function')populateInvDeptSel();
    }],
    ['Request schedule',function(){
      if(typeof window.renderRequestHourGridUI==='function'){
        window.renderRequestHourGridUI();
      }
    }]
  ].forEach(function(step){
    try{step[1]();}
    catch(error){
      failures.push({
        step:step[0],
        message:String(error&&error.message||error)
      });
      console.warn('Post-deletion UI refresh failed:',step[0],error);
    }
  });
  return failures;
}

async function floorstockPurgeDepartmentState(id,aliases,removeOfficial){
  id=String(id||'').trim();
  aliases=(Array.isArray(aliases)?aliases:[])
    .map(function(value){return String(value||'').trim();})
    .filter(Boolean);

  if(!id)throw new Error('Department ID is missing.');
  if(aliases.indexOf(id)<0)aliases.unshift(id);

  var matches=floorstockDeleteMatchesFactory(aliases);
  var report={
    departmentId:id,
    aliases:aliases.slice(),
    completed:[],
    failed:[],
    optionalFailed:[]
  };


  var deleted=(window.S&&typeof S.g==='function'
    ?S.g('deleted_departments')
    :null)||[];
  deleted=Array.isArray(deleted)?deleted.slice():[];

  aliases.forEach(function(value){
    if(!deleted.some(function(item){
      return String(item).toLowerCase()===String(value).toLowerCase();
    })){
      deleted.push(value);
    }
  });

  await floorstockDeletionStep(
    report,
    'Save deletion marker',
    function(){return S.s('deleted_departments',deleted);}
  );

  var prefixes=[
    'meds_',
    'expiry_',
    'shelves_',
    'alerts_',
    'controlled_dept_list_',
    'controlled_settings_'
  ];

  for(var aliasIndex=0;aliasIndex<aliases.length;aliasIndex++){
    var alias=aliases[aliasIndex];
    for(var prefixIndex=0;prefixIndex<prefixes.length;prefixIndex++){
      var key=prefixes[prefixIndex]+alias;
      if(!S.cache||!Object.prototype.hasOwnProperty.call(S.cache,key))continue;
      await floorstockDeletionStep(
        report,
        'Delete state '+key,
        function(keyCopy){return function(){return S.rm(keyCopy);};}(key)
      );
    }
  }

  var windows=(S.g('req_windows')||[]).filter(function(item){
    return !item||!matches(item.dept||item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove request schedules',
    function(){return S.s('req_windows',windows);}
  );

  var slots=(S.g('disp_slots')||[]).filter(function(item){
    return !item||!matches(item.dept||item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove dispense slots',
    function(){return S.s('disp_slots',slots);}
  );

  var monthly=Object.assign({},S.g('monthly_limits')||{});
  Object.keys(monthly).forEach(function(key){
    if(matches(key))delete monthly[key];
  });
  await floorstockDeletionStep(
    report,
    'Remove monthly limits',
    function(){return S.s('monthly_limits',monthly);}
  );

  var requestLimits=Object.assign(
    {},
    S.g('request_count_limits_v1')||{}
  );
  Object.keys(requestLimits).forEach(function(key){
    if(matches(key))delete requestLimits[key];
  });
  await floorstockDeletionStep(
    report,
    'Remove request-count limits',
    function(){return S.s('request_count_limits_v1',requestLimits);}
  );

  var hourMaps=Object.assign(
    {},
    S.g('request_hour_grids_v1')||{}
  );
  Object.keys(hourMaps).forEach(function(key){
    if(matches(key))delete hourMaps[key];
  });
  await floorstockDeletionStep(
    report,
    'Remove weekly request-hour grid',
    function(){return S.s('request_hour_grids_v1',hourMaps);}
  );


  var accountabilityAssignments=(S.g('accountability_assignments_v2')||[]).filter(function(item){
    return !item||!matches(item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove medication-accountability custody assignments',
    function(){return S.s('accountability_assignments_v2',accountabilityAssignments);}
  );

  var accountabilityUsage=(S.g('accountability_usage_v2')||[]).filter(function(item){
    return !item||!matches(item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove medication-accountability usage requests',
    function(){return S.s('accountability_usage_v2',accountabilityUsage);}
  );

  var accountabilityReceipts=(S.g('accountability_receipts_v2')||[]).filter(function(item){
    return !item||!matches(item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove medication-accountability nursing receipts',
    function(){return S.s('accountability_receipts_v2',accountabilityReceipts);}
  );

  var accountabilityRegimens=(S.g('accountability_regimens_v2')||[]).filter(function(item){
    return !item||!matches(item.deptId);
  });
  await floorstockDeletionStep(
    report,
    'Remove medication-accountability regimens',
    function(){return S.s('accountability_regimens_v2',accountabilityRegimens);}
  );

  if(removeOfficial){
    await floorstockDeletionStep(
      report,
      'Delete official department record',
      function(){
        var remaining=(S.g('departments')||[]).filter(function(department){
          return String(department&&department.id||'')!==String(id);
        });
        return S.s('departments',remaining);
      }
    );
  }

  var officialRemaining=(S.g('departments')||[]).some(function(department){
    return String(department&&department.id||'')===String(id);
  });
  if(removeOfficial&&officialRemaining){
    var verifyError=new Error(
      'Delete official department record: read-back verification failed.'
    );
    report.failed.push({
      step:'Verify official department removal',
      message:verifyError.message
    });
    verifyError.deletionReport=report;
    throw verifyError;
  }

  report.completed.push('Verify department deletion');

  if(window.FB_DB&&window.FB_AUTH&&FB_AUTH.currentUser){
    var publicJobs=[];
    aliases.forEach(function(alias){
      publicJobs.push({
        name:'public_expiry/'+alias,
        run:function(){
          return (window.fsTenantCollection?fsTenantCollection('public_expiry'):FB_DB.collection('public_expiry')).doc(alias).delete();
        }
      });
      publicJobs.push({
        name:'public_controlled_expiry/'+alias,
        run:function(){
          return (window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry')).doc(alias).delete();
        }
      });
    });


    for(var publicIndex=0;publicIndex<publicJobs.length;publicIndex++){
      try{
        await publicJobs[publicIndex].run();
      }catch(error){
        report.optionalFailed.push({
          step:publicJobs[publicIndex].name,
          message:String(error&&error.message||error)
        });
        console.warn(
          'Optional public department cleanup failed:',
          publicJobs[publicIndex].name,
          error
        );
      }
    }
  }

  return report;
}

window.purgeOrphanDepartment=async function(id){
  if(!window.CU||CU.master!==true){
    if(typeof toast==='function'){
      toast(
        'Only Master can permanently delete orphaned department records.',
        'err'
      );
    }
    return false;
  }

  var record=requestGridOrphans().find(function(item){
    return String(item.id)===String(id);
  });

  if(!record){
    renderRequestGridOrphans();
    return true;
  }

  if(record.userCount){
    if(typeof toast==='function'){
      toast('Delete or reassign the linked user accounts first.','err');
    }
    if(typeof showPg==='function')showPg('pg-users');
    return false;
  }

  var confirmed=await uiConfirm(
    'Permanently delete orphaned department records for "'+
    (record.name||record.id)+'"?\n\n'+
    'This removes schedules, limits, medicines, expiry, shelves, alerts, '+
    'controlled custody and current accountability balances. '+
    'Historical completed requests are retained for audit.'
  );
  if(!confirmed)return false;

  var deletionReport;
  try{
    deletionReport=await floorstockPurgeDepartmentState(
      record.id,
      [record.id,record.name],
      false
    );
  }catch(error){
    console.error(error);
    if(typeof toast==='function'){
      toast(
        'Orphan deletion stopped at: '+
        String(error&&error.message||error),
        'err'
      );
    }
    return false;
  }

  var uiFailures=floorstockDeleteUiRefresh();
  if(typeof toast==='function'){
    toast(
      uiFailures.length
        ?'Orphan records were deleted. Refresh one UI panel if it still shows old data.'
        :'Orphaned department records deleted permanently ✓',
      uiFailures.length?'info':'succ'
    );
  }
  return deletionReport;
};
function renderTargets(depts){
  var host=E('request-grid-targets');
  if(!host)return;

  depts=Array.isArray(depts)&&depts.length?depts:requestGridDepartments();
  host.style.display='grid';
  host.style.visibility='visible';
  host.style.opacity='1';
  host.style.height='auto';
  host.style.minHeight='56px';
  host.style.overflow='visible';

  if(!depts.length){
    host.innerHTML='<div class="request-grid-loading">Loading departments… / جاري تحميل الأقسام…</div>';
    return;
  }

  host.innerHTML=depts.map(function(department){
    var checked=String(department.id)===String(sourceDept)?' checked':'';
    return '<label class="request-grid-target">'+
      '<input type="checkbox" class="request-grid-target-check" value="'+escH(department.id)+'"'+checked+'>'+
      '<span>'+escH(window.floorstockDepartmentName(department))+'</span>'+
    '</label>';
  }).join('');
}
function renderGrid(){var h=E('request-hour-grid');if(!h||!draft)return;var html='<div class="request-hour-grid"><div class="corner">Day / اليوم</div>';for(var hr=0;hr<24;hr++)html+='<div class="hour-head">'+String(hr).padStart(2,'0')+'</div>';for(var d=0;d<7;d++){var ranges=rowRanges(draft[d]);html+='<div class="day-label"><div>'+DAYS_EN[d]+'<br>'+DAYS_AR[d]+'<div class="request-grid-day-summary">'+(ranges.length?ranges.join(' · '):'Blocked all day / ممنوع طوال اليوم')+'</div></div><div class="day-actions"><button type="button" class="btn bg" onclick="setRequestGridDay('+d+',true)">24h</button><button type="button" class="btn bg" onclick="setRequestGridDay('+d+',false)">×</button></div></div>';for(var x=0;x<24;x++)html+='<button type="button" class="hour-cell '+(draft[d][x]?'allowed':'blocked')+'" data-day="'+d+'" data-hour="'+x+'" title="'+DAYS_EN[d]+' '+hourLabel(x)+'"></button>'}html+='</div>';h.innerHTML=html;h.querySelectorAll('.hour-cell').forEach(function(c){c.addEventListener('pointerdown',function(ev){ev.preventDefault();painting=true;var d=+this.dataset.day,hr=+this.dataset.hour;paintValue=!draft[d][hr];draft[d][hr]=paintValue;renderGrid()});c.addEventListener('pointerenter',function(){if(!painting)return;draft[+this.dataset.day][+this.dataset.hour]=paintValue;this.className='hour-cell '+(paintValue?'allowed':'blocked')})})}
document.addEventListener('pointerup',function(){painting=false});
window.setRequestGridDay=function(d,on){if(!draft)return;draft[d]=Array(24).fill(!!on);renderGrid()};
window.selectAllRequestGridTargets=function(on){
  var boxes=Array.from(document.querySelectorAll('#request-grid-targets .request-grid-target-check'));
  if(!boxes.length){
    window.renderRequestHourGridUI();
    boxes=Array.from(document.querySelectorAll('#request-grid-targets .request-grid-target-check'));
  }
  boxes.forEach(function(box){box.checked=!!on;});
};
window.loadRequestHourGrid=function(dept){
  sourceDept=String(dept||'');
  draft=gridFor(sourceDept);
  renderTargets(requestGridDepartments());
  renderGrid();
};
window.saveRequestHourGrid=async function(){
 var status=E('request-grid-save-status'),buttons=Array.from(document.querySelectorAll('.request-grid-save-btn'));
 function setBusy(on){buttons.forEach(function(b){b.disabled=!!on;b.setAttribute('aria-busy',on?'true':'false')})}
 function setStatus(msg,ok){if(!status)return;status.textContent=msg||'';status.style.color=ok===true?'var(--gnl)':(ok===false?'var(--rdl)':'var(--tx2)')}
 var ids=Array.from(document.querySelectorAll('.request-grid-target-check:checked')).map(function(x){return String(x.value)});
 if(!ids.length){setStatus('اختر قسمًا واحدًا على الأقل / Select at least one department',false);if(typeof toast==='function')toast('Select at least one department / اختر قسمًا واحدًا على الأقل','err');return false}
 if(!Array.isArray(draft)){setStatus('تعذر قراءة الجدول الحالي. أعد فتح صفحة Schedule. / Current schedule could not be read. Reopen Schedule.',false);return false}
 var depts=requestGridDepartments(),selected=ids.map(function(id){return depts.find(function(d){return String(d.id)===String(id)})||{id:id,name:id}}),selectedAliases={};
 selected.forEach(function(d){deptAliases(d.id).forEach(function(a){selectedAliases[String(a).toLowerCase()]=1})});
 setBusy(true);setStatus('جارٍ حفظ وتطبيق الجدول على '+ids.length+' قسم… / Saving and applying to '+ids.length+' department(s)…');
 try{
  var wins=typeof window.getReqWindows==='function'?(getReqWindows()||[]):[];
  var next=wins.filter(function(w){
   if(!w)return false;
   if(w.type==='weekly_grid_v2'&&selectedAliases[String(w.dept||'').toLowerCase()])return false;
   if(w.source==='weekly_grid_v2'&&selectedAliases[String(w.dept||'').toLowerCase()])return false;
   return true
  }).map(function(w){
   // Migration guard: convert any unsaved legacy nested grid to the Firestore-safe flat representation.
   if(w&&Array.isArray(w.grid)){var migrated=Object.assign({},w,{gridFlat:flattenGrid(w.grid),gridEncoding:'flat-7x24'});delete migrated.grid;return migrated}
   return w
  });
  selected.forEach(function(d){next.push({id:'weekly_grid_v2_'+String(d.id),type:'weekly_grid_v2',source:'weekly_grid_v2',label:'Weekly 24-hour grid / جدول أسبوعي',dept:d.id,deptName:window.floorstockDepartmentName(d),active:false,days:[],from:'00:00',to:'00:00',gridFlat:flattenGrid(draft),gridEncoding:'flat-7x24',updatedAt:new Date().toISOString()})});
  if(!window.S||typeof S.s!=='function')throw new Error('Storage service is not ready');
  await setReqWindows(next);
  // Remove stale cache entries from the former experimental key so they cannot override the saved schedule.
  try{var old=getMaps();ids.forEach(function(id){deptAliases(id).forEach(function(a){delete old[a]})});if(window.S&&S.cache)S.cache[GRID_KEY]=old}catch(ignore){}
  setStatus('تم تطبيق الجدول بنجاح على '+ids.length+' قسم / Schedule successfully applied to '+ids.length+' department(s)',true);
  if(typeof toast==='function')toast('تم تطبيق أوقات قبول الطلبات على '+ids.length+' قسم / Weekly request schedule applied to '+ids.length+' department(s) ✓','succ');
  window.renderRequestHourGridUI();
  if(window.CU&&String(CU.role)==='department')applyRequestLock();
  return true
 }catch(err){
  console.error('Request schedule save failed',err);
  setStatus('فشل حفظ الجدول: '+String(err&&err.message||err)+' / Schedule save failed',false);
  if(typeof toast==='function')toast('Schedule save failed — '+String(err&&err.message||err),'err');
  return false
 }finally{setBusy(false)}
};
window.renderRequestHourGridUI=function(){
  var source=E('request-grid-source');
  var grid=E('request-hour-grid');
  var targets=E('request-grid-targets');
  if(!source||!grid||!targets)return false;

  var departments=requestGridDepartments();

  if(!departments.length){
    source.innerHTML='<option value="">Loading departments… / جاري تحميل الأقسام…</option>';
    renderTargets([]);
    renderRequestGridOrphans();
    requestGridRetryCount++;

    if(requestGridRetryTimer)clearTimeout(requestGridRetryTimer);
    if(requestGridRetryCount<=20){
      requestGridRetryTimer=setTimeout(function(){
        window.renderRequestHourGridUI();
      },500);
    }else{
      targets.innerHTML='<div class="request-grid-empty">No department records were found. Reload the application data and reopen Schedule.<br>لم يتم العثور على سجلات الأقسام. أعد تحميل بيانات النظام ثم افتح صفحة الجدول.</div>';
    }
    return false;
  }

  requestGridRetryCount=0;
  if(requestGridRetryTimer){
    clearTimeout(requestGridRetryTimer);
    requestGridRetryTimer=null;
  }

  var keep=sourceDept||source.value||(departments[0]&&departments[0].id)||'';
  source.innerHTML=departments.map(function(department){
    return '<option value="'+escH(department.id)+'">'+escH(window.floorstockDepartmentName(department))+'</option>';
  }).join('');

  if(departments.some(function(department){return String(department.id)===String(keep)})){
    source.value=keep;
  }else{
    source.value=(departments[0]&&departments[0].id)||'';
  }

  sourceDept=String(source.value||'');
  draft=gridFor(sourceDept);
  renderTargets(departments);
  renderRequestGridOrphans();
  renderGrid();
  return true;
};

function applyRequestLock(){
 if(!window.CU||String(CU.role)!=='department')return;
 var pg=E('pg-newreq'),dept=CU.deptId||CU.deptName;
 if(!pg)return;
 var check=window.isRequestAllowed(dept),txt=allowedText(dept,check),body=E('rfbody');
 pg.classList.toggle('schedule-locked',!check.allowed);
 if(body){body.style.removeProperty('display');body.style.removeProperty('visibility');body.style.removeProperty('opacity')}
 var card=body&&body.closest('.card');if(card){card.style.removeProperty('display');card.style.removeProperty('visibility');card.style.removeProperty('opacity')}
 var info=E('req-sched-info');if(!info&&body){info=document.createElement('div');info.id='req-sched-info';body.parentNode.insertBefore(info,body)}
 if(info){
  if(!check.allowed)info.innerHTML='<div class="schedule-lock-banner"><div class="title">🚫 الطلب غير متاح الآن / Ordering is currently unavailable</div><div class="times"><b>أقرب وقت متاح / Next available time:</b> '+escH(txt.next)+'</div><div class="schedule-week-list"><div class="schedule-week-title">أوقات الطلب المسموحة خلال الأسبوع / Weekly allowed request times</div>'+weeklyRowsHtml(txt.week)+'</div><div class="fhint" style="margin-top:7px">يمكنك مراجعة قائمة الأدوية الآن، لكن إدخال الكميات وإرسال الطلب سيتاحان فقط خلال الأيام والساعات الموضحة أعلاه.<br>You may review the medicine list now; quantities and submission are enabled only during the days and hours listed above.</div></div>';
  else info.innerHTML='<div class="schedule-open-banner">🟢 <b>الطلب متاح الآن / Ordering is available now.</b> &nbsp; حتى / Until <b>'+escH(check.window&&check.window.to||'')+'</b></div>'
 }
 pg.querySelectorAll('.rqi').forEach(function(i){if(!check.allowed){if(!i.disabled)i.dataset.scheduleLocked='1';i.disabled=true}else if(i.dataset.scheduleLocked==='1'){delete i.dataset.scheduleLocked;if((+i.dataset.max||0)>0)i.disabled=false}});
 var submit=pg.querySelector('button[data-asdh-binding="b047"]');if(submit){submit.disabled=!check.allowed;submit.setAttribute('aria-disabled',check.allowed?'false':'true');submit.title=check.allowed?'':('Next allowed: '+txt.next)}
}
window.refreshRequestScheduleMessage=applyRequestLock;


/* Bulk classification: one selection can update every matching medicine name across all departments. */
function classIdentity(v){var stop={tablet:1,tablets:1,tab:1,tabs:1,capsule:1,capsules:1,cap:1,caps:1,injection:1,injections:1,inj:1,ampoule:1,ampoules:1,amp:1,vial:1,vials:1,solution:1,solutions:1,soln:1,suspension:1,syrup:1,cream:1,ointment:1,drops:1,drop:1,iv:1,im:1,oral:1,محلول:1,محاليل:1,حقن:1,امبول:1,امبولات:1,فيال:1,فيالات:1,قرص:1,اقراص:1,كبسول:1,كبسولات:1};return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/(\d)(mg|mcg|gm|g|ml|iu|mmol|meq)\b/gi,'$1 $2').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim().split(/\s+/).filter(function(x){return x&&!stop[x]}).join(' ')}
window.v13ApplyBulkClassification=async function(){var modal=E('v13q-bulk-class-modal'),op=(E('v13q-class-op')||{}).value||'replace',chosen=modal?Array.from(modal.querySelectorAll('input[type=checkbox][value]:checked')).map(function(x){return x.value}):[],expand=!!(E('v16-class-all-similar')&&E('v16-class-all-similar').checked),selected=Array.from(document.querySelectorAll('#all-inv-body .v13q-row-check:checked')).map(function(x){return{dept:String(x.dataset.dept),med:String(x.dataset.med),name:String(x.dataset.name||'')}});if(!selected.length)return typeof toast==='function'?toast('Select one or more medicines first.','err'):null;if(!chosen.length&&op!=='replace')return toast('Select at least one classification.','err');var exact=new Set(selected.map(function(x){return x.dept+'::'+x.med})),families=new Set(selected.map(function(x){return classIdentity(x.name)}).filter(Boolean)),count=0,allFlags=['high_alert','lasa','refrigerated','hazard'];for(var d of (typeof gd==='function'?(gd()||[]):[])){var changed=false,meds=(getMeds(d.id)||[]).map(function(m){var hit=exact.has(String(d.id)+'::'+String(m.id))||(expand&&families.has(classIdentity(m.name)));if(!hit)return m;var n=Object.assign({},m);if(op==='replace')allFlags.forEach(function(k){n[k]=chosen.indexOf(k)>-1});else if(op==='add')chosen.forEach(function(k){n[k]=true});else chosen.forEach(function(k){n[k]=false});changed=true;count++;return n});if(changed)await setMeds(d.id,meds)}if(typeof CM==='function')CM('v13q-bulk-class-modal');if(typeof window.closeAllDepartmentsInventory==='function')window.closeAllDepartmentsInventory();if(typeof toast==='function')toast('Classification updated for '+count+' matching medicine record(s) ✓','succ');if(typeof window.openSimilarMedicinesAllDepartments==='function')window.openSimilarMedicinesAllDepartments()};
window.floorstockDeleteUiRefresh=floorstockDeleteUiRefresh;
window.floorstockPurgeDepartmentState=floorstockPurgeDepartmentState;

function boot(){if(E('pg-schedule'))window.renderRequestHourGridUI();if(window.CU&&String(CU.role)==='department')applyRequestLock()}
boot();
})();

export {};
