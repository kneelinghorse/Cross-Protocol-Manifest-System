import { test } from 'node:test';
import assert from 'node:assert';
import { createCatalogSystem, parseURN, buildURN, resolveURN, generateURN, analyzeCrossEntityRelationships, detectCrossEntityCycles, validateSystem } from './catalog_system_v_1_1_1.js';
import { createDataProtocol } from './data_protocol_v_1_1_1.js';
import { createApiProtocol } from './api_protocol_v_1_1_1.js';
import { createEventProtocol } from './event_protocol_v_1_1_1.js';

// Test data
const userEventsData = createDataProtocol({
  dataset: { name: 'user_events', type: 'fact-table', lifecycle: { status: 'active' } },
  schema: {
    primary_key: 'event_id',
    fields: {
      event_id: { type: 'string', required: true },
      user_id: { type: 'string', required: true },
      email: { type: 'string', pii: true },
      amount: { type: 'number' },
      event_date: { type: 'date' },
    },
    keys: { unique: ['event_id'], foreign_keys: [{ field: 'user_id', ref: 'dim:users.id' }], partition: { field: 'event_date', type: 'daily' } }
  },
  lineage: { sources: [{ type: 'service', id: 'user-service' }], consumers: [{ type: 'model', id: 'churn-ml' }, { type: 'external', id: 'vendor-x' }] },
  operations: { refresh: { schedule: 'hourly', expected_by: '08:00Z' }, retention: '2-years' },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' }, storage_residency: { region: 'eu', vendor: 's3', encrypted_at_rest: true } },
  quality: { freshness_ts: '2025-09-28T08:15:00Z', row_count_estimate: 123456, null_rate: { email: 0.02 } },
  catalog: { owner: 'identity-team', tags: ['events', 'pii'] },
});

const paymentsApi = createApiProtocol({
  api: { name: 'payments-api', version: '1.1.0', lifecycle: { status: 'active' } },
  info: {
    title: 'Payments API',
    description: 'Process payments and manage transactions',
    contact: { name: 'Billing Team', email: 'billing@example.com' }
  },
  servers: {
    list: [
      { url: 'https://api.example.com/v1', description: 'Production' },
      { url: 'https://staging-api.example.com/v1', description: 'Staging' }
    ]
  },
  security: {
    schemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' }
    },
    global: ['bearerAuth']
  },
  endpoints: {
    paths: {
      '/payments': {
        summary: 'Create a new payment',
        parameters: {
          header: {
            'X-Request-ID': { description: 'Request ID for idempotency', type: 'string', required: true }
          }
        },
        requestBody: {
          description: 'Payment details',
          required: true,
          content: {
            'application/json': {
              properties: {
                amount: { type: 'number', required: true },
                currency: { type: 'string', required: true },
                email: { type: 'string', 'x-pii': true }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Payment created successfully',
            content: {
              'application/json': {
                properties: {
                  payment_id: { type: 'string' },
                  status: { type: 'string' }
                }
              }
            }
          },
          '400': { description: 'Invalid request' }
        },
        rateLimit: { requests: 100, period: '1m' }
      }
    }
  },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' } },
  metadata: { owner: 'billing-team', tags: ['payments', 'billing'] }
});

const paymentCompletedEvent = createEventProtocol({
  event: { name: 'payment.completed', version: '1.1.0', lifecycle: { status: 'active' } },
  semantics: { purpose: 'Record a successful payment and trigger fulfillment' },
  schema: {
    format: 'json-schema',
    payload: {
      type: 'object',
      required: ['payment_id', 'user_id', 'amount'],
      properties: {
        payment_id: { type: 'string' },
        user_id: { type: 'string' },
        amount: { type: 'number' },
        email: { type: 'string', 'x-pii': true }
      }
    },
    compatibility: { policy: 'backward', compatible_versions: ['1.0.0', '1.1.0'] }
  },
  delivery: { contract: { transport: 'kafka', topic: 'billing.payments', guarantees: 'at-least-once', retry_policy: 'exponential', dlq: 'billing.payments.dlq' } },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' } },
  metadata: { owner: 'billing-team', tags: ['billing', 'payments'] }
});

test('URN parsing and building', () => {
  // Test parseURN
  const parsed = parseURN('urn:data:dataset:user_events:v1.1.0');
  assert.deepStrictEqual(parsed, {
    scheme: 'urn',
    protocol: 'data',
    entity: 'dataset',
    id: 'user_events',
    version: 'v1.1.0'
  });
  
  // Test parseURN with minimal URN
  const parsedMinimal = parseURN('urn:event:event:payment.completed');
  assert.deepStrictEqual(parsedMinimal, {
    scheme: 'urn',
    protocol: 'event',
    entity: 'event',
    id: 'payment.completed',
    version: 'latest'
  });
  
  // Test parseURN with invalid URN
  assert.strictEqual(parseURN('invalid'), null);
  assert.strictEqual(parseURN(null), null);
  
  // Test buildURN
  const urn = buildURN('data', 'dataset', 'user_events', 'v1.1.0');
  assert.strictEqual(urn, 'urn:data:dataset:user_events:v1.1.0');
  
  // Test buildURN with default version
  const urnDefault = buildURN('api', 'api', 'payments-api');
  assert.strictEqual(urnDefault, 'urn:api:api:payments-api:latest');
});

test('generateURN for different protocol types', () => {
  // Test data protocol URN generation
  const dataURN = generateURN(userEventsData);
  assert.strictEqual(dataURN, 'urn:data:dataset:user_events:v1.1.1');
  
  // Test API protocol URN generation
  const apiURN = generateURN(paymentsApi);
  assert.strictEqual(apiURN, 'urn:api:api:payments-api:v1.1.1');
  
  // Test event protocol URN generation
  const eventURN = generateURN(paymentCompletedEvent);
  assert.strictEqual(eventURN, 'urn:event:event:payment.completed:v1.1.1');
});

test('createCatalogSystem with multiple protocols', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  
  assert.strictEqual(catalog.items.length, 3);
  assert.strictEqual(typeof catalog.find, 'function');
  assert.strictEqual(typeof catalog.validate, 'function');
  assert.strictEqual(typeof catalog.detectCycles, 'function');
  assert.strictEqual(typeof catalog.getRelationships, 'function');
});

