import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
const line = src.split('\n').find((l) => l.includes('catch(err){console.error(err);var failCode'));

/* The submit's catch used to say "Check the connection" for EVERY failure, so a
   refused write (permissions, a bad value) read as a bad network and nobody looked
   for the real cause. It now separates the two; this runs the classification as
   written in the source against the error shapes Firestore really produces. */
const weak = (err) => new Function('err', `${/(var failCode=.*?);toast\(/.exec(line)[1]};return weakLink;`)(err);

test('a network or timeout failure is reported as a connection problem', () => {
  assert.ok(line, 'the request submit catch must exist');
  assert.equal(weak({ code: 'unavailable' }), true);
  assert.equal(weak({ code: 'deadline-exceeded' }), true);
  assert.equal(weak({ message: 'Failed to get document because the client is offline.' }), true);
  assert.equal(weak({ message: 'Transaction failed all retries.' }), true);
  assert.equal(weak(new Error('Request timed out')), true);
});

test('any other failure names its code instead of blaming the connection', () => {
  assert.equal(weak({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }), false);
  assert.equal(weak({ code: 'firestore/invalid-argument', message: 'Unsupported field value' }), false);
  assert.match(line, /'Request was not saved — '\+\(failCode\|\|failText\)/);
});
