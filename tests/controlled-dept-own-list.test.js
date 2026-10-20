import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { getElementById: (id) => (id === 'ctl-dept' ? { value: 'emergency' } : null) };

test('a department account (or Master previewing one) uses its own department, not the officer selector', async () => {
  const { fsR5ControlledDept } = await import('../public/assets/js/core/controlled-custody-data.js');
  globalThis.ctlCurrentDept = () => 'emergency';
  globalThis.fsEffectiveUser = () => ({ role: 'department', deptId: 'msw' });
  assert.equal(fsR5ControlledDept(), 'msw');
  globalThis.fsEffectiveUser = () => ({ role: 'controlled_pharmacy' });
  assert.equal(fsR5ControlledDept(), 'emergency');
});