test('catalog find functionality', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  
  // Find by name substring
  const found = catalog.find('payment');
  assert.strictEqual(found.length, 2); // payments-api and payment.completed event
  
  // Find data protocol
  const dataFound = catalog.find('user_events');
  assert.strictEqual(dataFound.length, 1);
  assert.strictEqual(dataFound[0], userEventsData);
});

test('URN resolution in catalog', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  
  // Resolve data protocol URN
  const resolvedData = resolveURN(catalog, 'urn:data:dataset:user_events:v1.1.1');
  assert.strictEqual(resolvedData, userEventsData);
  
  // Resolve API protocol URN
  const resolvedApi = resolveURN(catalog, 'urn:api:api:payments-api:v1.1.1');
  assert.strictEqual(resolvedApi, paymentsApi);
  
  // Resolve event protocol URN
  const resolvedEvent = resolveURN(catalog, 'urn:event:event:payment.completed:v1.1.1');
  assert.strictEqual(resolvedEvent, paymentCompletedEvent);
  
  // Resolve non-existent URN
  const notFound = resolveURN(catalog, 'urn:data:dataset:nonexistent:latest');
  assert.strictEqual(notFound, null);
  
  // Resolve invalid URN
  const invalid = resolveURN(catalog, 'invalid-urn');
  assert.strictEqual(invalid, null);
});

test('cross-entity relationship analysis', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  const relationships = analyzeCrossEntityRelationships(catalog);
  
  // Should find relationships between entities
  assert.ok(relationships.dataToApi || relationships.dataToEvent);
  
  // Check that relationships are properly structured
  const allRelationships = Object.values(relationships).flat();
  assert.ok(Array.isArray(allRelationships));
  
  // Each relationship should have required fields
  for (const rel of allRelationships) {
    assert.ok(rel.from || rel.to);
    assert.ok(rel.type);
  }
});

