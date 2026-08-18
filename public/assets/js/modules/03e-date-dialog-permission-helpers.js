import { publishLegacy } from '../core/legacy-registry.js';
import { normalizeRole, hasCapability, canAccessDepartment } from '../core/role-capabilities.js';

// ── DATE/DIALOG/PERMISSION HELPERS ──────────────────────────────────────
// Split out of 03-core-application-firebase-state-auth.js (Phase 3 module
// split). Uses the same role-capabilities import module 03 itself uses.
// Everything else referenced here that isn't declared in this file (CU,
// window.MASTER_EFFECTIVE/MASTER_ACTUAL, window.gd, globalThis.formatBilingualText)
// is already published to globalThis by its owning module.

// Modern in-app dialogs — replaces all browser prompt/confirm/alert windows.
function uiDialog(opts){
  opts=opts||{};
  var isDanger=!!opts.danger,isPrompt=opts.type==='prompt',isConfirm=opts.type==='confirm';
  var icon=opts.icon||(isDanger?'🗑️':isPrompt?'✏️':isConfirm?'❓':'ℹ️');
  return new Promise(function(resolve){
    var bg=document.createElement('div');bg.className='modal-bg on';bg.style.zIndex='3000';
    var box=document.createElement('div');box.className='modal';
    box.style.cssText='width:'+( opts.width||'480px')+';max-width:95vw;padding:0;overflow:hidden;border-radius:18px';
    /* Header */
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:18px 20px 0;gap:10px';
    var htitle=document.createElement('div');
    htitle.style.cssText='display:flex;align-items:center;gap:10px';
    var ico=document.createElement('span');
    ico.style.cssText='font-size:20px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:'+(isDanger?'rgba(218,54,51,.12)':'rgba(31,111,235,.1)');
    ico.textContent=icon;
    var titletxt=document.createElement('div');titletxt.className='mt';titletxt.textContent=opts.title||'ASDHealth';
    htitle.appendChild(ico);htitle.appendChild(titletxt);
    var close=document.createElement('button');close.className='xbtn';close.type='button';close.innerHTML='&times;';
    hdr.appendChild(htitle);hdr.appendChild(close);box.appendChild(hdr);
    /* Divider */
    var hr=document.createElement('div');hr.style.cssText='height:1px;background:var(--bd);margin:14px 0 0';box.appendChild(hr);
    /* Body */
    var body=document.createElement('div');body.style.cssText='padding:18px 20px';
    if(opts.message){
      var msg=document.createElement('div');
      msg.style.cssText='font-size:13.5px;line-height:1.75;white-space:pre-wrap;unicode-bidi:plaintext;margin-bottom:'+(isPrompt?'14px':'0')+'px;color:var(--tx2)';
      var dialogMessage=opts.message;if(typeof globalThis.formatBilingualText==='function')dialogMessage=globalThis.formatBilingualText(dialogMessage);
      msg.textContent=dialogMessage;body.appendChild(msg);
    }
    var input=null;
    if(isPrompt){
      input=opts.multiline?document.createElement('textarea'):document.createElement('input');
      if(!opts.multiline)input.type=opts.inputType||'text';
      input.value=opts.value==null?'':String(opts.value);
      input.placeholder=opts.placeholder||'';
      input.style.cssText='margin-bottom:0;font-size:14px';
      if(opts.multiline)input.rows=7;
      body.appendChild(input);
    }
    box.appendChild(body);
    /* Footer */
    var footer=document.createElement('div');
    footer.style.cssText='display:flex;gap:8px;justify-content:flex-end;padding:12px 20px 18px;border-top:1px solid var(--bd);background:var(--s2)';
    var cancel=document.createElement('button');cancel.className='btn bg';cancel.type='button';cancel.textContent=opts.cancelText||'Cancel';
    var ok=document.createElement('button');ok.className='btn '+(isDanger?'bd2c':'bp');ok.type='button';
    ok.textContent=opts.okText||(isPrompt?'OK':'Confirm');
    footer.appendChild(cancel);footer.appendChild(ok);box.appendChild(footer);
    bg.appendChild(box);document.body.appendChild(bg);
    function done(v){bg.style.opacity='0';bg.style.transition='opacity .15s';setTimeout(function(){bg.remove();resolve(v)},150)}
    close.onclick=function(){done(isConfirm?false:null)};cancel.onclick=close.onclick;
    // A stray tap on the backdrop resolves the dialog the same as tapping the
    // header's close button — for a plain confirm that's harmless (isConfirm
    // resolves false, same as Cancel), but destructive callers (e.g. the
    // session-timeout warning, where false triggers an immediate forced
    // sign-out — see module 59) opt out via preventBackdropClose so an
    // accidental tap outside the box on a small mobile screen can never be
    // read as "sign out".
    if(!opts.preventBackdropClose)bg.onclick=function(e){if(e.target===bg)close.onclick()};
    ok.onclick=function(){done(isConfirm?true:(input?input.value:true))};
    box.onkeydown=function(e){if(e.key==='Escape')close.onclick();if(e.key==='Enter'&&!opts.multiline&&e.target===input){e.preventDefault();ok.click()}};
    setTimeout(function(){(input||ok).focus();if(input&&input.select)input.select()},30);
  });
}
function uiPrompt(message,value,options){options=options||{};return uiDialog(Object.assign({type:'prompt',title:options.title||'Enter information',message:message||'',value:value==null?'':value},options))}
function uiConfirm(message,options){options=options||{};return uiDialog(Object.assign({type:'confirm',title:options.title||'Please confirm',message:message||'',danger:!!options.danger,okText:options.okText||'Confirm'},options))}

