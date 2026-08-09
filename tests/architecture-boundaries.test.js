import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('architecture boundary document and single entrypoint exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'ARCHITECTURE.md')));
  assert.ok(fs.existsSync(path.join(root, 'public/assets/js/main.js')));
  assert.equal(fs.existsSync(path.join(root, 'public/assets/js/app.js')), false);
});

test('core modules do not import feature modules', () => {
  const core = path.join(root, 'public/assets/js/core');
  for (const file of fs.readdirSync(core).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(core, file), 'utf8');
    assert.doesNotMatch(source, /from ['"]\.\/modules\//, file);
    assert.doesNotMatch(source, /from ['"]\.\.\/modules\//, file);
  }
});

test('Firebase client configuration has one source of truth', () => {
  const config = fs.readFileSync(path.join(root, 'public/assets/js/core/firebase-config.js'), 'utf8');
  const application = fs.readFileSync(path.join(root, 'public/assets/js/modules/03-core-application-firebase-state-auth.js'), 'utf8');
  assert.match(config, /projectId:\s*['"]floorstock-6ac2d['"]/);
  assert.doesNotMatch(application, /apiKey:\s*['"]AIza/);
});
