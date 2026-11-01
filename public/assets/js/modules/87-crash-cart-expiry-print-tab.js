/* "Crash-cart expiry" tab on the Print page, next to Print orders.

   Reads the crash carts the signed-in person may see, lists what expires inside
   a window they choose, and prints it as one page. Read-only: it writes nothing.
   The rules live in core/crash-cart-expiry-list.js, the page in
   core/crash-cart-expiry-sheet.js; this file only connects them to the screen. */

import { registerPrintTab } from '../core/print-tabs.js?v=c15bf9cb7b';
import { DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS, crashCartExpiryList, parseWindowDays } from '../core/crash-cart-expiry-list.js?v=cb4d3d313a';
import { listTable, sheetHtml, summaryTable, fitToOnePage } from '../core/crash-cart-expiry-sheet.js?v=44e16110ce';
import { openBlobPrint } from '../core/print-window.js?v=dafb959d71';

const HOST_ID = 'car-crashexpiry-host';
const SINGLE_PAGE_ROWS = 45;

/* Only the carts of departments this person may open — the same rule every other
   crash-cart screen applies. The filter runs before anything is counted, so a
   total can never include a cart the person cannot see. */
function visibleCarts() {
  const all = typeof window.crashCarts === 'function' ? (window.crashCarts() || []) : [];
  const allowed = typeof window.fsCanAccessDepartment === 'function' ? window.fsCanAccessDepartment : () => false;
  return all.filter((cart) => allowed(cart.deptId));
}

function daysUntil(value) {
  return typeof window.fsDaysUntil === 'function' ? window.fsDaysUntil(value) : null;
}

function todayLabel() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return now.getFullYear() + '-' + two(now.getMonth() + 1) + '-' + two(now.getDate());
}

function currentList(host) {
  const input = host.querySelector('#crashexpiry-days');
  const days = parseWindowDays(input && input.value);
  return days === null ? null : crashCartExpiryList(visibleCarts(), days, daysUntil);
}

function paint(host) {
  const list = currentList(host);
  const out = host.querySelector('#crashexpiry-out');
  const print = host.querySelector('#crashexpiry-print');
  if (!list) {
    out.innerHTML = '<div class="empty">أدخل عدد أيام صحيح من 1 إلى ' + MAX_WINDOW_DAYS + ' / Enter whole days, 1 to ' + MAX_WINDOW_DAYS + '.</div>';
    print.disabled = true;
    return;
  }
  print.disabled = list.groups.length === 0 && list.missing.length === 0;
  if (!list.groups.length && !list.missing.length) {
    out.innerHTML = '<div class="empty">لا توجد أدوية تنتهي خلال ' + list.windowDays + ' يوم في العربات المتاحة لك. / Nothing expires inside this window in the carts you can see.</div>';
    return;
  }
  const crowded = list.rows.length + list.missing.length + list.summary.medicines.length > SINGLE_PAGE_ROWS
    ? '<div class="empty">القائمة طويلة وقد يصغر الخط جدًا لتتسع بصفحة واحدة. / Long list: type will shrink to fit one page.</div>' : '';
  out.innerHTML = crowded + (list.groups.length ? '<div class="tw">' + listTable(list) + '</div>' : '') + '<div class="tw">' + summaryTable(list) + '</div>';
}

function printList(host) {
  const list = currentList(host);
  if (!list || (!list.groups.length && !list.missing.length)) return;
  openBlobPrint(sheetHtml(list, todayLabel()), { prepare: fitToOnePage });
}

function render() {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  if (!host.dataset.ready) {
    host.dataset.ready = '1';
    host.innerHTML = '<style>#car-crashexpiry-host tr.g td{background:rgba(128,128,128,.2)}#car-crashexpiry-host td.m{color:#c0392b;font-weight:700}</style>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'
      + '<label for="crashexpiry-days">خلال (يوم) / Within (days)</label>'
      + '<input id="crashexpiry-days" type="number" min="1" max="' + MAX_WINDOW_DAYS + '" step="1" value="' + DEFAULT_WINDOW_DAYS + '" style="width:90px">'
      + '<button type="button" class="btn bp bsm" id="crashexpiry-print">🖨 طباعة / Print</button></div>'
      + '<div id="crashexpiry-out"></div>';
    host.addEventListener('input', (event) => { if (event.target.id === 'crashexpiry-days') paint(host); });
    host.addEventListener('click', (event) => { if (event.target.closest('#crashexpiry-print')) printList(host); });
  }
  paint(host);
}

registerPrintTab('crashexpiry', {
  /* Everyone who works the carts from the pharmacy side, and the Master: the
     capability the other crash-cart operations already use. */
  allowed: () => typeof window.fsHasCapability === 'function' && window.fsHasCapability('crashCart.operate'),
  render,
});

export {};
