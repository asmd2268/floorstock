import assert from 'node:assert/strict';
import { test } from 'node:test';

import { openBlobPrint, printDocument, printFullDocument, drivePrint } from '../public/assets/js/core/print-window.js';

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

test('the document carries no script — the opener prints it (a blob inherits the page CSP)', () => {
  withBrowser(({ html }) => {
    printDocument({ title: 'Report', html: '<p>x</p>' });
    assert.doesNotMatch(html(), /<script/i);
    assert.doesNotMatch(html(), /window\.print/);
  });
});

test('drivePrint prints a loaded blob document once, after its QR images are real', async () => {
  let printed = 0;
  const qr = { dataset: {}, getAttribute: () => 'data:image/png;base64,AAAA', complete: true, naturalWidth: 10 };
  const win = {
    closed: false, focus() {}, print() { printed++; },
    location: { href: 'blob:https://x/abc' },
    document: {
      readyState: 'complete', body: { children: [1], dataset: {} }, images: [qr], fonts: null,
      querySelector: () => null, querySelectorAll: (sel) => (sel === 'img.asd-qr-image' ? [qr] : []),
    },
  };
  drivePrint(win, { delay: 10 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(printed, 1);
});

test('drivePrint refuses to print a placeholder QR and offers a manual button', async () => {
  let printed = 0;
  const placeholder = { dataset: { qrState: 'unavailable' }, getAttribute: () => 'data:image/svg+xml;x', style: {}, complete: true, naturalWidth: 1 };
  const inserted = [];
  const win = {
    closed: false, focus() {}, print() { printed++; },
    location: { href: 'blob:https://x/abc' },
    document: {
      readyState: 'complete', body: { children: [1], dataset: {}, insertBefore: (box) => inserted.push(box), firstChild: null },
      images: [placeholder], fonts: null, querySelector: () => null,
      querySelectorAll: (sel) => (sel === 'img.asd-qr-image' ? [placeholder] : []),
      getElementById: () => null,
      createElement: () => ({ setAttribute() {}, style: {}, querySelector: () => ({}), set innerHTML(v) {} }),
    },
  };
  const saved = console.error; console.error = () => {};
  drivePrint(win, { delay: 10 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.error = saved;
  assert.equal(printed, 0);
  assert.equal(inserted.length, 1);
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

test('a caller with a whole document already built gets it opened the same way', () => {
  withBrowser(({ opened, html }) => {
    printFullDocument('<!doctype html><html><body><table></table></body></html>');
    assert.equal(opened.length, 1);
    assert.doesNotMatch(html(), /<script/i);
  });
});

test('the blob URL is released, so a long session does not hold every report open', () => {
  withBrowser(({ revoked }) => {
    printDocument({ title: 'A', html: '' });
    assert.equal(revoked.length, 0, 'not immediately — the window still needs it');
  });
});

test('the controlled print page goes through the same printer', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/assets/js/modules/15-controlled-print-pages.js', import.meta.url), 'utf8');
  assert.match(source, /printDocument\(/);
  assert.doesNotMatch(source, /\.document\.write\(/);
  // The printed document is unchanged: header, certification, brand line.
  assert.match(source, /officialPrintHeaderHTML\(\)/);
  assert.match(source, /electronic-cert/);
  assert.match(source, /A4 landscape/);
});

test('no module opens a blank window and writes a printable document into it', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../public/assets/js/modules/', import.meta.url);
  const offenders = [];
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(file, dir), 'utf8');
    /* One legitimate use remains: modules/80 writes a "Preparing…" placeholder
       into a window it pre-opened during the click, which is then navigated to
       a real blob URL. It never waits for load and never calls print. */
    if (/\.document\.write\(/.test(source) && !/Preparing drug list/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'print through core/print-window.js — a written document never fires load in Safari');
});

test('no printable document embeds a script that prints itself (the page CSP forbids inline scripts)', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const offenders = [];
  for (const base of ['../public/assets/js/modules/', '../public/assets/js/core/']) {
    const dir = new URL(base, import.meta.url);
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.js')) continue;
      const source = await readFile(new URL(file, dir), 'utf8');
      /* A string that writes a <script> whose body prints: the document opens and
         then never prints, because a blob inherits the page's CSP. */
      if (/<script>[^`]*window\.print\(\)/.test(source) || /'<script>'\s*\+\s*\w*[Rr]untime/.test(source)) offenders.push(file);
    }
  }
  assert.deepEqual(offenders, [], 'print through core/print-window.js (drivePrint)');
});

test('the controlled sheet sets no @page size, so each browser prints the layout of the chosen orientation', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/assets/js/core/controlled-custody-print.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@page\{size:/);
  assert.match(source, /@media print and \(orientation:landscape\)/);
  assert.match(source, /@media print and \(orientation:portrait\)/);
});

test('the controlled sheet never scales above 1, which pushed its right edge out of the clipped box', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/assets/js/core/controlled-custody-print.js', import.meta.url), 'utf8');
  assert.match(source, /Math\.min\(widthRatio,heightRatio,1\)/);
  assert.doesNotMatch(source, /1\.06/);
});

test('no print sheet sets a page margin below the 8mm a office printer can actually print', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of ['modules/50-r617-integrated-operations.js', 'modules/15-controlled-print-pages.js', 'core/controlled-custody-print.js']) {
    const source = await readFile(new URL('../public/assets/js/' + file, import.meta.url), 'utf8');
    const margins = [...source.matchAll(/@page\{[^}]*?margin:(\d+)mm/g)].map((m) => Number(m[1]));
    assert.ok(margins.length > 0 && margins.every((mm) => mm >= 8), file + ' margins ' + margins);
  }
});
