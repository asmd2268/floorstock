/* Opening a printable document, in the one way that works everywhere.

   There were four ways in this project. Three of them opened a blank window and
   `document.write()` into it — and Safari does not reliably fire `load` on a
   document written that way, so the `window.print()` those pages relied on
   silently never ran. The user gets a blank tab and no print dialogue, with
   nothing in the console to explain it; the crash-cart print bug in Safari was
   this, and the comment recording the diagnosis was sitting two hundred lines
   above one of the copies still doing it.

   A blob: URL is a real navigation whose load lifecycle every browser handles
   normally. That is the only mechanism here.

   Printing itself is driven from the opener — see drivePrint below.
*/

import { toLatinDigits } from './latin-digits.js?v=36b6915648';

/* The print call is made from HERE, by the application, against the window it
   opened — never by a <script> written into the document. A blob: document
   inherits the CSP of the page that created it, and that policy forbids inline
   scripts, so every self-printing document used to open and then sit there: no
   dialog, nothing in the page to say why. (A comment in one caller claimed blobs
   bypass the policy; they do not.) Driving the print from the opener also means
   one place decides when a sheet is ready: loaded, images settled, and — where a
   document carries QR codes — every one of them real, because a placeholder code
   on a signed sheet is worse than no code.

   `options.prepare(win)` runs against the opened window before printing, for the
   documents that fit themselves to a page. */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function qrUnavailable(img) {
  return img.dataset.qrState === 'unavailable' || /^data:image\/svg\+xml/i.test(img.getAttribute('src') || '');
}

function imageSettled(img, required) {
  const fail = () => (required ? Promise.reject(new Error('QR image failed to load')) : Promise.resolve());
  if (img.complete) return img.naturalWidth > 0 || !required ? Promise.resolve() : fail();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (required ? reject(new Error('QR image load timed out')) : resolve()), 5000);
    img.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
    img.addEventListener('error', () => { clearTimeout(timer); fail().then(resolve, reject); }, { once: true });
  });
}

function showPrintFailure(w, error) {
  const d = w.document;
  d.body.dataset.qrPrint = 'failed';
  d.querySelectorAll('img.asd-qr-image').forEach((img) => { if (qrUnavailable(img)) img.style.display = 'none'; });
  if (d.getElementById('asd-qr-print-error')) return;
  const box = d.createElement('div');
  box.id = 'asd-qr-print-error';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'margin:12px;padding:12px;border:2px solid #b42318;background:#fff1f0;color:#7a271a;font:700 13px Arial;text-align:center';
  box.innerHTML = 'Automatic printing was stopped: ' + escapeTitle(error && error.message || 'the sheet is not ready')
    + '.<br>تم إيقاف الطباعة التلقائية.<br><button type="button" style="margin-top:8px;padding:7px 12px">Print anyway / طباعة</button>';
  box.querySelector('button').onclick = () => { w.focus(); w.print(); };
  d.body.insertBefore(box, d.body.firstChild);
  console.error(error);
}

async function finishPrint(w, options) {
  const d = w.document;
  const manual = d.querySelector('[data-qr-print-button]');
  if (manual) { manual.disabled = true; manual.onclick = null; }
  try {
    if (options.prepare) await options.prepare(w);
    const qr = Array.from(d.querySelectorAll('img.asd-qr-image'));
    if (qr.some(qrUnavailable)) throw new Error('QR generator returned a placeholder');
    await Promise.all(Array.from(d.images).map((img) => imageSettled(img, qr.includes(img))));
    if (d.fonts && d.fonts.ready) await Promise.race([d.fonts.ready, delay(2000)]);
    d.body.dataset.qrPrint = 'ready';
    if (manual) { manual.disabled = false; manual.onclick = () => { w.focus(); w.print(); }; }
    await delay(options.delay == null ? 250 : options.delay);
    if (w.closed) return;
    w.focus();
    w.print();
    if (options.closeAfter) setTimeout(() => w.close(), 50);
  } catch (error) {
    if (!w.closed) showPrintFailure(w, error);
  }
}

export function drivePrint(w, options = {}) {
  if (!w) return w;
  let tries = 0;
  const timer = setInterval(() => {
    let ready = false;
    try {
      const d = w.document;
      ready = !w.closed && String(w.location.href).indexOf('blob:') === 0
        && d.readyState === 'complete' && !!d.body && d.body.children.length > 0;
    } catch (e) { clearInterval(timer); return; }
    if (ready) { clearInterval(timer); finishPrint(w, options); return; }
    if (w.closed || ++tries > 400) clearInterval(timer);
  }, 50);
  return w;
}

/* Some callers open the window during the user's click — a popup blocker will
   not allow it later — and park it here for whatever produces the document. */
export function openBlobPrint(fullHtml, options) {
  const blob = new Blob([toLatinDigits(fullHtml)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const parked = globalThis.__preOpenedPW;
  if (parked && !parked.closed) {
    globalThis.__preOpenedPW = null;
    parked.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return drivePrint(parked, options);
  }
  const opened = globalThis.open(url, '_blank', 'width=1100,height=850');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (!opened && globalThis.toast) globalThis.toast('Allow pop-ups to print.', 'err');
  return drivePrint(opened, options);
}

function escapeTitle(value) {
  return String(value == null ? '' : value).replace(/</g, '&lt;');
}

/* A printable document with the house page setup, whatever header the caller
   supplies, and the brand line every printed sheet carries. */
export function printDocument({ title = 'ASDHealth', html = '', css = '', header = '', brand = 'By Ali Abudahash' } = {}) {
  const pageCss = '@page{size:A4;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;background:#fff;color:#111;margin:0}' + css;
  const brandLine = brand
    ? `<div style="text-align:center;font-size:8.5pt;color:#555;margin-top:14px">${escapeTitle(brand)}</div>`
    : '';
  return openBlobPrint(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeTitle(title)}</title>`
    + `<style>${pageCss}</style></head><body>${header}${html}${brandLine}</body></html>`);
}

/* A caller that has already built a complete <html> document — the crash-cart
   opening log, for one — gets it opened the same way. */
export function printFullDocument(fullHtml) {
  return openBlobPrint(String(fullHtml || ''));
}
