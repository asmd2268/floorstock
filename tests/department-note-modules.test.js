import assert from 'node:assert/strict';
import test from 'node:test';

await import('../public/assets/js/core/department-note-schema.js');
await import('../public/assets/js/core/department-note-utils.js');

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
