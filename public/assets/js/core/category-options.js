/* Shared category option rendering for inventory and print forms. */
function getCatOptions(selected) {
  var cats = typeof globalThis.getCategories === 'function' ? globalThis.getCategories() : [];
  var escape = typeof globalThis.esc === 'function' ? globalThis.esc : function (v) { return String(v ?? ''); };
  return cats.map(function (c) { return '<option value="' + escape(c) + '"' + (c === selected ? ' selected' : '') + '>' + escape(c) + '</option>'; }).join('');
}
globalThis.getCatOptions = getCatOptions;
export { getCatOptions };
