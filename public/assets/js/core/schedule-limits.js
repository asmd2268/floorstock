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
function normalizeMonthlyLimit(raw){
  var text=String(raw==null?'':raw).trim();
  if(!text)return {value:'',valid:true};
  var parsed=Math.floor(Number(text));
  return {value:isFinite(parsed)&&parsed>=1?String(parsed):'',valid:isFinite(parsed)&&parsed>=1};
}
Object.assign(globalThis,{getMonthlyReqCount,getMonthlyLimit,normalizeMonthlyLimit});
export {getMonthlyReqCount,getMonthlyLimit,normalizeMonthlyLimit};
