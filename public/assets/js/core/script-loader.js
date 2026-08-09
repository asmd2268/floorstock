const pendingScripts = new Map();

export function loadScriptOnce(key, src, test) {
  if (test && test()) return Promise.resolve();
  if (pendingScripts.has(key)) return pendingScripts.get(key);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pendingScripts.delete(key);
      reject(new Error(`${key} library failed to load`));
    };
    document.head.appendChild(script);
  });
  pendingScripts.set(key, promise);
  return promise;
}

globalThis.loadScriptOnce = loadScriptOnce;
