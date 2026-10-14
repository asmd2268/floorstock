import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toLatinDigits, withLatinNumerals } from '../public/assets/js/core/latin-digits.js';

/* The app must show 0-9 on a device set to Arabic, whatever the field or format. */
const INDIC = /[٠-٩۰-۹]/;

test('Arabic-Indic and Persian digits become Western digits', () => {
  assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  assert.equal(toLatinDigits('٢٠٢٦-١٠-١٤'), '2026-10-14');
  assert.equal(toLatinDigits('١٬٢٣٤٫٥'), '1,234.5');
  assert.equal(toLatinDigits('Room ٣ — دواء ٥'), 'Room 3 — دواء 5');
  assert.equal(toLatinDigits(null), '');
});

test('every locale call is given the Latin numbering system', () => {
  assert.deepEqual(withLatinNumerals('ar-SA'), ['ar-SA-u-nu-latn']);
  assert.deepEqual(withLatinNumerals(undefined), ['en-GB-u-nu-latn']);
  assert.deepEqual(withLatinNumerals('en-u-ca-islamic-umalqura'), ['en-u-ca-islamic-umalqura-nu-latn']);
  assert.deepEqual(withLatinNumerals('en-GB-u-nu-arab'), ['en-GB-u-nu-arab']);
});

test('Intl and toLocale* print Western digits even for Arabic locales', () => {
  const when = new Date(Date.UTC(2026, 9, 14, 12, 30));
  assert.ok(INDIC.test((1234.5).toLocaleString('ar-SA-u-nu-arab')), 'sanity: Arabic digits exist before the patch');
  for (const locale of ['ar-SA', 'ar-EG', 'ar', undefined, 'en-SA']) {
    assert.ok(!INDIC.test((1234.5).toLocaleString(locale)), 'number ' + locale);
    assert.ok(!INDIC.test(when.toLocaleString(locale)), 'date-time ' + locale);
    assert.ok(!INDIC.test(when.toLocaleDateString(locale)), 'date ' + locale);
    assert.ok(!INDIC.test(new Intl.NumberFormat(locale).format(123456)), 'NumberFormat ' + locale);
    assert.ok(!INDIC.test(new Intl.DateTimeFormat(locale).format(when)), 'DateTimeFormat ' + locale);
  }
  /* The Hijri helpers name their calendar explicitly and must keep working. */
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(when);
  assert.ok(parts.some((part) => part.type === 'year' && Number(part.value) > 1400));
});
