/* Choosing Firestore's transport per device, from what that device has shown.

   Firestore talks to the server over a streaming connection. On a clean network
   that is the fastest option. On a weak or filtered one (a hospital proxy, UDP
   being dropped, a flaky wifi link) the stream can stall without ever raising an
   error: the screen shows what was typed, the write never reaches the server, and
   the old value comes back with the next snapshot. The SDK's own auto-detection
   does not catch that — it only reacts to a few specific early failures.

   Long polling (plain repeated HTTP requests) rides out those networks, but it is
   a little slower and heavier, so it should not be forced on devices that do not
   need it. This module therefore keeps the default (auto-detect) and, when a
   device actually shows trouble, remembers that on the device and uses long
   polling there from the next page load for a week, after which auto-detect is
   tried again. A device on a good network never changes. Nobody has to configure
   anything.

   Firestore settings are fixed once the first request is made, so the choice is
   applied at start-up: trouble seen in this session takes effect on the next load. */

export const NET_MODE_KEY = 'fs_net_mode_v1';
export const NET_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
export const SERVER_WAIT_MS = 20000;
export const SAVE_WAIT_MS = 20000;

const NETWORK_ERROR_CODES = ['unavailable', 'deadline-exceeded'];

export function createNetworkHealth(options) {
  const o = options || {};
  const storage = o.storage || null;
  const now = o.now || Date.now;
  const timeout = o.setTimeout || setTimeout;
  const untimeout = o.clearTimeout || clearTimeout;
  const warn = o.warn || ((...a) => console.warn(...a));
  const holdMs = o.holdMs || NET_HOLD_MS;
  const serverWaitMs = o.serverWaitMs || SERVER_WAIT_MS;
  const saveWaitMs = o.saveWaitMs || SAVE_WAIT_MS;
  const isOnline = o.isOnline || (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  let serverTimer = null;
  let flagged = false;

  function read() {
    if (!storage) return null;
    try {
      const raw = storage.getItem(NET_MODE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed.until === 'number' ? parsed : null;
    } catch (error) {
      warn('Network mode could not be read; using auto-detect.', error);
      return null;
    }
  }

  function longPollingActive() {
    const mode = read();
    return !!mode && mode.until > now();
  }

  function transportSettings() {
    return longPollingActive()
      ? { experimentalForceLongPolling: true }
      : { experimentalAutoDetectLongPolling: true };
  }

  function trouble(reason) {
    if (flagged) return false;
    flagged = true;
    if (!storage) return false;
    try {
      storage.setItem(NET_MODE_KEY, JSON.stringify({ until: now() + holdMs, reason: String(reason || ''), at: now() }));
      warn('Weak connection detected (' + reason + '); long polling will be used from the next page load.');
      return true;
    } catch (error) {
      warn('Network mode could not be saved.', error);
      return false;
    }
  }

  /* Call when a listener is attached. If the server never answers within the
     window while the browser believes it is online, that is trouble. */
  function expectServer() {
    if (serverTimer !== null || flagged) return;
    serverTimer = timeout(function () {
      serverTimer = null;
      if (isOnline()) trouble('no-server-response');
    }, serverWaitMs);
  }

  /* Call on a snapshot that came from the server, not the local cache. */
  function serverReached() {
    if (serverTimer !== null) {
      untimeout(serverTimer);
      serverTimer = null;
    }
  }

  /* Call with every tracked save. A write that is still unacknowledged after the
     window, or that fails with a network code, marks the device. */
  function watchSave(promise) {
    if (!promise || typeof promise.then !== 'function') return promise;
    let settled = false;
    const timer = timeout(function () {
      if (!settled && isOnline()) trouble('slow-save');
    }, saveWaitMs);
    promise.then(
      function () { settled = true; untimeout(timer); },
      function (error) {
        settled = true;
        untimeout(timer);
        if (error && NETWORK_ERROR_CODES.indexOf(String(error.code || '').replace('firestore/', '')) >= 0) trouble('save-' + error.code);
      }
    );
    return promise;
  }

  return { transportSettings, trouble, expectServer, serverReached, watchSave, longPollingActive };
}
