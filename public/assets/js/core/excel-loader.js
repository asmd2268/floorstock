/* Shared lazy Excel/CSV reader loader for import workflows. */
async function ensureXLSX() {
  if (typeof XLSX !== 'undefined') return true;
  var urls = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'];
  var lastErr = null;
  for (var i = 0; i < urls.length; i++) {
    try { await new Promise(function (resolve, reject) { var sc=document.createElement('script'); sc.src=urls[i]; sc.async=true; sc.onload=function(){typeof XLSX!=='undefined'?resolve(true):reject(new Error('XLSX unavailable'))}; sc.onerror=function(){reject(new Error('Excel library source '+(i+1)+' failed'))}; document.head.appendChild(sc); }); if (typeof XLSX !== 'undefined') return true; }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Excel library unavailable');
}
globalThis.ensureXLSX = ensureXLSX;
export { ensureXLSX };
