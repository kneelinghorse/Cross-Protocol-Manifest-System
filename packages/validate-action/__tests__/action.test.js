import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import actionModule from '../dist/index.js';

const {
  detectPiiWarnings,
  collectIssues,
  summarize,
  buildCommentBody,
  __testing
} = actionModule;

const {
  runProtoValidate,
  runProtoDiff,
  prepareCliContext,
  setSummaryForTesting,
  resetSummaryForTesting,
  writeJobSummary,
  upsertPrComment,
  emitAnnotations,
  writeJsonReport
} = __testing;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const fixturesDir = path.join(__dirname, 'fixtures');
const CLI_BINARY = path.join(repoRoot, 'packages/cli/dist/proto.js');
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

test('collectIssues converts top-level error strings', () => {
  const { errors, warnings } = collectIssues({
    ok: false,
    errors: ['boom']
  });
  assert.equal(warnings.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'boom');
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

test('runProtoValidate integrates with the proto CLI binary', async () => {
  const protoContext = await prepareCliContext(CLI_BINARY);
  const manifestPath = path.join(fixturesDir, 'invalid-manifest.json');
  const outcome = await runProtoValidate(protoContext, manifestPath);
  assert.ok(outcome.errors.length > 0);
  assert.ok(outcome.errors.some((issue) => (issue.path || '').includes('dataset.name')));
});

test('runProtoDiff surfaces breaking changes from the proto CLI', async () => {
  const protoContext = await prepareCliContext(CLI_BINARY);
  const baseContent = readFileSync(path.join(repoRoot, 'test-manifest-v1.json'), 'utf8');
  const headPath = path.join(repoRoot, 'test-manifest-v2.json');
  const breaking = await runProtoDiff(protoContext, baseContent, headPath);
  assert.ok(breaking.length > 0);
  assert.ok(breaking.some((entry) => entry.path.includes('schema.fields.email.required')));
});

test('writeJobSummary pipes results into the Actions summary API', async (t) => {
  const calls = [];
  const stubSummary = {
    addHeading(text) {
      calls.push(`heading:${text}`);
      return this;
    },
    addTable(rows) {
      calls.push(`table:${rows.length}`);
      return this;
    },
    addList(items) {
      calls.push(`list:${items.length}`);
      return this;
    },
    addQuote(text) {
      calls.push(`quote:${text.length}`);
      return this;
    },
    addRaw(text) {
      calls.push(`raw:${text.trim()}`);
      return this;
    },
    async write() {
      calls.push('write');
    }
  };
  setSummaryForTesting(stubSummary);
  t.after(() => resetSummaryForTesting());
  const summary = { validatedCount: 1, passedCount: 0, failedCount: 1, warningsCount: 2, breakingChangesCount: 0 };
  const results = [
    {
      path: 'manifests/orders.json',
      absolutePath: 'manifests/orders.json',
      errors: [{ level: 'error', message: 'boom' }],
      warnings: [],
      piiWarnings: [],
      breakingChanges: []
    }
  ];
  await writeJobSummary(results, summary);
  assert.ok(calls.includes('write'));
  assert.ok(calls.some((entry) => entry.startsWith('heading:Proto Manifest Validation')));
});

test('emitAnnotations routes findings through the annotation API', () => {
  const events = [];
  emitAnnotations(
    [
      {
        path: 'manifests/orders.json',
        absolutePath: 'manifests/orders.json',
        errors: [{ level: 'error', message: 'missing id', path: 'dataset.id' }],
        warnings: [{ level: 'warn', message: 'heads-up' }],
        piiWarnings: [{ level: 'warn', message: 'pii leak' }],
        breakingChanges: [{ path: 'schema.fields.email', reason: 'column removed' }]
      }
    ],
    {
      error(message, props) {
        events.push({ type: 'error', message, file: props?.file });
      },
      warning(message, props) {
        events.push({ type: 'warning', message, file: props?.file });
      },
      notice(message) {
        events.push({ type: 'notice', message });
      }
    }
  );
  assert.equal(events.filter((event) => event.type === 'error').length, 2);
  assert.equal(events.filter((event) => event.type === 'warning').length, 2);
  assert.ok(events.every((event) => !event.file || event.file.includes('manifests/orders.json')));
});

test('writeJsonReport persists sanitized payload to disk', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-report-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const payload = {
    summary: {
      validatedCount: 1,
      passedCount: 1,
      failedCount: 0,
      warningsCount: 0,
      breakingChangesCount: 0
    },
    manifests: [
      {
        path: 'manifests/orders.json',
        errors: [],
        warnings: [],
        piiWarnings: [],
        breakingChanges: []
      }
    ]
  };
  const reportPath = await writeJsonReport(payload, dir);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.summary.validatedCount, 1);
  assert.equal(report.manifests.length, 1);
  assert.equal(report.manifests[0].path, 'manifests/orders.json');
});

test('upsertPrComment updates the sticky PR comment when the sentinel exists', async () => {
  let updatedBody = '';
  const mockOctokit = {
    rest: {
      issues: {
        listComments: () => {},
        async updateComment({ body }) {
          updatedBody = body;
        },
        async createComment() {
          throw new Error('createComment should not be called when sentinel exists');
        }
      }
    },
    async paginate() {
      return [{ id: 7, body: `Previously posted\n${SENTINEL}` }];
    }
  };
  const summary = { validatedCount: 1, passedCount: 1, failedCount: 0, warningsCount: 0, breakingChangesCount: 0 };
  await upsertPrComment({
    octokit: mockOctokit,
    owner: 'kneelinghorse',
    repo: 'CPMS',
    sentinel: SENTINEL,
    runUrl: 'https://example.com/run/1',
    summary,
    results: [],
    context: {
      payload: {
        pull_request: { number: 42 }
      }
    }
  });
  assert.ok(updatedBody.includes(SENTINEL));
  assert.match(updatedBody, /Validated/i);
});
