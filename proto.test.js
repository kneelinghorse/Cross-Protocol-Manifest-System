import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { main, parseArgs, loadManifest, formatOutput } from './proto.js';

test('parseArgs - basic command parsing', () => {
  const result = parseArgs(['validate', '--manifest=test.json']);
  assert.strictEqual(result.command, 'validate');
  assert.strictEqual(result.options.manifest, 'test.json');
  assert.strictEqual(result.errors.length, 0);
});

test('parseArgs - query command with expression', () => {
  const result = parseArgs(['query', 'field:=:value', '--type=data']);
  assert.strictEqual(result.command, 'query');
  assert.strictEqual(result.subcommand, 'field:=:value');
  assert.strictEqual(result.options.type, 'data');
});

test('parseArgs - graph command with manifest', () => {
  const result = parseArgs(['graph', 'manifest.json', '--format=mermaid']);
  assert.strictEqual(result.command, 'graph');
  assert.strictEqual(result.subcommand, 'manifest.json');
  assert.strictEqual(result.options.format, 'mermaid');
});

test('parseArgs - handles unknown arguments', () => {
  const result = parseArgs(['validate', 'unexpected-arg']);
  assert.strictEqual(result.errors.length, 1);
  assert.ok(result.errors[0].includes('Unexpected argument'));
});

test('loadManifest - loads valid JSON file', () => {
  const manifest = loadManifest('manifests/test-agent.json');
  assert.strictEqual(manifest.type, 'agent');
  assert.ok(manifest.capabilities.tools.includes('refund'));
});

test('loadManifest - throws error for missing file', () => {
  assert.throws(() => {
    loadManifest('nonexistent.json');
  }, /Manifest file not found/);
});

test('loadManifest - throws error for invalid JSON', () => {
  // Create a temporary invalid JSON file
  fs.writeFileSync('invalid.json', '{invalid json}');
  
  assert.throws(() => {
    loadManifest('invalid.json');
  }, /Invalid JSON/);
  
  fs.unlinkSync('invalid.json');
});

test('formatOutput - JSON format', () => {
  const data = { test: 'value', number: 42 };
  const result = formatOutput(data, 'json');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.test, 'value');
  assert.strictEqual(parsed.number, 42);
});

test('formatOutput - text format for string', () => {
  const result = formatOutput('test string', 'text');
  assert.strictEqual(result, 'test string');
});

test('CLI query command - finds PII data', async () => {
  const exitCode = await main(['query', 'governance.policy.classification:=:pii']);
  assert.strictEqual(exitCode, 0);
});

test('CLI query command - finds agent with refund capability', async () => {
  const exitCode = await main(['query', 'capabilities.tools:contains:refund', '--type=agent']);
  assert.strictEqual(exitCode, 0);
});

test('CLI graph command - generates Mermaid output', async () => {
  const exitCode = await main(['graph', 'manifests/test-agent.json', '--format=mermaid']);
  assert.strictEqual(exitCode, 0);
});

test('CLI graph command - generates JSON output', async () => {
  const exitCode = await main(['graph', 'manifests/test-agent.json', '--format=json']);
  assert.strictEqual(exitCode, 0);
});

test('CLI graph command - generates DOT output', async () => {
  const exitCode = await main(['graph', 'manifests/test-agent.json', '--format=dot']);
  assert.strictEqual(exitCode, 0);
});

test('CLI help command', async () => {
  const exitCode = await main(['--help']);
  assert.strictEqual(exitCode, 0);
});

test('CLI validate command', async () => {
  const exitCode = await main(['validate', '--manifest=manifests/test-agent.json']);
  assert.strictEqual(exitCode, 0);
});

test('CLI diff command', async () => {
  const exitCode = await main(['diff', '--from=manifests/test-agent.json', '--to=manifests/test-data.json']);
  assert.strictEqual(exitCode, 0);
});

test('CLI generate migration command', async () => {
  const exitCode = await main(['generate', 'migration', '--from=manifests/test-agent.json', '--to=manifests/test-data.json']);
  assert.strictEqual(exitCode, 0);
});

test('CLI handles unknown command', async () => {
  const exitCode = await main(['unknown']);
  assert.strictEqual(exitCode, 1);
});

test('CLI handles missing required options', async () => {
  const exitCode = await main(['validate']);
  assert.strictEqual(exitCode, 1);
});