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

   Three safety nets are deliberate and all three are needed: print when the
   document reports itself already complete, print on `load`, and print after a
   fixed delay whatever happened — a page whose images never resolve must still
   reach the print dialogue. `d`/`done` guards the three against printing twice. */

const AUTO_PRINT = '<' + 'script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print()}'
  + 'if(document.readyState==="complete")setTimeout(g,300);'
  + 'else window.addEventListener("load",function(){setTimeout(g,300)},{once:true});'
  + 'setTimeout(g,1500)})()</' + 'script>';

/* Some callers open the window during the user's click — a popup blocker will
   not allow it later — and park it here for whatever produces the document. */
export function openBlobPrint(fullHtml) {
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const parked = globalThis.__preOpenedPW;
  if (parked && !parked.closed) {
    globalThis.__preOpenedPW = null;
    parked.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return parked;
  }
  const opened = globalThis.open(url, '_blank', 'width=1100,height=850');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (!opened && globalThis.toast) globalThis.toast('Allow pop-ups to print.', 'err');
  return opened;
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
    + `<style>${pageCss}</style></head><body>${header}${html}${brandLine}${AUTO_PRINT}</body></html>`);
}

/* A caller that has already built a complete <html> document — the crash-cart
   opening log, for one — gets it opened the same way, with the auto-print
   sequence injected rather than written into the document by hand. */
export function printFullDocument(fullHtml) {
  const html = String(fullHtml || '');
  const closing = html.lastIndexOf('</body>');
  return openBlobPrint(closing >= 0 ? html.slice(0, closing) + AUTO_PRINT + html.slice(closing) : html + AUTO_PRINT);
}
