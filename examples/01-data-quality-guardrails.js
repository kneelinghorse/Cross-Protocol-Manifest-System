#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createDataProtocol, createDataCatalog } = await loadModule(
  '@cpms/data',
  '../../data_protocol_v_1_1_1.js'
);

/**
 * Scenario: tighten checkout dataset governance.
 * - Validate manifest
 * - Compare revisions and generate migration hints
 * - Flag risky PII egress via the catalog helper
 */
const logSection = (title) => {
  console.log(`\n=== ${title} ===`);
};

const checkoutOrders = createDataProtocol({
  version: '1.1.1',
  dataset: {
    name: 'checkout_orders',
    type: 'fact-table',
    description: 'Normalized checkout facts feeding fraud, finance, and merchandising',
    lifecycle: { status: 'active' }
  },
  schema: {
    primary_key: 'order_id',
    fields: {
      order_id: { type: 'string', required: true, description: 'Stable order identifier' },
      user_id: { type: 'string', required: true, description: 'Account or guest identifier' },
      email: { type: 'string', pii: true, description: 'Customer email for receipts' },
      country: { type: 'string', description: 'Destination country code' },
      total_amount: { type: 'number', description: 'Order total in cents' },
      status: { type: 'string', description: 'Current fulfillment status' },
      placed_at: { type: 'string', description: 'ISO-8601 timestamp', required: true }
    },
    keys: {
      unique: ['order_id'],
      foreign_keys: [
        { field: 'user_id', ref: 'urn:proto:data:core_users@1.0.0' }
      ],
      partition: { field: 'placed_at', type: 'daily' }
    }
  },
  lineage: {
    sources: [
      { type: 'api', id: 'urn:proto:api:checkout-api@1.0.0' }
    ],
    consumers: [
      { type: 'model', id: 'urn:proto:agent:fraud-screen@1.2.0' }
    ]
  },
  governance: {
    policy: { classification: 'pii', legal_basis: 'gdpr' },
    storage_residency: { region: 'eu-central-1', vendor: 'aurora-s3', encrypted_at_rest: true }
  },
  operations: {
    refresh: { schedule: 'hourly', expected_by: '00:10Z' },
    retention: '18-months'
  }
});

// Add device telemetry + chargeback scoring while routing results to an external bureau
const baseManifest = checkoutOrders.manifest();
const hardenedCheckout = checkoutOrders
  .set('schema.fields.device_fingerprint', {
    type: 'string',
    description: 'One-way hash used for device reputation',
    required: false
  })
  .set('schema.fields.chargeback_risk', {
    type: 'number',
    description: '0-1 score emitted by fraud models',
    required: true
  })
  .set('lineage.consumers', [
    ...(baseManifest.lineage?.consumers || []),
    { type: 'external', id: 'urn:proto:api:chargeback-bureau@1.0.0' }
  ]);

const validation = hardenedCheckout.validate();
const diff = checkoutOrders.diff(hardenedCheckout.manifest());
const migration = checkoutOrders.generateMigration(hardenedCheckout.manifest());
const catalog = createDataCatalog([hardenedCheckout]);
const piiWarnings = catalog.piiEgressWarnings();
const cycles = catalog.detectCycles();

logSection('Validation Results');
console.log(JSON.stringify(validation, null, 2));

logSection('Schema Changes');
diff.changes.forEach((change) => {
  console.log(`${change.path}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
});

logSection('Suggested Migration Steps');
if (migration.steps.length === 0) {
  console.log('No structural changes detected.');
} else {
  migration.steps.forEach((step) => console.log(step));
}
if (migration.notes.length) {
  console.log('\nNotes:');
  migration.notes.forEach((note) => console.log(`- ${note}`));
}

logSection('Catalog Health');
console.log('PII egress warnings:', piiWarnings.length ? piiWarnings : 'none');
console.log('Lineage cycles:', cycles.length ? cycles : 'none');

logSection('Done');
console.log('Checkout dataset hardened without mutating the original manifest.');
