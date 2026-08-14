/* Pure calculation of the next applicable dispense slot. */
function getNextDispSlot(deptId){
  var now=new Date(), slots=(typeof globalThis.getDispSlots==='function'?globalThis.getDispSlots():[]).filter(function(s){return s.dept==='all'||s.dept===deptId});
  if(!slots.length)return null;
  var nowMins=now.getHours()*60+now.getMinutes(), dow=now.getDay(), best=null,bestDiff=Infinity, names=globalThis.DAY_NAMES||[];
  for(var d=0;d<7;d++){var day=(dow+d)%7;slots.forEach(function(s){if((s.days||[]).indexOf(day)<0)return;var from=s.from||s.time,sm=globalThis.timeToMins(from),diff=d*1440+(sm-nowMins),offset=d;if(diff<=0&&d===0){diff+=1440;offset=1}if(diff>0&&diff<bestDiff){var scheduled=new Date(now);scheduled.setDate(now.getDate()+offset);scheduled.setHours(Math.floor(sm/60),sm%60,0,0);var timeDisplay=s.to?globalThis.fmt12(from)+' – '+globalThis.fmt12(s.to):globalThis.fmt12(from);bestDiff=diff;best={slot:s,day:names[day],time:timeDisplay,minsAway:diff,scheduledAt:scheduled.toISOString()}}})}
  return best;
}
globalThis.getNextDispSlot=getNextDispSlot;
export {getNextDispSlot};