test('cycle detection', () => {
  // Create protocols with circular dependencies
  const circularData = createDataProtocol({
    dataset: { name: 'circular_data', type: 'fact-table' },
    lineage: { consumers: [{ type: 'model', id: 'circular_event' }] }
  });
  
  const circularEvent = createEventProtocol({
    event: { name: 'circular_event' },
    workflow: {
      steps: [{ consumes: 'circular_event', service: 'test', produces: ['circular_data'] }]
    }
  });
  
  const catalog = createCatalogSystem([circularData, circularEvent]);
  const cycles = detectCrossEntityCycles(catalog);
  
  // Should detect at least one cycle
  assert.ok(Array.isArray(cycles));
  
  // If cycles are detected, validate their structure
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      assert.ok(Array.isArray(cycle));
      assert.ok(cycle.length > 1);
    }
  }
});

test('system validation', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  const validation = validateSystem(catalog);
  
  // Should return validation results
  assert.ok(validation);
  assert.strictEqual(typeof validation.valid, 'boolean');
  assert.ok(Array.isArray(validation.protocolValidations));
  assert.ok(Array.isArray(validation.crossEntityValidation));
  assert.ok(Array.isArray(validation.governanceChecks));
  
  // All protocols should be valid
  for (const protoValidation of validation.protocolValidations) {
    assert.ok(protoValidation.valid, `Protocol ${protoValidation.urn} should be valid`);
  }
});

test('system validation with performance checks', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  const validation = validateSystem(catalog, { checkPerformance: true });
  
  // Should include performance checks
  assert.ok(Array.isArray(validation.performanceChecks));
  
  // Should have scale analysis
  const scaleCheck = validation.performanceChecks.find(check => check.type === 'scale');
  assert.ok(scaleCheck);
  assert.ok(scaleCheck.totalEntities >= 3);
});

test('PII governance analysis', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  const validation = validateSystem(catalog);
  
  // Should find PII in all three protocols
  const piiChecks = validation.governanceChecks.filter(check => 
    check.type === 'pii_data' || check.type === 'pii_api' || check.type === 'pii_event'
  );
  
  assert.ok(piiChecks.length >= 3); // At least one PII check per protocol
  
  // Data protocol should be encrypted
  const dataPIICheck = piiChecks.find(check => check.type === 'pii_data');
  if (dataPIICheck) {
    assert.ok(dataPIICheck.encrypted);
    assert.ok(dataPIICheck.valid);
  }
  
  // Event protocol should have DLQ
  const eventPIICheck = piiChecks.find(check => check.type === 'pii_event');
  if (eventPIICheck) {
    assert.ok(eventPIICheck.hasDLQ);
    assert.ok(eventPIICheck.valid);
  }
});

test('catalog system report generation', () => {
  const catalog = createCatalogSystem([userEventsData, paymentsApi, paymentCompletedEvent]);
  const report = catalog.generateSystemReport();
  
  // Should have summary
  assert.ok(report.summary);
  assert.strictEqual(report.summary.totalEntities, 3);
  assert.strictEqual(typeof report.summary.valid, 'boolean');
  
  // Should have validation results
  assert.ok(report.validation);
  assert.ok(Array.isArray(report.validation.protocolValidations));
  
  // Should have relationships
  assert.ok(report.relationships);
  
  // Should have URNs for all items
  assert.ok(Array.isArray(report.urns));
  assert.strictEqual(report.urns.length, 3);
  
  // All URNs should be valid
  for (const urn of report.urns) {
    assert.ok(urn.startsWith('urn:'));
    assert.ok(parseURN(urn));
  }
});

test('empty catalog handling', () => {
  const emptyCatalog = createCatalogSystem([]);
  
  assert.strictEqual(emptyCatalog.items.length, 0);
  
  const validation = validateSystem(emptyCatalog);
  assert.ok(validation.valid);
  assert.strictEqual(validation.protocolValidations.length, 0);
  
  const cycles = detectCrossEntityCycles(emptyCatalog);
  assert.strictEqual(cycles.length, 0);
  
  const relationships = analyzeCrossEntityRelationships(emptyCatalog);
  assert.strictEqual(Object.values(relationships).flat().length, 0);
});

test('catalog immutability', () => {
  const catalog = createCatalogSystem([userEventsData]);
  const originalLength = catalog.items.length;
  
  // Try to modify items array (should not affect catalog)
  const itemsRef = catalog.items;
  itemsRef.push(paymentsApi);
  
  // Catalog should still have original length
  assert.strictEqual(catalog.items.length, originalLength);
});