/* Tabs on the Print page that live outside the analytics module.

   The Print page has one tab bar. Its switcher used to hard-code every tab, so a
   feature that wanted a tab had to be edited into that file. A feature registers
   its tab here instead — who may see it, and what draws its panel — and the
   switcher treats it like any other. The page supplies the two elements,
   #pg-print-tab-<name> and #pg-print-panel-<name>. */

const tabs = new Map();

export function registerPrintTab(name, definition) {
  if (!/^[a-z]+$/.test(name)) throw new Error('print tab name must be lowercase letters: ' + name);
  if (typeof definition.allowed !== 'function' || typeof definition.render !== 'function') {
    throw new Error('print tab ' + name + ' needs allowed() and render()');
  }
  tabs.set(name, definition);
}

export function registeredPrintTab(name) { return tabs.get(name) || null; }
export function registeredPrintTabNames() { return [...tabs.keys()]; }
