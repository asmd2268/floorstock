import assert from 'node:assert/strict';
import { test } from 'node:test';

/* The nightly upkeep panel vanished from System Health.

   Not a permission problem and not the Cloud Function: the panel's own escaper
   had been written as `globalThis.fsEsc ? escapeText(value) : …` — a call to
   ITSELF. Every draw overflowed the stack on the first line, and the catch that
   was meant to report the fault called the same function again, so nothing was
   ever written into the host element. An empty div reads as "the feature is
   gone".

   Source-text assertions could not see it and neither could `node --check`.
   These tests draw the panel. */

function fakeElement() {
  return {
    innerHTML: '',
    listeners: [],
    addEventListener(type, handler) { this.listeners.push([type, handler]); },
  };
}

async function drawWith({ master = true, status = null, statusError = null } = {}) {
  const host = fakeElement();
  const saved = {
    document: globalThis.document,
    CU: globalThis.CU,
    fsCallFunction: globalThis.fsCallFunction,
    fsEsc: globalThis.fsEsc,
  };
  /* The application publishes fsEsc long before this panel draws, and that is
     the state the recursion needed: with fsEsc absent the broken escaper took
     its harmless branch, so a test that did not set it proved nothing. */
  globalThis.fsEsc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  globalThis.document = { getElementById: (id) => (id === 'scheduled-upkeep' ? host : null) };
  globalThis.CU = master ? { master: true } : { master: false };
  globalThis.fsCallFunction = async () => {
    if (statusError) throw new Error(statusError);
    return status || { settings: { enabled: false, dryRun: true }, lastRun: null };
  };
  try {
    const { renderScheduledUpkeep } = await import('../public/assets/js/core/scheduled-upkeep-ui.js');
    await renderScheduledUpkeep();
    return host;
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('the panel actually draws — it does not silently leave an empty box', async () => {
  const host = await drawWith({ status: { settings: { enabled: false, dryRun: true }, lastRun: null } });
  assert.match(host.innerHTML, /Nightly upkeep/);
  assert.match(host.innerHTML, /Off/, 'an upkeep that is off says so rather than showing nothing');
  assert.match(host.innerHTML, /data-upkeep="toggle"/, 'and offers the way to turn it on');
  assert.doesNotMatch(host.innerHTML, /Checking the nightly upkeep…/, 'the loading line must be replaced, not left up');
});

test('an unreachable function is reported on screen, with a way to retry', async () => {
  const host = await drawWith({ statusError: 'internal' });
  assert.match(host.innerHTML, /could not be reached/);
  assert.match(host.innerHTML, /data-upkeep="retry"/);
});

test('a run that is on and applying says which, and lists what it changed', async () => {
  const host = await drawWith({
    status: {
      settings: { enabled: true, dryRun: false },
      lastRun: {
        finishedAt: Date.now(), dryRun: false,
        changes: [{ job: 'archive', doc: 'crash_cart_reports_2026-03', added: 4 }],
        failures: [],
      },
    },
  });
  assert.match(host.innerHTML, /On \//);
  assert.match(host.innerHTML, /4 report\(s\) filed/);
  assert.match(host.innerHTML, /Apply for real|Report only/);
});

test('a failed job from the last run is shown, not swallowed', async () => {
  const host = await drawWith({
    status: {
      settings: { enabled: true, dryRun: true },
      lastRun: { finishedAt: Date.now(), dryRun: true, changes: [], failures: [{ job: 'rotate', error: 'permission-denied' }] },
    },
  });
  assert.match(host.innerHTML, /1 failed/);
  assert.match(host.innerHTML, /rotate: permission-denied/);
});

test('anyone who is not the Master sees nothing at all', async () => {
  const host = await drawWith({ master: false });
  assert.equal(host.innerHTML, '');
});
