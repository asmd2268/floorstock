/* Western digits (0123456789) everywhere in the app, whatever the device language.

   On a device set to Arabic the browser itself draws Arabic-Indic digits (٠١٢٣)
   in three places the page cannot style away:

     1. native <input type="number"> and <input type="date"> — the value box and
        the calendar popup follow the browser's UI language, not the page's
        `lang` attribute (the old `lang="en"` patch on date inputs did nothing);
     2. toLocaleString / toLocaleDateString / Intl.* called with no locale or an
        Arabic one;
     3. digits typed on an Arabic keyboard layout.

   So this module owns all three, once, instead of every screen fixing itself:

     - number inputs become plain numeric text inputs (digits filtered as typed);
     - date inputs become YYYY-MM-DD text inputs with a small calendar of our own
       — `.value` is still the same "YYYY-MM-DD" string every caller already reads;
     - every Intl / toLocale* call is given the `nu-latn` numbering system;
     - Arabic-Indic digits typed or pasted are converted as they arrive, and any
       that reach the page as text (stored data, a pasted name) are converted in
       the DOM and in printed documents.

   Nothing stored is rewritten: only what is shown and what is typed. */

const INDIC = /[٠-٩۰-۹]/;
const INDIC_ALL = /[٠-٩۰-۹]/g;

/* "١٢٫٥" -> "12.5". Cheap when there is nothing to convert. */
export function toLatinDigits(value) {
  const text = String(value == null ? '' : value);
  if (!INDIC.test(text)) return text;
  return text
    .replace(INDIC_ALL, (ch) => {
      const code = ch.charCodeAt(0);
      return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
    })
    .replace(/(\d)٫(?=\d)/g, '$1.')
    .replace(/(\d)٬(?=\d)/g, '$1,');
}

/* ---------- 1. Intl / toLocale* always use Western digits ---------- */

/* No locale given means "the device's", which is Arabic here — the project's own
   formatting everywhere else is en-GB, so that is what an unspecified call gets. */
const DEFAULT_LOCALE = 'en-GB';

export function withLatinNumerals(locales) {
  let list;
  if (locales === undefined || locales === null) list = [DEFAULT_LOCALE];
  else list = Array.isArray(locales) ? locales : [locales];
  if (!list.length) list = [DEFAULT_LOCALE];
  return list.map((tag) => {
    const text = String(tag);
    if (/-nu-/i.test(text) || /-x-/i.test(text)) return text;
    return /-u-/i.test(text) ? text + '-nu-latn' : text + '-u-nu-latn';
  });
}

let localePatched = false;
let domInstalled = false;

function installLocalePatch() {
  if (localePatched) return;
  localePatched = true;

  const patchArgs = (args) => {
    try {
      const list = withLatinNumerals(args[0]);
      /* Reject a tag the engine would throw on and fall back to what was asked. */
      Intl.getCanonicalLocales(list);
      return [list].concat(Array.prototype.slice.call(args, 1));
    } catch (error) {
      return args;
    }
  };

  ['NumberFormat', 'DateTimeFormat'].forEach((name) => {
    const Original = Intl[name];
    if (typeof Original !== 'function') return;
    Intl[name] = new Proxy(Original, {
      apply: (target, thisArg, args) => target(...patchArgs(args)),
      construct: (target, args, newTarget) => Reflect.construct(target, patchArgs(args), newTarget),
    });
  });

  [[Number.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleString'],
    [Date.prototype, 'toLocaleDateString'], [Date.prototype, 'toLocaleTimeString'],
    [typeof BigInt === 'function' ? BigInt.prototype : null, 'toLocaleString']].forEach(([proto, name]) => {
    if (!proto || typeof proto[name] !== 'function') return;
    const original = proto[name];
    Object.defineProperty(proto, name, {
      configurable: true,
      writable: true,
      value: function patchedLocaleFormat(...args) {
        return original.apply(this, patchArgs(args));
      },
    });
  });
}

/* ---------- 2. Typed / pasted digits ---------- */

/* Rewrite a field's value while keeping the caret where the person left it.
   `fn` must map a prefix of the text to the matching prefix of the result. */
function rewriteValue(el, fn) {
  const before = el.value;
  const after = fn(before);
  if (after === before) return;
  let caret = null;
  try { caret = el.selectionStart; } catch (error) { caret = null; }
  el.value = after;
  if (caret != null) {
    const next = Math.min(after.length, fn(before.slice(0, caret)).length);
    try { el.setSelectionRange(next, next); } catch (error) { /* some types have no selection */ }
  }
}

function numberText(value) {
  let out = '';
  let dot = false;
  const text = toLatinDigits(value);
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '-' && out === '') out = '-';
    else if ((ch === '.' || ch === ',') && !dot) { dot = true; out += '.'; }
  }
  return out;
}

function dateText(value) {
  const digits = toLatinDigits(value).replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return digits.slice(0, 4) + '-' + digits.slice(4);
  return digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
}

