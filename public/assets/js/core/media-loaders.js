import { loadScriptOnce } from './script-loader.js?v=5e8c0b2d04';

/* pdf.js 3.11.174 and ZXing 0.19.1 are served from this site (assets/vendor) instead of
   cdnjs/unpkg: no third-party host can change what runs here, and a hospital network
   that blocks CDNs still scans and reads PDFs. Both files are byte-identical to the
   official npm packages (pdfjs-dist, @zxing/library); tests pin their sha256. */
const vendor = (name) => new URL(`../../vendor/${name}`, import.meta.url).href;
export const PDFJS_URL = vendor('pdf-3.11.174.min.js');
export const PDFJS_WORKER_URL = vendor('pdf-3.11.174.worker.min.js');
export const ZXING_URL = vendor('zxing-0.19.1.min.js');

export function ensurePDFJS() {
  return loadScriptOnce('PDF', PDFJS_URL, () => typeof pdfjsLib !== 'undefined')
    .then(() => {
      if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
      return pdfjsLib;
    });
}

export function ensureZXing() {
  return loadScriptOnce('Barcode scanner', ZXING_URL, () => typeof ZXing !== 'undefined');
}

Object.assign(globalThis, { ensurePDFJS, ensureZXing });