function toast(msg,type){
  var t=document.getElementById('toast'),value=String(msg==null?'':msg);
  var toastRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
  if(['pharmacy','pharmacy_manager','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(toastRole)>=0&&/(medications?\s+(expired|expiring)|expired\s+medications|expiring\s+soon)/i.test(value))return;
  if(typeof globalThis.formatBilingualText==='function')value=globalThis.formatBilingualText(value);
  t.textContent=value;t.style.whiteSpace='pre-line';t.style.unicodeBidi='plaintext';t.className='on t'+type;
  clearTimeout(window._tt);
  window._tt=setTimeout(function(){t.className=''},3200);
}
function bdg(m){
  if(!m)return '';
  var b='';
  if(m.high_alert)b+='<span class="badge brd">🔴 High Alert</span> ';
  if(m.hazard)b+='<span class="badge byl">⚠ Hazard</span> ';
  if(m.lasa)b+='<span class="badge bpu">🔵 LASA</span> ';
  if(m.refrigerated)b+='<span class="badge bfr">❄ Refrigerated</span> ';
  return b||'<span class="badge bgr">Std</span>';
}
function rowCls(m){
  if(!m)return '';
  var c=[];
  if(m.high_alert)c.push('rha');
  if(m.hazard)c.push('rhz');
  if(m.lasa)c.push('rls');
  if(m.refrigerated)c.push('rrf');
  return c.join(' ');
}
function OM(id){document.getElementById(id).classList.add('on')}
function el(id){return document.getElementById(id)}
globalThis.esc = window.fsEsc;

/* R6.38 canonical shared helpers — one source of truth for permissions, names, audit actors and medicine matching. */
window.fsEsc=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
window.fsPrepareImageDataUrl=async function(file,options){
  options=options||{};
  var maxInputBytes=Number(options.maxInputBytes)||5*1024*1024;
  var maxOutputBytes=Number(options.maxOutputBytes)||500*1024;
  var maxDimension=Number(options.maxDimension)||1000;
  if(!file)throw new Error('Choose an image first.');
  if(['image/png','image/jpeg'].indexOf(String(file.type||'').toLowerCase())<0)throw new Error('Only PNG and JPEG images are allowed.');
  if(Number(file.size||0)>maxInputBytes)throw new Error('The selected image is too large. Maximum source size is 5 MB.');
  function read(){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result||''))};r.onerror=function(){reject(new Error('The image could not be read.'))};r.readAsDataURL(file)})}
  function load(src){return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img)};img.onerror=function(){reject(new Error('The selected file is not a readable image.'))};img.src=src})}
  function bytes(data){var comma=data.indexOf(',');return Math.ceil(Math.max(0,data.length-comma-1)*3/4)}
  var source=await read(),image=await load(source),scale=Math.min(1,maxDimension/Math.max(image.naturalWidth||1,image.naturalHeight||1));
  var width=Math.max(1,Math.round((image.naturalWidth||1)*scale)),height=Math.max(1,Math.round((image.naturalHeight||1)*scale));
  var mime=String(file.type).toLowerCase(),quality=.9;
  for(var attempt=0;attempt<8;attempt++){
    var canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    var context=canvas.getContext('2d',{alpha:mime==='image/png'});if(!context)throw new Error('Image processing is not supported by this browser.');
    context.drawImage(image,0,0,width,height);
    var output=canvas.toDataURL(mime,mime==='image/jpeg'?quality:undefined);
    if(bytes(output)<=maxOutputBytes)return output;
    if(mime==='image/jpeg')quality=Math.max(.55,quality-.08);
    width=Math.max(1,Math.round(width*.82));height=Math.max(1,Math.round(height*.82));
  }
  throw new Error('The processed logo is still larger than 500 KB. Choose a smaller image.');
};
window.fsEffectiveUser=function(){return (window.MASTER_EFFECTIVE&&Object.assign({},window.CU||{},window.MASTER_EFFECTIVE))||(window.CU||{})};
window.fsEffectiveRole=function(){var u=window.fsEffectiveUser();return normalizeRole(u.role)};
window.fsActualUser=function(){return (window.MASTER_ACTUAL||window.CU||{})};
window.fsActor=function(){var u=window.fsActualUser(),name=(typeof window.actualActorName==='function'?window.actualActorName():(u.name||u.fullName||u.displayName||u.username||u.email||'Unknown'));return {name:name,user:u.email||u.username||u.id||u.uid||'Unknown',id:u.id||u.uid||''}};
window.fsHasCapability=function(capability){return hasCapability(window.fsEffectiveUser(),capability)};
window.fsCanAccessDepartment=function(departmentId){return canAccessDepartment(window.fsEffectiveUser(),departmentId)};
window.fsCanManage=function(){return window.fsHasCapability('inventory.manage')};
window.fsCanManageCrashCart=function(){return window.fsHasCapability('crashCart.operate')};
window.fsDeptName=function(id){try{var list=typeof window.gd==='function'?(window.gd()||[]):[],d=list.find(function(x){return String(x.id)===String(id)});return d?(d.name||d.nameEn||d.nameAr||String(id||'—')):String(id||'—')}catch(e){return String(id||'—')}};
window.fsDaysUntil=function(value){if(!value)return null;var raw=String(value).slice(0,10),parts=raw.split('-'),d=parts.length===3?new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])):new Date(value);if(isNaN(d.getTime()))return null;var n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.floor((d.getTime()-today.getTime())/86400000)};
window.fsNowISO=function(){return new Date().toISOString()};
window.fsMedNorm=function(value){return String(value==null?'':value).toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g,'').replace(/أ|إ|آ/g,'ا').replace(/&/g,' and ').replace(/(\d)\s*(mg|mcg|gm|g|ml|iu|mmol|meq|%)/gi,'$1 $2').replace(/[^a-z0-9؀-ۿ%]+/g,' ').replace(/\s+/g,' ').trim()};


publishLegacy("03e-date-dialog-permission-helpers.js", {
  uiDialog,
  uiPrompt,
  uiConfirm,
  toast,
  bdg,
  rowCls,
  OM,
  el,
});

export {};