function isRealIso(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
  if (!m) return false;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function onInput(event) {
  const el = event.target;
  if (!el || el.nodeType !== 1) return;
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
  if (el.type === 'password') return;
  if (el.hasAttribute('data-latin-date')) rewriteValue(el, dateText);
  else if (el.hasAttribute('data-latin-number')) rewriteValue(el, numberText);
  else if (INDIC.test(el.value)) rewriteValue(el, toLatinDigits);
}

function onFocusOut(event) {
  const el = event.target;
  /* A half-typed date is not a date; the old date input would have reported ''. */
  if (el && el.hasAttribute && el.hasAttribute('data-latin-date') && el.value && !isRealIso(el.value)) el.value = '';
}

/* ---------- 3. Number and date inputs ---------- */

const coarsePointer = () => {
  try { return globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches; } catch (error) { return false; }
};

function convertNumber(el) {
  if (el.hasAttribute('data-latin-number')) return;
  const value = el.value;
  const step = String(el.getAttribute('step') || '');
  el.type = 'text';
  el.setAttribute('data-latin-number', '');
  el.setAttribute('inputmode', /\.|any/.test(step) ? 'decimal' : 'numeric');
  el.setAttribute('autocomplete', el.getAttribute('autocomplete') || 'off');
  el.value = value;
}

function convertDate(el) {
  if (el.hasAttribute('data-latin-date')) return;
  const value = el.value;
  el.type = 'text';
  el.setAttribute('data-latin-date', '');
  el.setAttribute('inputmode', coarsePointer() ? 'none' : 'numeric');
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('maxlength', '10');
  el.setAttribute('dir', 'ltr');
  if (!el.getAttribute('placeholder')) el.setAttribute('placeholder', 'YYYY-MM-DD');
  el.value = value;
}

const NATIVE = 'input[type="number"],input[type="date"]';

function convertInputs(root) {
  const list = [];
  if (root.matches && root.matches(NATIVE)) list.push(root);
  if (root.querySelectorAll) root.querySelectorAll(NATIVE).forEach((el) => list.push(el));
  list.forEach((el) => (el.type === 'date' ? convertDate(el) : convertNumber(el)));
}

/* ---------- 4. The calendar ---------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n) => (n < 10 ? '0' : '') + n;
const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

const picker = { el: null, box: null, year: 0, month: 0 };

const CSS = `
.fs-dp{position:fixed;z-index:2147483000;width:268px;padding:10px;border-radius:10px;border:1px solid GrayText;background:Canvas;color:CanvasText;box-shadow:0 8px 28px rgba(0,0,0,.35);font:13px/1.2 system-ui,sans-serif;direction:ltr;text-align:center;user-select:none}
.fs-dp-head{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:8px}
.fs-dp-title{flex:1;font-weight:700}
.fs-dp button{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:6px;cursor:pointer;min-width:30px;height:30px;padding:0 6px}
.fs-dp button:hover:not(:disabled){border-color:GrayText}
.fs-dp button:disabled{opacity:.3;cursor:default}
.fs-dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.fs-dp-wd{font-size:11px;opacity:.6;padding:4px 0}
.fs-dp-grid button{min-width:0;width:100%}
.fs-dp-grid .fs-dp-today{border-color:GrayText}
.fs-dp-grid .fs-dp-sel{background:Highlight;color:HighlightText}
.fs-dp-foot{display:flex;justify-content:space-between;margin-top:8px}
.fulfill-table input[data-latin-number]{width:100%!important;max-width:92px!important;min-width:0!important;padding:6px 4px!important}
`;

function parseIso(text) {
  if (!isRealIso(text)) return null;
  return { y: Number(text.slice(0, 4)), m: Number(text.slice(5, 7)) - 1, d: Number(text.slice(8, 10)) };
}

function closePicker() {
  if (picker.box && picker.box.parentNode) picker.box.parentNode.removeChild(picker.box);
  picker.box = null;
  picker.el = null;
}

function renderPicker() {
  const { el, year, month } = picker;
  if (!el || !picker.box) return;
  const selected = parseIso(el.value);
  const min = el.getAttribute('min') || '';
  const max = el.getAttribute('max') || '';
  const now = new Date();
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  let cells = '';
  WEEKDAYS.forEach((w) => { cells += '<div class="fs-dp-wd">' + w + '</div>'; });
  for (let i = 0; i < first; i += 1) cells += '<span></span>';
  for (let d = 1; d <= days; d += 1) {
    const value = iso(year, month, d);
    const off = (isRealIso(min) && value < min) || (isRealIso(max) && value > max);
    const cls = (value === todayIso ? ' fs-dp-today' : '') + (selected && value === iso(selected.y, selected.m, selected.d) ? ' fs-dp-sel' : '');
    cells += '<button type="button" data-fs-day="' + value + '" class="' + cls.trim() + '"' + (off ? ' disabled' : '') + '>' + d + '</button>';
  }
  picker.box.innerHTML =
    '<div class="fs-dp-head">'
    + '<button type="button" data-fs-nav="-12" title="Previous year">«</button>'
    + '<button type="button" data-fs-nav="-1" title="Previous month">‹</button>'
    + '<div class="fs-dp-title">' + MONTHS[month] + ' ' + year + '</div>'
    + '<button type="button" data-fs-nav="1" title="Next month">›</button>'
    + '<button type="button" data-fs-nav="12" title="Next year">»</button></div>'
    + '<div class="fs-dp-grid">' + cells + '</div>'
    + '<div class="fs-dp-foot"><button type="button" data-fs-today="1">Today / اليوم</button>'
    + '<button type="button" data-fs-clear="1">Clear / مسح</button></div>';
}

function placePicker() {
  const { el, box } = picker;
  if (!el || !box) return;
  const rect = el.getBoundingClientRect();
  const width = 268;
  const height = box.offsetHeight || 300;
  const left = Math.max(8, Math.min(rect.left, globalThis.innerWidth - width - 8));
  const below = rect.bottom + 4;
  const top = below + height > globalThis.innerHeight && rect.top - height - 4 > 8 ? rect.top - height - 4 : below;
  box.style.left = left + 'px';
  box.style.top = Math.max(8, top) + 'px';
}

function commit(value) {
  const el = picker.el;
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  closePicker();
}

function openPicker(el) {
  if (el.disabled || el.readOnly) return;
  if (picker.el === el && picker.box) return;
  closePicker();
  const current = parseIso(el.value) || (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();
  picker.el = el;
  picker.year = current.y;
  picker.month = current.m;
  picker.box = document.createElement('div');
  picker.box.className = 'fs-dp';
  picker.box.addEventListener('mousedown', (event) => event.preventDefault());
  picker.box.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;
    if (target.hasAttribute('data-fs-day')) return commit(target.getAttribute('data-fs-day'));
    if (target.hasAttribute('data-fs-clear')) return commit('');
    if (target.hasAttribute('data-fs-today')) {
      const n = new Date();
      return commit(iso(n.getFullYear(), n.getMonth(), n.getDate()));
    }
    if (target.hasAttribute('data-fs-nav')) {
      const at = picker.year * 12 + picker.month + Number(target.getAttribute('data-fs-nav'));
      picker.year = Math.floor(at / 12);
      picker.month = at % 12;
      renderPicker();
      placePicker();
    }
    return undefined;
  });
  document.body.appendChild(picker.box);
  renderPicker();
  placePicker();
}

function onClick(event) {
  const el = event.target;
  if (el && el.hasAttribute && el.hasAttribute('data-latin-date')) return openPicker(el);
  if (picker.box && !picker.box.contains(el)) closePicker();
  return undefined;
}

function onKeyDown(event) {
  if (event.key === 'Escape' && picker.box) closePicker();
  else if (event.key === 'ArrowDown' && event.target && event.target.hasAttribute
    && event.target.hasAttribute('data-latin-date')) openPicker(event.target);
}

/* ---------- 5. Digits that arrive as text ---------- */

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
const TEXT_ATTRS = ['placeholder', 'title', 'aria-label'];

function fixTextNode(node) {
  const value = node.nodeValue;
  if (value && INDIC.test(value)) node.nodeValue = toLatinDigits(value);
}

function fixTree(root) {
  if (root.nodeType === 3) {
    if (!root.parentNode || !SKIP_TEXT.has(root.parentNode.nodeName)) fixTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, {
    acceptNode: (node) => (node.parentNode && SKIP_TEXT.has(node.parentNode.nodeName) ? 2 : 1),
  });
  while (walker.nextNode()) fixTextNode(walker.currentNode);
  const withText = [root].concat(Array.from(root.querySelectorAll('[placeholder],[title],[aria-label]')));
  withText.forEach((el) => TEXT_ATTRS.forEach((name) => {
    const v = el.getAttribute && el.getAttribute(name);
    if (v && INDIC.test(v)) el.setAttribute(name, toLatinDigits(v));
  }));
}

function observe() {
  const root = document.documentElement;
  const handle = (mutations) => {
    mutations.forEach((m) => {
      if (m.type === 'characterData') {
        if (!m.target.parentNode || !SKIP_TEXT.has(m.target.parentNode.nodeName)) fixTextNode(m.target);
        return;
      }
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) convertInputs(node);
        fixTree(node);
      });
    });
  };
  new MutationObserver(handle).observe(root, { childList: true, subtree: true, characterData: true });
  convertInputs(document.body);
  fixTree(document.body);
}

function installDom() {
  if (typeof document === 'undefined' || domInstalled) return;
  domInstalled = true;
  const style = document.createElement('style');
  style.id = 'fs-latin-digits-css';
  style.textContent = CSS;
  document.head.appendChild(style);
  document.addEventListener('input', onInput, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  globalThis.addEventListener('resize', closePicker);
  document.addEventListener('scroll', (event) => {
    if (picker.box && !picker.box.contains(event.target)) closePicker();
  }, true);
  observe();
}

installLocalePatch();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installDom, { once: true });
  else installDom();
}
