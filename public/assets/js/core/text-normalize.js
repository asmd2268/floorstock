/* Trimming, numbers, and the one way this project folds a name for comparison.

   modules/51 carried TWO copies of these helpers, prefixed fsR5 and fsR6 — four
   of the six byte-identical. The fifth was not, and checking why is what
   produced this file:

     fsR5Norm ran NFKD and stripped U+0300–U+036F before folding the Arabic
     letter forms; fsR6Norm did neither. Those are the LATIN combining accents,
     so the printing half of the file matched "Amiodarone" to "Amiodaróne" and
     the Crash Cart half did not.

   And neither removed Arabic harakat, which are their own code points and are
   not produced by NFKD — so a medicine written مُورفين never matched مورفين in
   either half. The department scope in module 03 has always folded them
   (ً-ٟ, ٰ); this is the same fold, in one place, for names too.

   fsE and fsEsc already live in dom-utils.js, so only what was missing is here.  */

/* Latin accents are split off by NFKD and removed with the first range; Arabic
   harakat are separate code points and are removed by the other two. Then the
   letter forms Arabic writes interchangeably fold together, and anything that is
   not a letter or a digit is dropped. */
export function fsNorm(value) {
  return String(value == null ? '' : value).trim().toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9؀-ۿ]+/g, '');
}

/* A trimmed string, or the fallback when it is empty. */
export function fsText(value, fallback) {
  const trimmed = String(value == null ? '' : value).trim();
  return trimmed || fallback || '';
}

/* A finite number, or zero — never NaN reaching a quantity. */
export function fsNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

Object.assign(globalThis, { fsNorm, fsText, fsNum });
