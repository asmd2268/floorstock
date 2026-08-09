/* Presentation-only schedule cards; actions remain delegated by the legacy module. */
function renderRequestWindowCard(w,i){
  var dept=globalThis.scheduleDepartmentName(w.dept);
  return '<div class="win-card'+(w.active?'':' inactive')+'"><div><div style="font-weight:600">'+w.label+'</div><div class="win-days">'+dept+' &nbsp;|&nbsp; '+globalThis.dayBits(w.days||[])+'</div></div><div class="win-time">'+globalThis.fmt12(w.from)+' &ndash; '+globalThis.fmt12(w.to)+'</div><div class="fl g8 ic"><button class="btn bg bxs" data-i="'+i+'" onclick="editReqWindow(+this.dataset.i)">✏</button><button class="btn '+(w.active?'bg':'bp')+' bxs" data-i="'+i+'" onclick="toggleWindow(+this.dataset.i)">'+(w.active?'Pause':'Enable')+'</button><button class="btn bd2c bxs" data-i="'+i+'" onclick="delWindow(+this.dataset.i)">✕</button></div></div>';
}
function renderDispenseSlotCard(s,i){
  var dept=globalThis.scheduleDepartmentName(s.dept), notes=s.notes?' &nbsp;|&nbsp; <i>'+s.notes+'</i>':'';
  return '<div class="win-card"><div><div style="font-weight:600">'+s.label+'</div><div class="win-days">'+dept+' &nbsp;|&nbsp; '+globalThis.dayBits(s.days||[])+notes+'</div></div><span class="slot-badge">⏰ '+globalThis.fmt12(s.time)+'</span><div class="fl g8 ic"><button class="btn bg bxs" data-i="'+i+'" onclick="editDispSlot(+this.dataset.i)">✏</button><button class="btn bd2c bxs" data-i="'+i+'" onclick="delSlot(+this.dataset.i)">✕</button></div></div>';
}
Object.assign(globalThis,{renderRequestWindowCard,renderDispenseSlotCard});
export {renderRequestWindowCard,renderDispenseSlotCard};
