/* How a printed pharmacy sheet marks a medicine.

   The three classifications have to survive black-and-white printing and a
   photocopy, so each one is marked by SHAPE as well as colour: high-alert fills
   the name, hazardous underlines and hatches it, look-alike/sound-alike outlines
   it. A page that reads correctly only in colour is a page that stops reading
   correctly the moment it is photocopied — which is what happens to every list
   pinned to a cabinet door. */

import { fsEsc } from './dom-utils.js?v=b2909b7f46';

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

/* Perceived brightness, so text on a filled name stays readable. */
export function luma(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function pharmacyPrintCss(colors) {
  const palette = colors || {};
  return '@media print{@page{margin:10mm}}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}'
    + '.pi-cab-block{break-inside:avoid;margin-bottom:24px}.pi-cab-head{font-size:15px;font-weight:700;border-bottom:2px solid #000;margin-bottom:6px;padding-bottom:3px}'
    + '.pi-table{width:100%;border-collapse:collapse;font-size:11px}.pi-table th,.pi-table td{border:1px solid #999;padding:4px 6px;text-align:left}'
    + '.pi-table th{background:#eee}.mono{font-family:ui-monospace,Menlo,monospace;font-size:10px}'
    + '.pi-ha{background:' + (palette.ha || '#dc2626') + ';color:' + (luma(palette.ha || '#dc2626') > 128 ? '#000' : '#fff') + ';padding:1px 4px;border-radius:2px}'
    + '.pi-haz{border-bottom:2px solid ' + (palette.haz || '#f59e0b') + ';position:relative}'
    + '.pi-haz::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(135deg,transparent,transparent 3px,' + (palette.haz || '#f59e0b') + '33 3px,' + (palette.haz || '#f59e0b') + '33 6px)}'
    + '.pi-lasa{outline:2px solid ' + (palette.lasa || '#2563eb') + ';outline-offset:1px;display:inline-block;padding:0 3px}'
    + '.pi-soon td{background:#fef9c3}.pi-expired td{background:#fee2e2}.pi-oos{text-decoration:line-through;opacity:.55}'
    + '.legend{margin-top:10px;font-size:10px;color:#444}';
}

export function pharmacyPrintName(classification, name) {
  if (classification === 'ha') return '<span class="pi-ha">' + fsEsc(name) + '</span>';
  if (classification === 'haz') return '<span class="pi-haz">' + fsEsc(name) + '</span>';
  if (classification === 'lasa') return '<span class="pi-lasa">' + fsEsc(name) + '</span>';
  return fsEsc(name);
}

/* A QR that could not be drawn is printed as its own text: a label with a blank
   square where the code should be is worse than one carrying the value. */
export function pharmacyPrintQr(data, size) {
  const value = String(data == null ? '' : data);
  if (!value) return '—';
  try {
    if (typeof globalThis.makeReadableQR === 'function') {
      const src = globalThis.makeReadableQR(value);
      if (src) return '<img src="' + src + '" width="' + size + '" height="' + size + '" style="image-rendering:pixelated" alt="' + fsEsc(value) + '">';
    }
  } catch (error) {
    console.warn('QR generation failed; the value is printed instead.', error);
  }
  return '<span style="font-size:9px;font-family:var(--mono)">' + fsEsc(value) + '</span>';
}
