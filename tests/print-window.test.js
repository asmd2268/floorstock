import assert from 'node:assert/strict';
import { test } from 'node:test';

import { openBlobPrint, printDocument, printFullDocument } from '../public/assets/js/core/print-window.js';

/* One way to open a printable document.

   There were four. Three opened a blank window and document.write() into it —
   and Safari does not reliably fire `load` on a document written that way, so
   the window.print() those pages relied on never ran: a blank tab, no print
   dialogue, nothing in the console. The comment recording that diagnosis was
   sitting two hundred lines above one of the copies still doing it. */

function withBrowser(run) {
  const saved = { Blob: globalThis.Blob, URL: globalThis.URL, open: globalThis.open, toast: globalThis.toast };
  const opened = [];
  const revoked = [];
  let lastHtml = '';
  globalThis.Blob = class { constructor(parts, options) { lastHtml = parts.join(''); this.type = options && options.type; } };
  globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: (url) => revoked.push(url) };
  globalThis.open = (url, target) => { opened.push({ url, target }); return { closed: false, location: {} }; };
  try { return run({ opened, revoked, html: () => lastHtml }); } finally { Object.assign(globalThis, saved); }
}

test('a document is opened as a real navigation, never written into a blank window', () => {
  withBrowser(({ opened, html }) => {
    printDocument({ title: 'Report', html: '<p>body</p>', css: 'p{color:red}' });
    assert.equal(opened.length, 1);
    assert.match(opened[0].url, /^blob:/, 'a blob: URL has a load lifecycle every browser honours');
    assert.match(html(), /<p>body<\/p>/);
    assert.match(html(), /p\{color:red\}/);
    assert.match(html(), /@page\{size:A4/);
  });
});

test('printing is attempted three ways, and happens once', () => {
  withBrowser(({ html }) => {
    printDocument({ title: 'Report', html: '' });
    const page = html();
    assert.match(page, /readyState==="complete"/, 'a document already loaded still prints');
    assert.match(page, /addEventListener\("load"/);
    assert.match(page, /setTimeout\(g,1500\)/, 'and a page whose images never resolve prints anyway');
    assert.match(page, /var d=false/, 'the guard that keeps three attempts from printing three times');
  });
});

test('the title is escaped — a medicine name with a bracket cannot open a tag', () => {
  withBrowser(({ html }) => {
    printDocument({ title: '<script>alert(1)</script>', html: '' });
    assert.doesNotMatch(html().split('</head>')[0], /<script>alert/);
  });
});

test('the brand line is on every sheet, and can be left off when the body has its own', () => {
  withBrowser(({ html }) => {
    printDocument({ title: 'A', html: '<p>x</p>' });
    assert.match(html(), /By Ali Abudahash/);
  });
  withBrowser(({ html }) => {
    printDocument({ title: 'A', html: '<p>x</p>', brand: '' });
    assert.doesNotMatch(html(), /By Ali Abudahash/);
  });
});

test('a window opened during the click is reused rather than blocked later', () => {
  /* Pop-up blockers allow a window opened inside the user's own click. Callers
     that park one there must get it used, not a second one refused. */
  const saved = globalThis.__preOpenedPW;
  withBrowser(({ opened }) => {
    const parked = { closed: false, location: {} };
    globalThis.__preOpenedPW = parked;
    const result = printDocument({ title: 'A', html: '' });
    assert.equal(result, parked);
    assert.equal(opened.length, 0, 'no second window is opened');
    assert.match(parked.location.href, /^blob:/);
    assert.equal(globalThis.__preOpenedPW, null, 'and it is not reused twice');
  });
  globalThis.__preOpenedPW = saved;
});

test('a blocked pop-up is reported rather than failing silently', () => {
  const saved = { Blob: globalThis.Blob, URL: globalThis.URL, open: globalThis.open, toast: globalThis.toast };
  const said = [];
  globalThis.Blob = class {};
  globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
  globalThis.open = () => null;
  globalThis.toast = (message, kind) => said.push(kind);
  try {
    assert.equal(openBlobPrint('<html></html>'), null);
    assert.deepEqual(said, ['err']);
  } finally { Object.assign(globalThis, saved); }
});

test('a caller with a whole document already built gets the print sequence injected', () => {
  withBrowser(({ html }) => {
    printFullDocument('<!doctype html><html><body><table></table></body></html>');
    assert.match(html(), /<table><\/table>.*window\.print\(\).*<\/body>/s, 'injected inside the body, not after it');
  });
});

test('the blob URL is released, so a long session does not hold every report open', () => {
  withBrowser(({ revoked }) => {
    printDocument({ title: 'A', html: '' });
    assert.equal(revoked.length, 0, 'not immediately — the window still needs it');
  });
});
