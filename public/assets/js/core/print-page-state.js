/* Shared print-page selection state, isolated from the legacy feature module. */
globalThis.PPP = 0;

function setPPP(n, btn) {
  globalThis.PPP = n;
  document.querySelectorAll('.ppp-btn').forEach(function (b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
}

function resetPrintPageState() {
  globalThis.PPP = 0;
  document.querySelectorAll('.ppp-btn').forEach(function (b) { b.classList.remove('on'); });
}

Object.assign(globalThis, { setPPP, resetPrintPageState });
export { setPPP, resetPrintPageState };
