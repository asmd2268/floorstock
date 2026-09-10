/* One listener per screen instead of one global function name per button.

   The legacy way of wiring a generated button is `onclick="clPrint('high')"`,
   which needs `clPrint` to exist as a global for the CSP bridge to find by name.
   That is where most of this project's global surface comes from: 248 names
   exist for no other reason.

   The replacement is an attribute the markup can carry and one listener that
   reads it:

       '<button data-act="print" data-type="high">Print</button>'
       installActions(root, { print: (el) => clPrint(el.dataset.type) });

   The handler receives the element and the event, and reads whatever it needs
   from the element's own dataset — so arguments travel as data, not as source
   code inside an attribute, and nothing has to be global to be reachable.

   One listener per root, event and attribute, no matter how many callers ask
   for it: a second call adds its names to the table the first one created
   rather than stacking another listener, so a screen that re-renders does not
   accumulate a listener per render, and two modules that both draw buttons on
   document.body do not silently unbind each other's. Names are the shared key,
   so re-installing the same name replaces that one handler and leaves the rest
   alone. */

const INSTALLED = new WeakMap();

export function installActions(root, handlers, { event = 'click', attribute = 'act' } = {}) {
  if (!root) return;
  const key = `${event}:${attribute}`;
  const existing = INSTALLED.get(root) || {};
  if (existing[key]) {
    Object.assign(existing[key].handlers, handlers);
    return;
  }

  const registry = { handlers: Object.assign({}, handlers) };
  const selector = `[data-${attribute}]`;
  root.addEventListener(event, (domEvent) => {
    const target = domEvent.target && domEvent.target.closest ? domEvent.target.closest(selector) : null;
    if (!target || !root.contains(target)) return;
    const handler = registry.handlers[target.dataset[attribute]];
    if (typeof handler !== 'function') return;
    handler(target, domEvent);
  });

  existing[key] = registry;
  INSTALLED.set(root, existing);
}
