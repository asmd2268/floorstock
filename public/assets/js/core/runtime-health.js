/* ASDHealth runtime health boundary.
 * Keeps diagnostics centralised without changing feature behaviour or permissions.
 */
(() => {
  const startedAt = Date.now();
  const state = {
    startedAt,
    readyAt: null,
    errors: [],
    modules: Object.create(null),
  };

  const cap = (value, max = 20) => String(value || '').slice(0, max);
  const record = (error, source = 'runtime') => {
    const item = {
      source: cap(source, 80),
      message: cap(error && (error.stack || error.message) || error, 500),
      at: new Date().toISOString(),
    };
    state.errors.push(item);
    if (state.errors.length > 25) state.errors.shift();
    document.documentElement.dataset.asdhRuntimeErrors = String(state.errors.length);
    return item;
  };

  const mark = (name, status = 'ready') => {
    const key = cap(name, 100);
    state.modules[key] = { status, at: new Date().toISOString() };
    document.documentElement.dataset.asdhModuleHealth = Object.keys(state.modules).length + ':' + status;
  };

  window.__asdhRuntime = Object.freeze({
    state,
    mark,
    record,
    snapshot: () => ({
      startedAt: state.startedAt,
      readyAt: state.readyAt,
      errors: state.errors.slice(),
      modules: Object.assign({}, state.modules),
    }),
  });

  window.addEventListener('error', event => record(event.error || event.message, 'window.error'));
  window.addEventListener('unhandledrejection', event => record(event.reason, 'unhandledrejection'));
  window.addEventListener('asdh:module-ready', event => {
    if (event && event.detail && event.detail.name) mark(event.detail.name);
  });

  document.documentElement.dataset.asdhRuntime = 'active';
})();
