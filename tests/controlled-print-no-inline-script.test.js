import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../public/assets/js/core/controlled-custody-print.js', import.meta.url), 'utf8');

test('controlled custody print document carries no inline script (production CSP forbids it)', () => {
  assert.ok(!/'<script>'/.test(src), 'print blob must not embed a <script>');
  assert.match(src, /fsR5ControlledPrintRuntime\(w\)/, 'the opener must drive the fitter and print');
});

test('print runtime is real code, not a template string that eats regex escapes', () => {
  assert.ok(!/var runtime=`/.test(src));
  assert.match(src, /svg\\\+xml/);
});
