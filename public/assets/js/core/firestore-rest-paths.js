export function fsStateRestBase() {
  try {
    const host = String(location.hostname || '').toLowerCase();
    const emulator = (host === '127.0.0.1' || host === 'localhost')
      && new URLSearchParams(location.search || '').get('emulator') === '1';
    if (emulator) {
      return 'http://127.0.0.1:8080/v1/projects/demo-floorstock-emulator/databases/(default)/documents';
    }
  } catch (_) { /* fall through to production REST */ }
  return `https://firestore.googleapis.com/v1/projects/${globalThis.FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
}
export function fsRestPath(value) {
  return String(value || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}
Object.assign(globalThis, { fsStateRestBase, fsRestPath });
