# Legacy helper migration

The browser runtime has one canonical DOM/escaping utility module:

- `public/assets/js/core/dom-utils.js` exports `fsE(id)` and `fsEsc(value)`.
- `main.js` loads it before feature modules.
- Legacy modules must alias `var E=window.fsE;` and `var esc=window.fsEsc;` when they still use the old local names. They must not define a new helper.

Run `npm run audit:duplicates` before merging. It reports remaining legacy definitions so migration can be done in small, reviewable batches. Do not delete a legacy module until `main.js`, HTML entry points, and any `window.*` consumers have been checked.

This is intentionally an incremental boundary: it prevents new duplication without adding wrapper layers or changing feature behavior in one large rewrite.
