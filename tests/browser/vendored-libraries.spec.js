import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures.js';

/* The Excel, PDF and barcode libraries are served from assets/vendor and the
   Content-Security-Policy no longer allows any CDN. Source-text tests prove the
   files are pinned; this proves they RUN: under the real CSP from vercel.json,
   with only the local server reachable, each library loads through the app's own
   loader and does its job. A CSP that blocks the pdf.js worker, a path that does
   not resolve, or a build that fails to initialise all show up here, where the
   alternative is a nurse finding out at the bedside. */
const csp = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))
  .headers.flatMap((entry) => entry.headers)
  .find((header) => header.key === 'Content-Security-Policy').value;

test.beforeEach(async ({ context }) => {
  // The static test server sets no CSP, so add the production one to the page itself.
  await context.route(/^http:\/\/127\.0\.0\.1:\d+\/(index\.html)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
});

async function openApp(page) {
  const violations = [];
  page.on('console', (message) => { if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text()); });
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`));
  await page.goto('/');
  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');
  return violations;
}

test('the Excel reader loads from this site and round-trips a workbook', async ({ page }) => {
  const violations = await openApp(page);
  const result = await page.evaluate(async () => {
    await window.ensureXLSX();
    const sheet = XLSX.utils.aoa_to_sheet([['name', 'qty'], ['Drug A', 5], ['Drug B', 12]]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Stock');
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    return { version: XLSX.version, rows: XLSX.utils.sheet_to_json(XLSX.read(bytes, { type: 'array' }).Sheets.Stock) };
  });
  expect(result.version).toBe('0.20.3');
  expect(result.rows).toEqual([{ name: 'Drug A', qty: 5 }, { name: 'Drug B', qty: 12 }]);
  expect(violations).toEqual([]);
});

test('pdf.js reads a PDF with its worker served from this site', async ({ page }) => {
  const violations = await openApp(page);
  const result = await page.evaluate(async () => {
    const stream = 'BT /F1 18 Tf 20 50 Td (Receipt Drug A 25) Tj ET';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
      + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await window.ensurePDFJS();
    const doc = await pdfjsLib.getDocument({ data: new TextEncoder().encode(pdf).buffer, isEvalSupported: false }).promise;
    const content = await (await doc.getPage(1)).getTextContent();
    return { version: pdfjsLib.version, text: content.items.map((item) => item.str).join(' '), worker: pdfjsLib.GlobalWorkerOptions.workerSrc };
  });
  expect(result.version).toBe('3.11.174');
  expect(result.text).toBe('Receipt Drug A 25');
  expect(new URL(result.worker).host).toBe('127.0.0.1:4173');
  expect(violations).toEqual([]);
});

test('the barcode reader loads from this site', async ({ page }) => {
  const violations = await openApp(page);
  const reader = await page.evaluate(async () => { await window.ensureZXing(); return typeof ZXing.BrowserMultiFormatReader; });
  expect(reader).toBe('function');
  expect(violations).toEqual([]);
});

test('the policy under test allows no CDN host for scripts', () => {
  expect(csp).not.toMatch(/cdnjs|unpkg|jsdelivr/);
});
