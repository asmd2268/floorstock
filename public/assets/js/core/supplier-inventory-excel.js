/* Supplier Inventory — Excel in and out, with the XLSX library passed in so the
   rules stay testable. Export writes expiry as a real date cell. Import only
   ever READS the sheet: the caller shows the plan and applies it after the
   person confirms. */

import { COLUMNS, SHEET_NAME, INFO_SHEET_NAME, FORMAT, buildRows, readSheet } from './supplier-inventory-model.js?v=6b35c5abc7';
import { dateToSerial } from './crash-cart-excel.js?v=8136b92558';

export function buildWorkbook(XLSX, items, options) {
  const rows = buildRows(items, options);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const expiryCol = COLUMNS.findIndex((c) => c.key === 'expiry');
  for (let r = 1; r < rows.length; r += 1) {
    const serial = dateToSerial(rows[r][expiryCol]);
    if (serial !== null) ws[XLSX.utils.encode_cell({ r, c: expiryCol })] = { t: 'n', v: serial, z: 'yyyy-mm-dd' };
  }
  ws['!cols'] = [28, 18, 16, 20, 24, 14, 10, 12, 12].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: COLUMNS.length - 1 } }) };
  const info = XLSX.utils.aoa_to_sheet([
    ['Format', FORMAT],
    ['Exported at', new Date().toISOString()],
    ['Department', (options && options.deptName) || ''],
    [],
    ['How to use / طريقة الاستخدام'],
    ['1. Import reads ONLY the first three columns: Name, Code, Expiry. / الاستيراد يقرأ فقط: الاسم، الكود، تاريخ الانتهاء.'],
    ['2. Dates: YYYY-MM-DD, or DD/MM/YYYY (day first). / التاريخ: سنة-شهر-يوم أو يوم/شهر/سنة.'],
    ['3. Items are matched by Code. A new code adds an item; a known code can be renamed and gain an expiry date. / يتم المطابقة بالكود.'],
    ['4. Nothing is ever deleted by an import, and you see every change before it is applied. / لا يحذف الاستيراد شيئاً وتشاهد كل تغيير قبل التطبيق.'],
    ['5. The other columns are for reading only. / بقية الأعمدة للقراءة فقط.'],
  ]);
  info['!cols'] = [{ wch: 110 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, info, INFO_SHEET_NAME);
  return { wb, rows: rows.length - 1 };
}

/* Reads an uploaded workbook into the plan from readSheet (nothing is written). */
export async function readWorkbookFile(XLSX, file, currentItems, maxItems) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('The workbook has no sheet.');
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  return readSheet(aoa, { currentItems, maxItems });
}
