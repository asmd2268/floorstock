/* Pure calculation of the next applicable dispense slot. */
function getNextDispSlot(deptId){
  var now=new Date(), slots=(typeof globalThis.getDispSlots==='function'?globalThis.getDispSlots():[]).filter(function(s){return s.dept==='all'||s.dept===deptId});
  if(!slots.length)return null;
  var nowMins=now.getHours()*60+now.getMinutes(), dow=now.getDay(), best=null,bestDiff=Infinity, names=globalThis.DAY_NAMES||[];
  // d runs 0..7 (not 0..6) so a single-weekday schedule whose slot already
  // passed today correctly wraps to the SAME weekday next week (d=7) instead
  // of being force-bumped +1 day, which previously produced a "Sunday" label
  // paired with a Monday date whenever Sunday was the only scheduled day and
  // its time had already passed for today.
  //
  // A slot with both from+to is a WINDOW, not an instant. If "now" falls
  // inside today's window (start already passed but end hasn't), that slot
  // is currently active/open and must win over any later occurrence —
  // otherwise a department mid-window (e.g. Sunday 10:00 inside an
  // 08:00-12:00 Sunday slot) was told the next dispense was a week away
  // instead of being told ordering is open right now.
  for(var d=0;d<8;d++){var day=(dow+d)%7;slots.forEach(function(s){if((s.days||[]).indexOf(day)<0)return;var from=s.from||s.time,sm=globalThis.timeToMins(from),toMins=s.to?globalThis.timeToMins(s.to):null,diff=d*1440+(sm-nowMins),active=d===0&&toMins!=null&&nowMins>=sm&&nowMins<toMins;if(diff<=0&&!active)return;if(diff<bestDiff){var scheduled=new Date(now);scheduled.setDate(now.getDate()+d);scheduled.setHours(Math.floor(sm/60),sm%60,0,0);var timeDisplay=s.to?globalThis.fmt12(from)+' – '+globalThis.fmt12(s.to):globalThis.fmt12(from);bestDiff=diff;best={slot:s,day:names[day],time:timeDisplay,minsAway:diff,scheduledAt:scheduled.toISOString(),active:active}}})}
  return best;
}
globalThis.getNextDispSlot=getNextDispSlot;
export {getNextDispSlot};
