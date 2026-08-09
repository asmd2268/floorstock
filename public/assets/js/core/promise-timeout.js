export function withTimeout(promise, milliseconds, message) {
  let timer;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

globalThis.withTimeout = withTimeout;
