import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateGB, formatDateTimeGB } from '../public/assets/js/core/date-format.js';

const dates = ['2026-01-05T09:07:00Z', '2026-12-31T23:59:00Z', '2027-02-28T00:00:00Z', '2024-02-29T12:30:00Z', '1999-07-04T18:45:00Z'].map((v) => new Date(v));

test('formatDateGB matches toLocaleDateString for the same options', () => {
  dates.forEach((d) => assert.equal(formatDateGB(d), d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })));
});

test('formatDateTimeGB matches toLocaleString for the same options', () => {
  dates.forEach((d) => assert.equal(formatDateTimeGB(d), d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })));
});

test('the output has the DD/MM/YYYY shape', () => {
  assert.match(formatDateGB(new Date('2026-03-04T12:00:00Z')), /^\d{2}\/\d{2}\/\d{4}$/);
});
