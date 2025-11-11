import test from 'node:test';
import assert from 'node:assert/strict';
import actionModule from '../dist/index.js';

const {
  detectPiiWarnings,
  collectIssues,
  summarize,
  buildCommentBody
} = actionModule;

const SENTINEL = '<!-- test-sentinel -->';

function makeManifest(overrides = {}) {
  return {
    dataset: { name: 'orders' },
    schema: {
      fields: {
        id: { type: 'string', required: true },
        email: { type: 'string', pii: true }
      }
    },
    lineage: {
      consumers: [
        { type: 'service', id: 'analytics' },
        { type: 'external', id: 'vendorX' }
      ]
    },
    ...overrides
  };
}

test('detectPiiWarnings surfaces external egress warnings', () => {
  const warnings = detectPiiWarnings(makeManifest(), 'manifests/orders.json');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /external target/i);
});

test('collectIssues splits warn vs error levels', () => {
  const validation = {
    ok: false,
    results: [
      {
        name: 'core.shape',
        ok: false,
        issues: [
          { path: 'dataset.name', level: 'error', msg: 'required' },
          { path: 'governance.policy.classification', level: 'warn', msg: 'pii expected' }
        ]
      }
    ]
  };
  const { errors, warnings } = collectIssues(validation);
  assert.equal(errors.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(errors[0].path, 'dataset.name');
  assert.equal(warnings[0].level, 'warn');
});

test('summarize aggregates manifest outcomes', () => {
  const summary = summarize([
    { path: 'a', absolutePath: 'a', errors: [], warnings: [], piiWarnings: [], breakingChanges: [] },
    { path: 'b', absolutePath: 'b', errors: [{ level: 'error', message: 'boom' }], warnings: [], piiWarnings: [], breakingChanges: [] },
    { path: 'c', absolutePath: 'c', errors: [], warnings: [{ level: 'warn', message: 'heads-up' }], piiWarnings: [], breakingChanges: [{ path: 'schema.fields.email', reason: 'column dropped' }] }
  ]);
  assert.equal(summary.validatedCount, 3);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.warningsCount, 1);
  assert.equal(summary.breakingChangesCount, 1);
});

test('buildCommentBody embeds sentinel and run link', () => {
  const summary = { validatedCount: 2, passedCount: 2, failedCount: 0, warningsCount: 0, breakingChangesCount: 0 };
  const body = buildCommentBody(summary, [], 'https://example.com/run/1', SENTINEL);
  assert.match(body, /proto manifest validation/i);
  assert.match(body, /https:\/\/example.com\/run\/1/);
  assert.ok(body.includes(SENTINEL));
});
