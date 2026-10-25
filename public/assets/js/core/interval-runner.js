/* One repeating job that can be started again without ever running twice.
   The state layer polls over REST every 30s whenever realtime is not in use; that
   was started from three places, each pairing a bare setInterval with a field
   cleared elsewhere, so a start that forgot to stop first would have left two
   pollers running. start() always stops the previous one. */
export function createIntervalRunner(job, ms, { setTimer = setInterval, clearTimer = clearInterval } = {}) {
  let handle = null;
  return {
    start() {
      if (handle !== null) clearTimer(handle);
      handle = setTimer(() => { job(); }, ms);
    },
    stop() {
      if (handle === null) return;
      clearTimer(handle);
      handle = null;
    },
    isRunning: () => handle !== null,
  };
}
