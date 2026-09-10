import assert from 'node:assert/strict';
import { test } from 'node:test';

import { installActions } from '../public/assets/js/core/delegated-actions.js';

/* Several modules draw buttons onto document.body, and each installs the
   actions for its own markup. While a second install replaced the table
   instead of adding to it, whichever screen rendered last silently unbound
   every other screen's buttons — they stayed on the page and did nothing. */

/* A stand-in for a root element: one listener list, and elements that report
   their own action name through `closest`. */
function root() {
  const listeners = [];
  return {
    listeners,
    addEventListener(event, handler) { listeners.push({ event, handler }); },
    contains() { return true; },
    fire(event, element) {
      listeners.filter((l) => l.event === event)
        .forEach((l) => l.handler({ target: { closest: (selector) => (element.selector === selector ? element : null) } }));
    },
  };
}

function button(name, attribute = 'clickact') {
  return { selector: `[data-${attribute}]`, dataset: { [attribute]: name } };
}

test('two modules installing on the same root keep both sets of actions', () => {
  const node = root();
  const pressed = [];
  installActions(node, { first: () => pressed.push('first') }, { event: 'click', attribute: 'clickact' });
  installActions(node, { second: () => pressed.push('second') }, { event: 'click', attribute: 'clickact' });

  node.fire('click', button('first'));
  node.fire('click', button('second'));

  assert.deepEqual(pressed, ['first', 'second']);
  assert.equal(node.listeners.length, 1, 'one listener, however many callers installed actions');
});

test('re-installing a name replaces that handler and leaves the others', () => {
  const node = root();
  const pressed = [];
  installActions(node, { save: () => pressed.push('old'), print: () => pressed.push('print') });
  installActions(node, { save: () => pressed.push('new') });

  node.fire('click', button('save', 'act'));
  node.fire('click', button('print', 'act'));

  assert.deepEqual(pressed, ['new', 'print']);
});

test('a re-render does not add a second listener', () => {
  const node = root();
  let count = 0;
  for (let i = 0; i < 5; i += 1) installActions(node, { go: () => { count += 1; } });
  node.fire('click', button('go', 'act'));
  assert.equal(count, 1);
  assert.equal(node.listeners.length, 1);
});

test('the same names on a different event get their own listener', () => {
  const node = root();
  const pressed = [];
  installActions(node, { go: () => pressed.push('click') }, { event: 'click', attribute: 'clickact' });
  installActions(node, { go: () => pressed.push('change') }, { event: 'change', attribute: 'changeact' });

  node.fire('click', button('go', 'clickact'));
  node.fire('change', button('go', 'changeact'));

  assert.deepEqual(pressed, ['click', 'change']);
  assert.equal(node.listeners.length, 2);
});
