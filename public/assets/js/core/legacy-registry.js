const modules = new Map();

export function publishLegacy(moduleName, api) {
  const safeApi = Object.freeze({ ...api });
  modules.set(moduleName, safeApi);
  Object.entries(safeApi).forEach(([name, value]) => {
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

export const legacyRegistry = Object.freeze({ publishLegacy, invokeLegacy, legacyModuleNames });
