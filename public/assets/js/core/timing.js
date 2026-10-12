export function debounce(fn, wait) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}


/* Waits for a promise, but only up to `ms`. Returns 'slow' if it has not settled by then
   (the work carries on in the background); a real rejection still throws. */
export function waitUpTo(promise, ms) {
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(() => resolve('slow'), ms); });
  return Promise.race([promise, slow]).finally(() => clearTimeout(timer));
}
