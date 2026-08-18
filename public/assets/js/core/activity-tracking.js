/* Per-user daily activity instrumentation: time spent actively engaged with
   the app, and which buttons/icons get tapped most. This is new
   instrumentation — nothing like it existed before (confirmed by a full
   codebase search: no persisted lastLogin/lastSeen, no click/feature-usage
   tracking anywhere). Entry/edit COUNTS are deliberately NOT duplicated
   here — they're already covered by the existing audit_log written by
   auditAction() across ~35 action types; the staff-activity report reads
   that directly instead of re-logging every write a second time.

   Design constraints:
   - Minimize writes: counters live in memory and flush to Firestore only
     periodically (every 2 minutes) or when the tab is hidden/closed, never
     per-click or per-minute.
   - "Active minute" reuses the same activity signal as the idle-timeout
     module (pointerdown/keydown/touchstart/scroll/input/focus) rather than
     just "tab was open" — a background tab must not count as active time.
   - One row per user per calendar day, keyed 'uid_YYYY-MM-DD', in a single
     array under user_activity_daily_v1. Growth is bounded by users×days
     (unlike a per-event log), so this stays small for a long time, but if
     the department roster is large this should eventually get the same
     archive-before-it-grows-too-big treatment as controlled_moves —
     revisit if S.g('user_activity_daily_v1') ever approaches a few
     thousand rows. */

function todayKey(){return new Date().toISOString().slice(0,10)}
function rowId(uid,date){return uid+'_'+date}

var _lastInteractionAt=0;
var _pendingMinutes=0;
var _iconCounts={};
var _lastFlushAt=0;
var _flushTimer=null;

function iconKeyFor(el){
  if(!el||el===document||el===document.body)return null;
  var button=el.closest?el.closest('button,[role="button"],a,.btn,.tab,.topnav a,.ctl-tab'):null;
  if(!button)return null;
  if(button.id)return '#'+button.id;
  var binding=button.getAttribute&&button.getAttribute('data-asdh-binding');
  if(binding)return 'bind:'+binding;
  var text=(button.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
  if(text)return 'txt:'+text;
  var cls=button.className&&String(button.className).split(' ')[0];
  return cls?'cls:'+cls:null;
}

function onInteraction(event){
  _lastInteractionAt=Date.now();
  if(event&&event.type==='pointerdown'){
    var key=iconKeyFor(event.target);
    if(key)_iconCounts[key]=(_iconCounts[key]||0)+1;
  }
}

function accrueMinutes(){
  // Only counts a minute as "active" if there was real interaction within
  // the last 2 minutes — matches the idle-timeout module's own activity
  // window, so a tab left open but untouched doesn't inflate time spent.
  if(Date.now()-_lastInteractionAt<=2*60*1000)_pendingMinutes+=1;
}

function signedIn(){return !!(window.FB_AUTH&&FB_AUTH.currentUser)&&!!window.CU}

async function flush(force){
  if(!signedIn())return;
  if(!force&&_pendingMinutes===0&&Object.keys(_iconCounts).length===0)return;
  var minutes=_pendingMinutes,icons=_iconCounts;
  _pendingMinutes=0;_iconCounts={};
  var user=window.CU,uid=String(user.id||user.uid||'');
  if(!uid)return;
  try{
    var all=(window.S&&window.S.g?window.S.g('user_activity_daily_v1')||[]:[]).slice();
    var date=todayKey(),id=rowId(uid,date);
    var row=all.find(function(r){return r.id===id});
    if(!row){
      row={id:id,userId:uid,userName:user.username||user.email||'—',deptId:user.deptId||'',deptName:user.deptName||'',role:user.role||'',date:date,activeMinutes:0,iconCounts:{}};
      all.push(row);
    }
    row.userName=user.username||user.email||row.userName;
    row.deptId=user.deptId||row.deptId;
    row.deptName=user.deptName||row.deptName;
    row.activeMinutes=(row.activeMinutes||0)+minutes;
    row.iconCounts=row.iconCounts||{};
    Object.keys(icons).forEach(function(key){row.iconCounts[key]=(row.iconCounts[key]||0)+icons[key]});
    await window.S.s('user_activity_daily_v1',all);
    _lastFlushAt=Date.now();
  }catch(error){
    // Best-effort only — never surface this to the user or block anything.
    console.warn('Activity tracking flush failed (non-critical).',error);
    _pendingMinutes+=minutes;
    Object.keys(icons).forEach(function(key){_iconCounts[key]=(_iconCounts[key]||0)+icons[key]});
  }
}

function scheduleTicks(){
  if(_flushTimer)return;
  setInterval(function(){accrueMinutes()},60*1000);
  _flushTimer=setInterval(function(){flush(false)},2*60*1000);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')flush(true);
  });
  window.addEventListener('pagehide',function(){flush(true)});
}

['pointerdown','keydown','touchstart','scroll','input','focus'].forEach(function(name){
  document.addEventListener(name,onInteraction,{capture:true,passive:true});
});
scheduleTicks();

export {};
