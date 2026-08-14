const bind = () => {
  const button = document.querySelector('[data-asdh-binding~="b005"]');
  if (!button || button.dataset.asdhAuthBootstrapBound === '1') return;
  button.dataset.asdhAuthBootstrapBound = '1';
  button.addEventListener('click', (event) => {
    if (event.__asdhLoginHandled) return;
    event.__asdhLoginHandled = true;
    let attempts = 0;
    const invoke = () => {
      if (typeof globalThis.doLogin === 'function') return Promise.resolve(globalThis.doLogin()).catch(console.error);
      if (++attempts < 300) setTimeout(invoke, 100);
      else console.error('[ASDHealth] sign-in action was not loaded');
    };
    invoke();
  }, { capture: true });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
import('./main.js?v=R6.76.91').catch(console.error);
