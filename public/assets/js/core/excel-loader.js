/* Shared lazy Excel/CSV reader loader for import workflows. */
/* SheetJS 0.20.3, served from this site (assets/vendor). The 0.18.5 build this used to
   fetch from three CDNs has CVE-2023-30533 (prototype pollution) and CVE-2024-22363
   (ReDoS) on crafted workbooks, and 0.20.x is only published by SheetJS itself, so
   the official file is vendored: sha256 cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41. */
export const XLSX_URL = new URL('../../vendor/xlsx-0.20.3.full.min.js', import.meta.url).href;
async function ensureXLSX() {
  if (typeof XLSX !== 'undefined') return true;
  await new Promise(function (resolve, reject) {
    var sc = document.createElement('script');
    sc.src = XLSX_URL; sc.async = true;
    sc.onload = function () { typeof XLSX !== 'undefined' ? resolve(true) : reject(new Error('XLSX unavailable')); };
    sc.onerror = function () { reject(new Error('Excel library failed to load')); };
    document.head.appendChild(sc);
  });
  return true;
}
globalThis.ensureXLSX = ensureXLSX;
export { ensureXLSX };
