#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createSemanticProtocol, createSemanticCatalog } = await loadModule(
  '@cpms/semantic',
  '../../packages/semantic/src/semantic-protocol.js'
);

/**
 * Scenario: map intent between checkout UX and fraud shield components.
 * - Semantic manifests self-enrich with intent + vectors
 * - Catalog links related flows via cosine similarity
 */
const checkoutFlow = createSemanticProtocol({
  id: 'checkout-flow',
  semantics: {
    purpose: 'Guide shoppers through payment entry with contextual nudges'
  },
  element: {
    type: 'flow',
    role: 'checkout'
  },
  governance: {
    owner: 'Commerce Experience',
    businessImpact: 8,
    userVisibility: 1.0,
    piiHandling: false
  },
  context: {
    domain: 'commerce',
    flow: 'checkout',
    step: 'payment',
    protocolBindings: {
      api: [
        { urn: 'urn:proto:api:payments-api@1.1.0', provides: ['submit-order'] }
      ],
      data: [
        { urn: 'urn:proto:data:checkout_orders@1.1.0', requires: ['order snapshot'] }
      ]
    }
  },
  relationships: {
    dependents: ['urn:proto:event:order.confirmed@1.0.0']
  },
  metadata: {
    description: 'Customer-facing checkout orchestration'
  }
});

const fraudShield = createSemanticProtocol({
  id: 'fraud-shield',
  semantics: {
    purpose: 'Score risk after checkout and block abusive shoppers'
  },
  element: {
    type: 'service',
    role: 'risk'
  },
  governance: {
    owner: 'Risk Engineering',
    businessImpact: 10,
    userVisibility: 0.2,
    piiHandling: true
  },
  context: {
    domain: 'commerce',
    flow: 'fraud',
    step: 'triage',
    protocolBindings: {
      api: [
        { urn: 'urn:proto:api:payments-api@1.1.0', requires: ['payment metadata'] }
      ],
      data: [
        { urn: 'urn:proto:data:checkout_orders@1.1.0', requires: ['order snapshot'] },
        { urn: 'urn:proto:data:chargeback_cases@1.0.0', provides: ['feedback loop'] }
      ],
      event: [
        { urn: 'urn:proto:event:fraud.alert@1.0.0', provides: ['fraud.alert'] }
      ]
    }
  },
  relationships: {
    dependents: ['urn:proto:workflow:chargeback-triage@1.2.0']
  },
  metadata: {
    description: 'Risk scoring and investigator routing'
  }
});

const catalog = createSemanticCatalog([checkoutFlow, fraudShield]);
const related = catalog.discoverRelationships(0.55);

const tunedFraudShield = fraudShield.set('context.protocolBindings.workflow', [
  { urn: 'urn:proto:workflow:chargeback-triage@1.2.0', provides: ['case creation'] }
]);
const diff = fraudShield.diff(tunedFraudShield.manifest());

const logSection = (title) => console.log(`\n=== ${title} ===`);

logSection('Semantic Vector Suggestions (>= 0.55)');
console.log(related);

logSection('Docs Preview');
console.log(checkoutFlow.generateDocs().split('\n').slice(0, 12).join('\n'));

logSection('Diff After Adding Workflow Binding');
console.log(diff);

logSection('Done');
console.log('Semantic layer now exposes cross-protocol intent.');
