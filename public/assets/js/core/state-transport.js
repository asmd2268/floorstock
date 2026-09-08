/* The state transport port.

   Every state read and write exists twice: once over the Firestore REST API and
   once over the Firestore SDK. That duplication is deliberate and stays — the
   REST path is the Safari cold-start mitigation and the documented fallback when
   the SDK is unavailable or rejects a write. What did not need to stay is the
   transport SELECTION rule being spelled out at each call site inside a 77 KB
   module, where "which transport, and what happens when it fails" was answered
   independently in several places.

   This module owns that one rule. The two implementations are registered by the
   module that owns the Firestore plumbing; callers ask for `load`, `set`,
   `remove` or `subscribe` and never name a transport.

   The port is intentionally small. It is not an abstraction over Firestore — it
   is the place the REST/SDK choice is made, once. */

const implementations = { rest: null, sdk: null };
const state = {
  // Which transport writes go over. Reads pick per call; writes are sticky,
  // because once the SDK has rejected a write it will usually keep rejecting.
  writeTransport: 'sdk',
  onFallback: null,
};

export function registerStateTransport(name, implementation) {
  if (name !== 'rest' && name !== 'sdk') throw new Error(`Unknown state transport: ${name}`);
  implementations[name] = implementation;
}

export function stateTransportReady() {
  return !!implementations.rest;
}

export function writeTransportName() {
  return state.writeTransport;
}

/* Called when the SDK is unavailable entirely (no FB_DB) or has just failed.
   Exposed so the owning module can report the switch in its own vocabulary. */
export function onTransportFallback(handler) {
  state.onFallback = typeof handler === 'function' ? handler : null;
}

function sdkAvailable() {
  return !!globalThis.FB_DB && !!implementations.sdk;
}

function fallBackToRest(operation, error) {
  if (state.writeTransport !== 'rest') {
    state.writeTransport = 'rest';
    if (state.onFallback) state.onFallback(operation, error);
  }
}

export function resetWriteTransport() {
  state.writeTransport = sdkAvailable() ? 'sdk' : 'rest';
}

/* One rule, applied to both mutating operations: REST if that is already the
   chosen transport or the SDK is absent; otherwise try the SDK once and switch
   permanently to REST if it fails. */
async function mutate(operation, args) {
  if (state.writeTransport === 'rest' || !sdkAvailable()) {
    return implementations.rest[operation](...args);
  }
  try {
    return await implementations.sdk[operation](...args);
  } catch (error) {
    fallBackToRest(operation, error);
    return implementations.rest[operation](...args);
  }
}

export function setState(key, value) {
  return mutate('set', [key, value]);
}

export function removeState(key) {
  return mutate('remove', [key]);
}

/* Reads choose per call rather than sticking: a cold load prefers REST for its
   latency characteristics and falls back to the SDK, which is the opposite
   preference from writes and is why the two are not sharing one setting. */
export async function loadState(profile, timeout) {
  const preferred = implementations.rest;
  try {
    return await timeout(preferred.load(profile), 'Floor Stock REST data request timed out.');
  } catch (restError) {
    if (!sdkAvailable()) throw restError;
    console.warn('Primary Floor Stock REST load failed; trying Firestore SDK.', restError);
    return timeout(implementations.sdk.load(profile), 'Floor Stock SDK data request timed out.');
  }
}

Object.assign(globalThis, {
  registerStateTransport,
  stateTransportReady,
  writeTransportName,
  onTransportFallback,
  resetWriteTransport,
  setState,
  removeState,
  loadState,
});
