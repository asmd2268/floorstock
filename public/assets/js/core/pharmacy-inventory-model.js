/* The pharmacy inventory's own model: where a medicine sits, and how close it is
   to expiring.

   A cabinet is a grid — each shelf is one row, divided into cells, and cabinets
   are not uniform: one shelf may hold four cells and the next six. Staff type
   that as plain lines ("A x 4"), read it back off a printed map ("A2"), and
   expect the row to be in the order they arranged it. All of that is rules, not
   screen, so it lives here where it can be tested directly — the test for it
   used to `eval` these functions out of the shipped source because there was no
   other way to reach them.

   Expiry is the other rule: sixty days is the warning line, and a medicine with
   no expiry recorded is NOT reported as fine — it is reported as unknown, so a
   missing date never reads as a clean shelf. */

import { fsEsc } from './dom-utils.js?v=b2909b7f46';
import { earliestExpiry } from './controlled-expiry-format.js?v=7370bbb9a3';

/* Shelves read as a row of labels, so their order is the whole point. localeCompare
   with numeric:true puts A before B and "Shelf 2" before "Shelf 10" -- plain string
   order puts "Shelf 10" first, which looks like a bug to anyone reading the row. */
/* The cabinet is a grid: each shelf is one row of it, divided into cells, and
   cabinets are not uniform -- one shelf may hold four cells and the next six.
   Mirrors the controlled-pharmacy storage model (rows[] of cells[]). The editor stays a plain textarea, with an
   optional "x N" suffix per line, so adding a shelf is still one line of typing.
     A x 4
     B x 6
     C          -> one row */
export function piParseShelfLine(line){
  var m=/^(.*?)\s*[x*\u00d7]\s*(\d{1,2})\s*$/i.exec(String(line||''));
  if(m&&m[1].trim())return {name:m[1].trim(),cells:Math.max(1,Math.min(40,parseInt(m[2],10)||1))};
  return {name:String(line||'').trim(),cells:1};
}
export function piShelfLine(sh){
  var n=piShelfCells(sh);
  return n>1?(sh.name+' x '+n):sh.name;
}
export function piShelfCells(sh){var n=parseInt(sh&&sh.cells,10);return n>0?n:1}
/* Row labels are what staff read off the printed map, so they follow the shelf's
   own name: shelf A row 2 is "A2". */
export function piCellLabel(sh,idx){return String(sh&&sh.name||'')+(idx+1)}
export function piFindShelf(rooms,triple){
  var parts=String(triple||'').split('|');if(parts.length<3)return null;
  var room=(rooms||[]).find(function(r){return r.id===parts[0]});if(!room)return null;
  var cab=(room.cabinets||[]).find(function(c){return c.id===parts[1]});if(!cab)return null;
  var sh=(cab.shelves||[]).find(function(x){return x.id===parts[2]});
  return sh?{room:room,cab:cab,shelf:sh}:null;
}
/* Row options belong to the chosen shelf, so they are rebuilt whenever it changes.
   "—" stays available: a medicine may sit on a shelf without a recorded row, and
   forcing a guess would print it in a place nobody verified. */
export function piCellOptionsHtml(rooms,triple,cellVal){
  var found=piFindShelf(rooms,triple);
  var n=found?piShelfCells(found.shelf):0;
  var out='<option value="">—</option>';
  for(var i=0;i<n;i++){
    var v=String(i+1);
    out+='<option value="'+v+'"'+(String(cellVal||'')===v?' selected':'')+'>'+fsEsc(piCellLabel(found.shelf,i))+'</option>';
  }
  return out;
}
export function piShelfCmp(a,b){return String(a==null?'':a).localeCompare(String(b==null?'':b),undefined,{numeric:true,sensitivity:'base'})}
/* Saved order wins where it exists so a hand-arranged cabinet stays arranged;
   name order is the fallback for cabinets saved before order was recorded. */
export function piShelvesOf(cab){
  var list=(cab&&cab.shelves||[]).slice();
  var ordered=list.every(function(sh){return typeof sh.order==='number'});
  return ordered?list.sort(function(a,b){return a.order-b.order}):list.sort(function(a,b){return piShelfCmp(a.name,b.name)});
}

// ── Expiry helpers ─────────────────────────────────────────────────────────
export const PI_EXPIRY_WARN_DAYS = 60;
export function piDaysToExpiry(expiryStr){
  if(!expiryStr)return null;
  var d=new Date(expiryStr);if(isNaN(d))return null;
  return Math.floor((d-Date.now())/(1000*60*60*24));
}
export function piExpiryStatus(expiryStr){
  var d=piDaysToExpiry(expiryStr);if(d===null)return 'ok';
  if(d<0)return 'expired';if(d<=PI_EXPIRY_WARN_DAYS)return 'soon';return 'ok';
}
export function piExpiryLabel(expiryStr){
  var d=piDaysToExpiry(expiryStr);if(d===null)return '';
  if(d<0)return '⛔ Expired';if(d<=PI_EXPIRY_WARN_DAYS)return '⚠ '+d+'d left';return '';
}

/* The medicine-level expiry, derived from where its stock actually sits.

   The EARLIEST date across the locations wins, expired ones included. The line
   this replaced said "soonest non-expired" while doing exactly this, and the
   code was right: stock that has already expired is precisely what has to be
   found and pulled, so it must keep colouring the medicine and keep it on the
   reorder list. Hiding it behind a later batch is how expired stock stays on a
   shelf.

   Dates are compared as dates. The old line sorted the strings, which is only
   correct while every one of them is written YYYY-MM-DD — one date typed the
   other way round quietly became the "earliest" of all. */
export function medicineExpiryFromLocations(locations, fallback = '') {
  return earliestExpiry((Array.isArray(locations) ? locations : []).map((location) => location && location.expiry), fallback);
}
