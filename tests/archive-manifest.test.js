import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import '../public/assets/js/core/hijri-calendar.js';
import {
  coverageOf, buildArchiveManifest, archiveFileName, describeArchive, localArchiveEntry,
} from '../public/assets/js/core/archive-manifest.js';

/* Every archive downloads a file that becomes the ONLY full-detail copy of what
   it then removes. They were named with a raw timestamp, which says nothing about
   what is inside or which period it covers — indistinguishable from any other
   archive months later on a shared computer. */

globalThis.CU = { username: 'boss', tenantId: '' };

const rows = [
  { at: '2024-03-14T08:00:00.000Z' },
  { at: '2025-09-08T10:00:00.000Z' },
  { at: '2024-11-02T09:00:00.000Z' },
];

test('coverage is the real span of the rows, not the retention cutoff', () => {
  const cover = coverageOf(rows, ['at']);
  assert.equal(cover.fromDay, '2024-03-14');
  assert.equal(cover.toDay, '2025-09-08');
  assert.equal(cover.fromHijri, '1445-09');
  assert.equal(cover.toHijri, '1447-03');
});

test('the file name states what, which period, and when it was saved', () => {
  const manifest = buildArchiveManifest({ kind: 'Orders', rows, dateFields: ['at'] });
  const name = archiveFileName(manifest, 'json');
  assert.match(name, /^ASDHealth_Orders_2024-03-14_to_2025-09-08_saved_\d{4}-\d{2}-\d{2}\.json$/);
  // Sorts sensibly in a folder listing and never collides across kinds.
  assert.notEqual(name, archiveFileName(buildArchiveManifest({ kind: 'Custody-History', rows, dateFields: ['at'] }), 'json'));
});

test('a single-day archive is not named as a range', () => {
  const oneDay = [{ at: '2025-01-05T08:00:00.000Z' }, { at: '2025-01-05T19:00:00.000Z' }];
  const name = archiveFileName(buildArchiveManifest({ kind: 'Orders', rows: oneDay, dateFields: ['at'] }), 'json');
  assert.match(name, /_2025-01-05_saved_/);
  assert.ok(!/_to_/.test(name));
});

test('rows with no usable date are said so, not given a false coverage', () => {
  const manifest = buildArchiveManifest({ kind: 'Orders', rows: [{ id: 'x' }], dateFields: ['at'] });
  assert.equal(manifest.coversFrom, null);
  assert.match(archiveFileName(manifest, 'json'), /_no-dated-records_saved_/);
});

test('the same facts travel inside the file, so a renamed file is still identifiable', () => {
  const manifest = buildArchiveManifest({ kind: 'Controlled-Movements', rows, dateFields: ['at'] });
  for (const field of ['kind', 'recordCount', 'coversFrom', 'coversTo', 'savedAt', 'savedOn', 'savedOnHijri', 'savedBy']) {
    assert.ok(manifest[field] !== undefined, `${field} must be in the manifest`);
  }
  assert.equal(manifest.recordCount, 3);
  assert.equal(manifest.savedBy, 'boss');
  assert.match(manifest.savedOnHijri, /\d{4}$/, 'the Hijri save date is spelled out');
});

test('the confirmation dialog shows the same description as the file', () => {
  const manifest = buildArchiveManifest({ kind: 'Orders', rows, dateFields: ['at'] });
  const text = describeArchive(manifest, archiveFileName(manifest, 'json'));
  assert.match(text, /File: ASDHealth_Orders_/);
  assert.match(text, /Covers: 2024-03-14 → 2025-09-08/);
  assert.match(text, /Saved: \d{4}-\d{2}-\d{2}/);
  assert.match(text, /هجريًا/);
});

test('the on-device copy carries the same description', () => {
  const manifest = buildArchiveManifest({ kind: 'Orders', rows, dateFields: ['at'] });
  const entry = localArchiveEntry(manifest, { any: 'payload' });
  assert.equal(entry.count, 3);
  assert.equal(entry.coversFrom, manifest.coversFrom);
  assert.equal(entry.savedOn, manifest.savedOn);
  assert.ok(entry.id.includes('orders'));
});

test('every archive path names its files through this one helper', async () => {
  const dir = new URL('../public/assets/js/core/', import.meta.url);
  const offenders = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.js') || name === 'archive-manifest.js') continue;
    const source = await readFile(new URL(name, dir), 'utf8');
    if (!/downloadJsonFile\(|downloadExcelFile\(/.test(source)) continue;
    if (name === 'local-archive-utils.js') continue; // it defines them
    // A hand-built file name would reintroduce the timestamps this replaced.
    if (/'ASDHealth_[A-Za-z_]*'\s*\+/.test(source) || /\.json'\s*\)/.test(source)) offenders.push(name);
    assert.match(source, /archiveFileName\(/, `${name} must name files through archiveFileName`);
  }
  assert.deepEqual(offenders, []);
});
