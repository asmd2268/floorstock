/* Central storage adapter for request windows, dispense slots, and limits. */
function getReqWindows(){return globalThis.S.g('req_windows')||[]}
function setReqWindows(a){return globalThis.S.s('req_windows',a)}
function getDispSlots(){return globalThis.S.g('disp_slots')||[]}
function setDispSlots(a){return globalThis.S.s('disp_slots',a)}
function getMonthlyLimits(){return globalThis.S.g('monthly_limits')||{}}
function setMonthlyLimits(o){return globalThis.S.s('monthly_limits',o)}
Object.assign(globalThis,{getReqWindows,setReqWindows,getDispSlots,setDispSlots,getMonthlyLimits,setMonthlyLimits})
export {getReqWindows,setReqWindows,getDispSlots,setDispSlots,getMonthlyLimits,setMonthlyLimits}
