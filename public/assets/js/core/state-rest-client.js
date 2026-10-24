/* The REST calls the state loader makes to Firestore, with their collaborators
   passed in. Scoped roles cannot use the SDK's list or realtime calls, so every
   read and write for them goes through here, which makes the three things below
   worth testing without a browser, a session or a network:

   - the App Check token is attached when there is one and omitted, never fatal,
     when there is not (one retry, because a brief connectivity blip should not
     leave a whole session's REST calls unverified);
   - each request carries a fresh ID token and the JSON content type;
   - listing a collection follows its pages and gives up after a bounded number. */

const APP_CHECK_RETRY_MS = 300;
const MAX_LIST_PAGES = 20;

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function stateAppCheckToken(appCheck, wait = pause) {
  if (!appCheck || typeof appCheck.getToken !== 'function') return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await appCheck.getToken(false);
      const token = (result && result.token) || null;
      if (token) return token;
    } catch (error) {
      if (attempt === 1) console.warn('Firebase App Check token unavailable for REST request.', error);
    }
    if (attempt === 0) await wait(APP_CHECK_RETRY_MS);
  }
  return null;
}

/* Every dependency is a function so it is read when a request is made: the auth
   session, App Check and the fetch helper do not all exist when this module loads. */
export function createStateRestClient({ authToken, appCheck, fetchJson, restBase, restPath, apiKey, wait }) {
  async function request(url, options, timeoutMs) {
    const token = await authToken(false);
    const appCheckToken = await stateAppCheckToken(appCheck(), wait);
    const next = options || {};
    next.headers = Object.assign({}, next.headers || {}, {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    });
    if (appCheckToken) next.headers['X-Firebase-AppCheck'] = appCheckToken;
    return fetchJson(url, next, timeoutMs || 12000);
  }

  async function listCollection(collectionId) {
    let documents = [];
    let pageToken = '';
    let pages = 0;
    do {
      let url = restBase() + '/' + restPath(collectionId) + '?pageSize=300&key=' + encodeURIComponent(apiKey());
      if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
      const response = await request(url, { method: 'GET' }, 12000);
      const payload = response.payload || {};
      if (Array.isArray(payload.documents)) documents = documents.concat(payload.documents);
      pageToken = payload.nextPageToken || '';
      pages += 1;
      if (pages > MAX_LIST_PAGES) throw new Error('Firestore REST pagination exceeded the safety limit.');
    } while (pageToken);
    return documents;
  }

  return { request, listCollection };
}
