/* Monthly request usage helpers. Reads only through the existing state API. */
function getMonthlyReqCount(deptId){
  var now=new Date(), start=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  var requests=typeof globalThis.gr==='function'?globalThis.gr():[];
  return requests.filter(function(r){return r.deptId===deptId&&r.created>=start}).length;
}
function getMonthlyLimit(deptId){
  var limits=typeof globalThis.getMonthlyLimits==='function'?globalThis.getMonthlyLimits():{};
  return limits[deptId]||null;
}
Object.assign(globalThis,{getMonthlyReqCount,getMonthlyLimit});
export {getMonthlyReqCount,getMonthlyLimit};
