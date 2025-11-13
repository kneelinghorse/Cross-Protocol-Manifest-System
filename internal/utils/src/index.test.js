import test from 'node:test';
import assert from 'node:assert/strict';

import {
  jsonCanon,
  hash,
  dget,
  dset,
  registerValidator,
  runValidators,
  parseQuery
} from './index.js';

test('jsonCanon produces deterministic output for nested objects', () => {
  const manifestA = { nested: { z: 0, a: [2, 1] }, b: 'two', a: 1 };
  const manifestB = { a: 1, b: 'two', nested: { a: [2, 1], z: 0 } };

  const canonicalA = jsonCanon(manifestA);
  const canonicalB = jsonCanon(manifestB);

  assert.strictEqual(
    canonicalA,
    '{"a":1,"b":"two","nested":{"a":[2,1],"z":0}}'
  );
  assert.strictEqual(canonicalA, canonicalB);
});

test('hash supports fnv1a and sha256 algorithms', () => {
  assert.strictEqual(hash('hello', 'fnv1a'), 'a82fb4a1');
  assert.strictEqual(
    hash('hello', 'sha256'),
    'b452a2c54024820506dc07eb9591b04ccd7c6cf330ace779d6c843b48125cf38'
  );
  assert.throws(() => hash('hello', 'md5'), /Unsupported hash algorithm/);
});

test('dget reads array paths and dset preserves immutability', () => {
  const manifest = {
    schema: {
      fields: [
        { name: 'id' },
        { name: 'email' }
      ]
    }
  };

  assert.strictEqual(dget(manifest, 'schema.fields[1].name'), 'email');

  const updated = dset(manifest, 'schema.fields[0].required', true);
  assert.notStrictEqual(updated, manifest);
  assert.strictEqual(updated.schema.fields[0].required, true);
  assert.strictEqual(manifest.schema.fields[0].required, undefined);
});

test('runValidators aggregates async validator results and errors', async () => {
  const validatorName = `test-validator-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  registerValidator(validatorName, async (manifest) => {
    const ok = manifest?.stub === true;
    return ok
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['stub flag missing'] };
  });

  const failing = await runValidators({}, [validatorName]);
  assert.strictEqual(failing.valid, false);
  assert.ok(failing.errors.includes('stub flag missing'));
  assert.strictEqual(failing.validatorResults[validatorName].valid, false);

  const missing = await runValidators({}, ['does-not-exist']);
  assert.strictEqual(missing.valid, false);
  assert.ok(missing.errors.some((err) => err.includes('Validator not found')));

  const throwingName = `throws-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  registerValidator(throwingName, () => {
    throw new Error('boom');
  });

  const thrown = await runValidators({}, [throwingName]);
  assert.strictEqual(thrown.valid, false);
  assert.ok(thrown.errors.some((err) => err.includes('boom')));
});

test('parseQuery supports equality, contains, and numeric operators', () => {
  const manifest = {
    capabilities: { tools: ['refund', 'escalate'] },
    metadata: { description: 'Handles VIP escalations' },
    stats: { latency_ms: 42 }
  };

  assert.strictEqual(parseQuery('capabilities.tools:contains:refund')(manifest), true);
  assert.strictEqual(parseQuery('metadata.description:contains:VIP')(manifest), true);
  assert.strictEqual(parseQuery('stats.latency_ms:>=:40')(manifest), true);
  assert.strictEqual(parseQuery('stats.latency_ms:<:40')(manifest), false);
  assert.strictEqual(
    parseQuery('metadata.description:=:Handles VIP escalations')(manifest),
    true
  );
});

test('parseQuery rejects malformed expressions and operators', () => {
  assert.throws(() => parseQuery('invalid'), /Invalid query expression/);
  assert.throws(() => parseQuery('path:badop:value'), /Invalid operator/);
});
