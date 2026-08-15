// Phase 2c: a permanent, opt-in live-tracing tool — the same kind of ad-hoc
// console.trace() rig built by hand for several bug investigations this
// session (crash-cart correction rejection, garbled dialog text), now
// available on any page/session without re-writing it each time.
//
// Off by default everywhere, including production: add ?debug=1 to the URL
// (or run `localStorage.setItem('asdh_debug_trace','1')` once, which persists
// across reloads until cleared) to enable it for that browser.
//
// Known limitation: window.toast wrapping only catches callers that resolve
// `toast` through the global-object scope fallback. A module with its own
// top-level `function toast(...)` declaration (03-core-application-firebase-
// state-auth.js does this) resolves its own bare `toast(...)` calls to that
// local declaration first, never touching window.toast — confirmed while
// investigating the crash-correction bug this session. Use watchFunction on
// a module's own exposed action (e.g. window.submitFulfill) to trace calls
// that originate from inside such a module instead.

export function isDebugTraceEnabled() {
  try {
    const query = new URLSearchParams(location.search || '');
    if (query.get('debug') === '1') return true;
    return typeof localStorage !== 'undefined' && localStorage.getItem('asdh_debug_trace') === '1';
  } catch (_) {
    return false;
  }
}

export function installDebugTracer() {
  if (!isDebugTraceEnabled()) return null;
  if (window.__ASDH_TRACE) return window.__ASDH_TRACE;

  function log(...args) {
    console.log('%c[ASDH-TRACE]', 'color:#f59e0b;font-weight:700', ...args);
  }

  const api = {
    enabled: true,

    // Wraps window[name] so every call logs its arguments plus a stack trace
    // naming exactly who called it and from where, then runs the real
    // function unchanged. Call unwatchFunction(name) to remove the wrapper.
    watchFunction(name) {
      const original = window[name];
      if (typeof original !== 'function') {
        console.warn('[ASDH-TRACE] watchFunction: window.' + name + ' is not a function');
        return;
      }
      if (original.__asdhTraced) return;
      const wrapped = function (...args) {
        log('call ' + name + '(', args, ')');
        console.trace('  called from:');
        return original.apply(this, args);
      };
      wrapped.__asdhTraced = true;
      wrapped.__asdhOriginal = original;
      window[name] = wrapped;
      log('watching window.' + name + '()');
    },

    unwatchFunction(name) {
      const current = window[name];
      if (current && current.__asdhOriginal) {
        window[name] = current.__asdhOriginal;
        log('stopped watching ' + name);
      }
    },

    // Watches a DOM element (by CSS selector) for attribute/class/subtree/
    // text changes and logs each one with a stack trace. Returns the
    // MutationObserver so the caller can .disconnect() it when done.
    watchElement(selector, label) {
      const el = document.querySelector(selector);
      if (!el) {
        console.warn('[ASDH-TRACE] watchElement: no match for ' + selector);
        return null;
      }
      const name = label || selector;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          log(name + ' changed:', mutation.type, mutation.attributeName || '');
          console.trace('  changed from:');
        });
      });
      observer.observe(el, { attributes: true, childList: true, subtree: true, characterData: true });
      log('watching ' + name);
      return observer;
    },
  };

  // Every error-styled toast (or any toast whose text smells like a denial)
  // gets a stack trace automatically — this is the single check that solved
  // the crash-correction and garbled-dialog investigations this session.
  const originalToast = window.toast;
  if (typeof originalToast === 'function' && !originalToast.__asdhTraced) {
    const wrappedToast = function (msg, type, ...rest) {
      if (type === 'err' || type === 'error' || /reject|denied|permission|رفض|denied/i.test(String(msg))) {
        log('toast(' + type + '):', msg);
        console.trace('  triggered from:');
      }
      return originalToast.apply(this, [msg, type, ...rest]);
    };
    wrappedToast.__asdhTraced = true;
    window.toast = wrappedToast;
  }

  window.addEventListener('unhandledrejection', (event) => {
    log('unhandled promise rejection:', event.reason);
  });
  window.addEventListener('error', (event) => {
    log('uncaught error:', event.message, event.filename + ':' + event.lineno);
  });

  window.__ASDH_TRACE = api;
  log('active — try __ASDH_TRACE.watchFunction("someGlobalFn") or __ASDH_TRACE.watchElement("#someId"). Error toasts and unhandled rejections are already traced.');
  return api;
}

globalThis.installDebugTracer = installDebugTracer;
globalThis.isDebugTraceEnabled = isDebugTraceEnabled;
