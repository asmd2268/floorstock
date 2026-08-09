import { loadScriptOnce } from './script-loader.js?v=R6.76.7';

export function ensurePDFJS() {
  return loadScriptOnce('PDF', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => typeof pdfjsLib !== 'undefined')
    .then(() => {
      if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      return pdfjsLib;
    });
}

export function ensureZXing() {
  return loadScriptOnce('Barcode scanner', 'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js', () => typeof ZXing !== 'undefined');
}

Object.assign(globalThis, { ensurePDFJS, ensureZXing });
