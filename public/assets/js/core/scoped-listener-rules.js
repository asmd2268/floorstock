/* Two rules for a role that reads ~40 individual documents through realtime
   listeners instead of one collection snapshot. Both exist because of a screen
   that flickered, and both are pure enough to test without Firestore.

   1. The OPENING WAVE. Each listener delivers its first snapshot on its own
      schedule, and every one used to ask for a render, so the page was drawn again
      and again over the first seconds, each time from a different partly-arrived
      state: a badge counting pending custody rows showed 2, then 0, then 2. Master
      never saw it because it reads the whole collection in one snapshot. So the
      opening wave is one arrival: the first render waits until every listener has
      spoken, or until a deadline, so one slow or denied document cannot hold the
      page back. After that, each change refreshes as it always did.

   2. A "not found" that came from the empty local cache. A document Firestore has
      never cached can fire an initial exists:false snapshot straight from the
      cache before the real server answer arrives. The cold load already filled the
      cache with real data, so such a snapshot must never blank a key we hold; wait
      for the server-confirmed one. A genuine deletion still lands right after. */

export function createOpeningWave({ count, deadlineMs, onSettled, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let remaining = count;
  let settled = false;
  let deadline = null;

  function settle() {
    if (settled) return;
    settled = true;
    clearTimer(deadline);
    onSettled();
  }
  deadline = setTimer(settle, deadlineMs);

  return {
    arrived() {
      if (settled) return;
      remaining -= 1;
      if (remaining <= 0) settle();
    },
    isSettled: () => settled,
  };
}

/* What a listener snapshot does to the cache. Returns null when the snapshot must
   be ignored, otherwise { changed } after writing the new value into `cache`. */
export function applySnapshotToCache(cache, key, snapshot, valuesEqual) {
  const held = Object.prototype.hasOwnProperty.call(cache, key);
  if (snapshot.metadata.fromCache && !snapshot.exists && held) return null;
  const next = snapshot.exists ? snapshot.data().value : null;
  const changed = !valuesEqual(cache[key], next);
  if (changed) cache[key] = next;
  return { changed };
}
