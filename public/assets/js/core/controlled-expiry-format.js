/* How a controlled batch is dated, counted and written down.

   These are the shared facts behind both controlled-custody surfaces: the
   department's read-only panel and the printed A4 custody sheet. They were
   defined in the middle of modules/51 between the two, which is why neither
   could be moved out first.

   Everything here is pure — a value in, a string or a number out — so the rules
   that had never been checked anywhere (how a quantity is spread across batches,
   what counts as "near expiry", what a day boundary is) are now testable.

   Dates are compared at UTC midnight on purpose: an expiry is a calendar day,
   not an instant, and comparing instants made a batch expiring today read as
   expired or not depending on the hour the page was opened. */

import { fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText, fsNum } from './text-normalize.js?v=aa16ae9ac0';

export function fsR5DMY(v){
  if(!v)return '—';
  try{if(typeof globalThis.ctlFmtDMY==='function')return globalThis.ctlFmtDMY(v)}catch(e){}
  var d=new Date(v);if(isNaN(d))return String(v);
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}

export function fsR12DateOnly(value){
  if(!value)return null;
  if(value instanceof Date){
    if(isNaN(value.getTime()))return null;
    return Date.UTC(value.getFullYear(),value.getMonth(),value.getDate());
  }

  var text=String(value).trim();
  var match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(match)return Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));

  var date=new Date(value);
  if(isNaN(date.getTime()))return null;
  return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
}

export function fsR12PrintDate(){
  var now=new Date();
  return {
    date:now,
    dayUtc:Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),
    text:String(now.getDate()).padStart(2,'0')+'/'+
      String(now.getMonth()+1).padStart(2,'0')+'/'+
      now.getFullYear()
  };
}

export function fsR12ExpiryDays(value,printDayUtc){
  var expiryDay=fsR12DateOnly(value);
  if(expiryDay===null)return null;
  return Math.round((expiryDay-printDayUtc)/86400000);
}

/* Already-expired batches are deliberately not "near expiry": they are a
   different problem with a different colour and a different action. */
export function fsR12HasNearExpiry(batches,days,printDayUtc){
  return (Array.isArray(batches)?batches:[]).some(function(batch){
    var remaining=fsR12ExpiryDays(batch&&batch.expiry,printDayUtc);
    return remaining!==null&&remaining>=0&&remaining<=days;
  });
}

/* A batch is one (lot, quantity, expiry) fact, but it used to be split across two
   columns that together needed a third of a 1180px-wide table, so the expiry
   column sat off the right edge behind a horizontal scrollbar and a department
   reading the list saw only the quantity chip - and with no lot recorded, that
   bare number sat under a "Batch No." heading. Rendering the three parts on one
   line per batch keeps them together and lets the table fit without scrolling. */
export function fsR12BatchSummaryHtml(batches){
  if(!Array.isArray(batches)||!batches.length)return '—';
  return batches.map(function(batch){
    var lot=fsText(batch&&batch.lot,'');
    var qty=batch&&batch.qty!==''&&batch.qty!=null?fsNum(batch.qty):'';
    var expiry=fsR5DMY(batch&&batch.expiry);
    var parts='';
    if(lot)parts+='<b>'+fsEsc(lot)+'</b> ';
    if(qty!=='')parts+='<span class="chip">'+fsEsc(qty)+'</span> ';
    parts+='<span class="ctl-batch-expiry">'+fsEsc(expiry||'—')+'</span>';
    return '<div class="ctl-batch-line">'+parts+'</div>';
  }).join('');
}

/* The printed line for a row's batches.

   The stored per-batch quantities cannot be trusted on their own: older records
   carry the total on the row and leave every batch at zero. `actualTotal` is the
   counted truth, so it wins — spread over the batches when they say nothing, and
   scaled down when they claim more than was actually counted. A printed custody
   sheet may never show more than what is in the cupboard. */
export function fsR5BatchText(batches,html,actualTotal){
  if(!Array.isArray(batches)||!batches.length)return '—';
  // Resolve qty per batch; batch.qty may be 0/missing while actualTotal is correct.
  var batchQtys=batches.map(function(b){return b&&b.qty!=null&&b.qty!==''?fsNum(b.qty):0});
  var batchSum=batchQtys.reduce(function(a,b){return a+b},0);
  var total=actualTotal!=null?fsNum(actualTotal):null;
  // If all batch qtys are zero but we have an actual total, distribute across batches.
  // Single batch: assign the full actual total.
  // Multiple batches: distribute equally (floor each; last batch absorbs remainder).
  if(batchSum===0&&total!=null&&total>0){
    if(batches.length===1){
      batchQtys=[total];
    }else{
      var base=Math.floor(total/batches.length);
      batchQtys=batches.map(function(){return base;});
      batchQtys[batches.length-1]=total-base*(batches.length-1);
    }
    batchSum=total;
  }
  // If sum of stored batch qtys exceeds actual total, cap proportionally.
  if(total!=null&&batchSum>total&&batchSum>0){
    batchQtys=batchQtys.map(function(q){return Math.round(q/batchSum*total);});
  }
  return batches.map(function(batch,i){
    var expiry=fsR5DMY(batch&&batch.expiry);
    var qty=batchQtys[i];
    var parts=[];
    if(qty>0||batchSum>0)parts.push(String(qty));
    parts.push('Exp '+expiry);
    if(!html)return parts.join(' · ');
    return '<div class="ctl-batch-print-line">'+parts.map(fsEsc).join(' · ')+'</div>';
  }).join(html?'':' ; ');
}

export function fsR5Class(v){return String(v||'').toLowerCase()==='psychotropic'?'Psychotropic / نفسي':'Narcotic / مخدر'}

export function fsR5ExpiryDays(row){
  var a=((row&&row.batches)||[]).map(function(b){return b&&b.expiry}).filter(Boolean).map(function(v){
    var d=new Date(v);return isNaN(d)?null:Math.floor((d.getTime()-Date.now())/86400000);
  }).filter(function(v){return v!==null});
  return a.length?Math.min.apply(Math,a):null;
}

/* The department's own "near expiry" window, kept per department in this tab
   only — it is a way of looking at the list, not a saved setting. */
export function fsR5NearDays(dept){
  var v='';try{v=sessionStorage.getItem('asdhealth-controlled-near-days-'+dept)||''}catch(e){}
  return Math.max(1,Math.floor(fsNum(v||30)));
}
