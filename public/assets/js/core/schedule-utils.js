/* Pure schedule formatting and time conversion helpers. */
function fmt12(t){if(!t)return '';var p=t.split(':'),h=+p[0],m=p[1]||'00',ampm=h>=12?'PM':'AM';h=h%12||12;return h+':'+m+' '+ampm}
function dayBits(days){var names=globalThis.DAY_NAMES||['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return days.map(function(d){return names[d]}).join(', ')}
function timeToMins(t){var p=(t||'00:00').split(':');return +p[0]*60+(+p[1]||0)}
Object.assign(globalThis,{fmt12,dayBits,timeToMins})
export {fmt12,dayBits,timeToMins}
