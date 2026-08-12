/* Canonical DOM and escaping helpers. Loaded before legacy modules. */
export function fsE(id){ return document.getElementById(String(id)); }

const fallbackEsc = function(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
};

/* Keep the existing canonical helper if the core auth module has already provided it. */
export const fsEsc = globalThis.fsEsc || fallbackEsc;
if(!globalThis.fsE) globalThis.fsE = fsE;
if(!globalThis.fsEsc) globalThis.fsEsc = fsEsc;

/* Canonical compatibility surface for legacy modules during migration. */
if(!globalThis.E) globalThis.E = fsE;
if(!globalThis.esc) globalThis.esc = fsEsc;
