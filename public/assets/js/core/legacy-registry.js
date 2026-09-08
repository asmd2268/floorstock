const modules = new Map();
// name -> the module that published it, so a second publisher can be named.
const owners = new Map();

/* Publishing a name that another module already published is what produced the
   wrapper-on-wrapper pattern this registry exists to prevent: the second module
   captured the first's global into a `canonicalX` alias, defined a pass-through
   that called back through the global, and published that over the top. Twenty-two
   such aliases had accumulated across five modules, each adding no behaviour and
   each able to return undefined silently when its capture had not resolved.

   Refusing the second publish makes that pattern impossible rather than merely
   discouraged: a name has exactly one owner, and re-exporting someone else's
   function is a startup error rather than a layer. */
export function publishLegacy(moduleName, api) {
  const safeApi = Object.freeze({ ...api });
  const conflicts = Object.keys(safeApi).filter(
    name => owners.has(name) && owners.get(name) !== moduleName,
  );
  if (conflicts.length) {
    throw new Error(
      `${moduleName} re-publishes ${conflicts.length} name(s) already owned by another module: ` +
      conflicts.map(name => `${name} (owned by ${owners.get(name)})`).join(', ') +
      '. Import the owner\'s export instead of re-publishing it.',
    );
  }
  modules.set(moduleName, safeApi);
  Object.entries(safeApi).forEach(([name, value]) => {
    owners.set(name, moduleName);
    globalThis[name] = value;
  });
  return safeApi;
}

export function invokeLegacy(name, element, args = []) {
  const handler = globalThis[name];
  if (typeof handler !== 'function') {
    throw new Error(`Application action is unavailable: ${name}`);
  }
  return handler.apply(element || globalThis, args);
}

export function legacyModuleNames() {
  return [...modules.keys()];
}

export function legacyOwnerOf(name) {
  return owners.get(name) || null;
}

export const legacyRegistry = Object.freeze({ publishLegacy, invokeLegacy, legacyModuleNames, legacyOwnerOf });
