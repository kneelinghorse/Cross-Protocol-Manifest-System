#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createDataProtocol } = await loadModule(
  '@proto/data',
  '../../data_protocol_v_1_1_1.js'
);
const { createApiProtocol } = await loadModule(
  '@proto/api',
  '../../api_protocol_v_1_1_1.js'
);
const { createCatalogSystem } = await loadModule(
  '@proto/catalog',
  '../../catalog_system_v_1_1_1.js'
);

/**
 * Scenario: assemble a lightweight system catalog.
 * - Blend data + API manifests plus an event contract
 * - Run system health, search, and cycle detection in < 100ms
 */
const checkoutDataset = createDataProtocol({
  version: '1.0.0',
  dataset: {
    name: 'checkout_orders',
    type: 'fact-table',
    lifecycle: { status: 'active' },
    description: 'Orders emitted from checkout'
  },
  schema: {
    primary_key: 'order_id',
    fields: {
      order_id: { type: 'string', required: true },
      user_id: { type: 'string', required: true },
      total_amount: { type: 'number' },
      currency: { type: 'string' },
      risk_score: { type: 'number' }
    }
  },
  lineage: {
    sources: [
      { type: 'api', id: 'urn:proto:api:payments-api@1.1.0' }
    ],
    consumers: [
      { type: 'model', id: 'urn:proto:event:fraud.alert@1.0.0' },
      { type: 'external', id: 'urn:proto:api:analytics-api@1.0.0' }
    ]
  },
  governance: {
    policy: { classification: 'pii' }
  }
});

const settlementsApi = createApiProtocol({
  api: { name: 'settlements-api', version: '1.0.0', lifecycle: { status: 'active' } },
  endpoints: {
    paths: {
      '/settlements': {
        summary: 'List settlement batches',
        responses: { '200': { description: 'Array of settlement batches' } }
      }
    }
  },
  metadata: { owner: 'Finance Platform' }
});

const fraudAlertEvent = {
  version: '1.0.0',
  event: {
    name: 'fraud.alert',
    version: '1.0.0',
    lifecycle: { status: 'active' }
  },
  schema: {
    format: 'json-schema',
    payload: {
      properties: {
        orderId: { type: 'string' },
        score: { type: 'number' }
      },
      required: ['orderId', 'score']
    }
  },
  delivery: {
    contract: {
      transport: 'sns',
      guarantees: 'at-least-once',
      dlq: 'fraud.alert.dlq'
    }
  },
  governance: {
    policy: { classification: 'pii' }
  },
  metadata: {
    owner: 'Risk Engineering'
  }
};

const catalog = createCatalogSystem([checkoutDataset, settlementsApi, fraudAlertEvent]);
const report = catalog.generateSystemReport();

const logSection = (title) => console.log(`\n=== ${title} ===`);

logSection('Summary');
console.log(report.summary);

logSection('Relationships Discovered');
console.log(report.relationships);

logSection('Cycle Scan');
console.log(report.cycles.length ? report.cycles : 'No cycles detected');

logSection('Search Helpers');
const matches = catalog.find('checkout');
console.log('Found entities:', matches.map((item) => {
  const manifest = item.manifest ? item.manifest() : item;
  return manifest.dataset?.name || manifest.api?.name || manifest.event?.name;
}));

const dataUrn = report.urns.find((urn) => urn?.startsWith('urn:data'));
console.log('Lookup by URN:', dataUrn, '->', catalog.findByURN(dataUrn)?.manifest?.());

logSection('Validation Check');
console.log(catalog.validate({ checkPerformance: true }));

logSection('Done');
console.log('System catalog ready for demos.');
