import assert from 'node:assert/strict';
import test from 'node:test';

await import('../public/assets/js/core/department-note-schema.js');
await import('../public/assets/js/core/department-note-utils.js');
await import('../public/assets/js/core/department-note-store.js');

test('Department Notes schema exposes only supported types and statuses', () => {
  assert.deepEqual(Object.keys(globalThis.NOTE_TYPE_LABELS), ['classification', 'request', 'missing', 'other']);
  assert.deepEqual(Object.keys(globalThis.NOTE_STATUS_LABELS), ['open', 'urgent', 'resolved']);
  assert.equal(Object.isFrozen(globalThis.NOTE_TYPE_LABELS), true);
  assert.equal(Object.isFrozen(globalThis.NOTE_STATUS_LABELS), true);
});

test('Department Notes utilities escape content and normalize invalid values', () => {
  const utils = globalThis.asdhDepartmentNoteUtils;
  assert.equal(utils.noteEsc('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  assert.equal(utils.noteStatus('invalid'), 'open');
  assert.equal(utils.noteStatus('urgent'), 'urgent');
  assert.equal(utils.noteType('invalid'), 'other');
  assert.equal(utils.noteType('request'), 'request');
});

test('Department Notes storage delegates to the central state adapter', () => {
  const calls = [];
  globalThis.S = {
    g(key){ calls.push(['get', key]); return [{ id: 'n1' }]; },
    s(key, value){ calls.push(['set', key, value]); return true; },
  };
  assert.deepEqual(globalThis.asdhDepartmentNoteStore.getNotes(), [{ id: 'n1' }]);
  assert.equal(globalThis.asdhDepartmentNoteStore.setNotes([{ id: 'n2' }]), true);
  assert.deepEqual(calls, [['get', 'dept_notes'], ['set', 'dept_notes', [{ id: 'n2' }]]]);
  delete globalThis.S;
});
