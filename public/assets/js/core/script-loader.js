const pendingScripts = new Map();

/* Loads an external library once, and — this is the part that was missing —
   gives up if it never arrives.

   `script.onerror` fires when a request FAILS. It does not fire when a request
   simply never finishes: a proxy that accepts the connection and stalls, a
   captive portal, a hospital filter holding the socket open. In that case the
   promise here never settled, and neither did anything awaiting it.

   That reached much further than it looks. fsCallFunction awaits this before
   every callable, so a stalled CDN meant submitting a Crash Cart report, or a
   custody mutation, or opening a handover, would wait forever: no error, no
   toast, no failed request in the console — the button simply never came back.
   A timeout turns that into something a person can read and retry. */
const DEFAULT_TIMEOUT_MS = 15000;

export function loadScriptOnce(key, src, test, timeoutMs) {
  if (test && test()) return Promise.resolve();
  if (pendingScripts.has(key)) return pendingScripts.get(key);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      /* Dropped from the map either way, so a later attempt starts a fresh
         request instead of awaiting the one that already failed. */
      if (error) pendingScripts.delete(key);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error(`${key} did not load within ${Math.round((timeoutMs || DEFAULT_TIMEOUT_MS) / 1000)}s. Check the connection and try again.`)),
      timeoutMs || DEFAULT_TIMEOUT_MS,
    );
    script.src = src;
    script.async = true;
    script.onload = () => finish(null);
    script.onerror = () => finish(new Error(`${key} library failed to load`));
    document.head.appendChild(script);
  });
  pendingScripts.set(key, promise);
  return promise;
}

globalThis.loadScriptOnce = loadScriptOnce;
