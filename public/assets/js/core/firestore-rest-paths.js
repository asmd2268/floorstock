export function fsStateRestBase() {
  return `https://firestore.googleapis.com/v1/projects/${globalThis.FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
}
export function fsRestPath(value) {
  return String(value || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}
Object.assign(globalThis, { fsStateRestBase, fsRestPath });
