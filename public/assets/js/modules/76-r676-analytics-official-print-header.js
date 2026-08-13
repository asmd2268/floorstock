(function () {
'use strict';

// Injects official header HTML before print if window.officialPrintHeaderHTML is available.
// Listens for the print event dispatched by module 73 instead of polling.
window.addEventListener('floorstock:analytics-print', function () {
  if (typeof window.fsOfficialPrint !== 'function') return;
  if (typeof window.officialPrintHeaderHTML !== 'function') return;
  // header is prepended by fsOfficialPrint itself when officialPrintHeaderHTML is defined;
  // nothing extra to do here — this module kept for future header customisation.
});

})();

export {};
