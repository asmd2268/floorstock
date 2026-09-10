/* Reading item rows out of a warehouse receipt PDF.

   A PDF carries no rows — only text fragments, each with a position. What the
   eye reads as one line of a delivery note is a set of fragments sharing a
   baseline, and this is where they are put back together and turned into
   (code, description, quantity).

   The rules, all of them learned from real NUPCO delivery notes:

   Fragments within 2.5 points of the same baseline are one row. Text is not
   placed at exactly equal y — a slightly raised unit or superscript would
   otherwise become a row of its own.

   A row is only a row if it carries an item code: 8 to 14 digits, after leading
   zeros and non-digits are stripped. Headers, totals, addresses and page
   furniture carry no such code and are skipped rather than guessed at.

   The quantity is the LAST number on the row, searched backwards from the end
   and only after the code — delivery notes put unit price, pack size and other
   numbers between the two, and the received quantity is the rightmost of them.

   Everything between the code and that quantity is the description.

   A page is read on its own, and the same (page, code, quantity) appearing
   twice is one row: PDF text layers repeat fragments.

   Nothing here reads a file or touches the screen; it takes the text items a
   PDF page hands over and returns rows. Lifted out of modules/07j. */

const CODE_PATTERN = /^\d{8,14}$/;
const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;
/* Text on one visual line is not placed at exactly equal y. */
const SAME_LINE_TOLERANCE = 2.5;

export function normalizeCode(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
}

export function rowsFromTextItems(items, pageNo) {
  const lines = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const text = String((item && item.str) || '').trim();
    if (!text) return;
    const y = Math.round(((item.transform && item.transform[5]) || 0) * 2) / 2;
    const x = (item.transform && item.transform[4]) || 0;
    let line = null;
    for (let i = 0; i < lines.length; i += 1) {
      if (Math.abs(lines[i].y - y) <= SAME_LINE_TOLERANCE) { line = lines[i]; break; }
    }
    if (!line) { line = { y, fragments: [] }; lines.push(line); }
    line.fragments.push({ x, text });
  });

  const rows = [];
  /* Down the page, then left to right — the order a person reads it. */
  lines.sort((a, b) => b.y - a.y).forEach((line) => {
    const fragments = line.fragments.slice().sort((a, b) => a.x - b.x);

    let code = null;
    for (let i = 0; i < fragments.length; i += 1) {
      const digits = normalizeCode(fragments[i].text);
      if (CODE_PATTERN.test(digits)) { code = { code: digits, index: i }; break; }
    }
    if (!code) return;

    let quantity = null;
    for (let j = fragments.length - 1; j > code.index; j -= 1) {
      const raw = fragments[j].text.replace(/,/g, '').trim();
      if (NUMBER_PATTERN.test(raw)) { quantity = { qty: Number(raw), index: j }; break; }
    }
    if (!quantity || !Number.isFinite(quantity.qty)) return;

    rows.push({
      page: pageNo,
      code: code.code,
      description: fragments.slice(code.index + 1, quantity.index).map((fragment) => fragment.text).join(' ').trim(),
      qty: quantity.qty,
    });
  });

  return rows;
}

/* PDF text layers repeat fragments, so the same row can be read twice. */
export function dedupeRows(rows) {
  const seen = {};
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = row.page + '|' + row.code + '|' + row.qty;
    if (seen[key]) return false;
    seen[key] = 1;
    return true;
  });
}

/* A row is matched to the catalog by either code the hospital files it under. */
export function findMedicineByCode(catalog, code) {
  const wanted = normalizeCode(code);
  if (!wanted) return null;
  return (Array.isArray(catalog) ? catalog : []).find(
    (medicine) => normalizeCode(medicine.moh) === wanted || normalizeCode(medicine.nupco) === wanted,
  ) || null;
}
