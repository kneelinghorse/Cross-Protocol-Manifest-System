#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createAgentProtocol } = await loadModule(
  '@proto/agent',
  '../../agent_protocol_v_1_1_1.js'
);

/**
 * Scenario: document and evolve the Fraud Triage Agent.
 * - Produce an agent card + docs
 * - Verify validators + diff detection for newly added tool
 */
const fraudAgent = createAgentProtocol({
  agent: {
    id: 'urn:proto:agent:fraud-triage@1.0.0',
    name: 'Fraud Triage Agent',
    version: '1.0.0',
    discovery_uri: 'https://agents.aurora.dev/fraud-triage',
    lifecycle: { status: 'enabled' }
  },
  capabilities: {
    tools: [
      {
        name: 'triageChargeback',
        description: 'Score disputes and decide auto/agent routing',
        inputSchema: { type: 'object', required: ['orderId', 'evidence'], properties: { orderId: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { decision: { type: 'string' } } },
        urn: 'urn:proto:workflow:chargeback-triage@1.2.0'
      },
      {
        name: 'requestManualReview',
        description: 'Escalate to a human fraud analyst with context pack'
      }
    ],
    resources: [
      {
        uri: 'https://runbooks.aurora.dev/fraud/triage.md',
        name: 'Fraud runbooks',
        mimeType: 'text/markdown',
        urn: 'urn:proto:docs:fraud-runbook@1.3.0'
      }
    ],
    prompts: [
      {
        name: 'fraud-investigation',
        description: 'LLM prompt used when summarising customer disputes',
        urn: 'urn:proto:ai:fraud-investigation@1.0.0'
      }
    ],
    modalities: { input: ['text'], output: ['text'] }
  },
  communication: {
    supported: ['mcp'],
    endpoints: { primary: 'mcp://agents.aurora.dev/fraud-triage' },
    transport: { primary: 'https', streaming: 'sse' }
  },
  authorization: {
    delegation_supported: true,
    signature_algorithm: 'Ed25519'
  },
  relationships: {
    apis: ['urn:proto:api:payments-api@1.1.0'],
    workflows: ['urn:proto:workflow:chargeback-triage@1.2.0'],
    roles: ['urn:proto:iam:fractional-risk@1.0.0']
  },
  metadata: {
    owner: 'Risk Engineering',
    tags: ['agent', 'fraud', 'risk']
  }
});

const validation = fraudAgent.validate();
const card = fraudAgent.generateAgentCard();
const docs = fraudAgent.generateDocs();
const jestTest = fraudAgent.generateTest('jest');
const hasManualReview = fraudAgent.query('capabilities.tools:contains:Manual');

// Add a tool for document retrieval (immutably)
const upgradedAgent = fraudAgent.set('capabilities.tools', [
  ...fraudAgent.manifest().capabilities.tools,
  {
    name: 'fetchEvidencePacket',
    description: 'Stream supporting docs from the evidence lake',
    urn: 'urn:proto:data:evidence-packets@2.0.0'
  }
]);
const diff = fraudAgent.diff(upgradedAgent.manifest());

const logSection = (title) => console.log(`\n=== ${title} ===`);

logSection('Validation');
console.log(JSON.stringify(validation, null, 2));

logSection('Agent Card');
console.log(card);

logSection('Docs Preview');
console.log(docs.split('\n').slice(0, 12).join('\n'));

logSection('Auto Test Skeleton (Jest)');
console.log(jestTest);

logSection('Query Helpers');
console.log('Has manual review tool?', hasManualReview);

logSection('Diff After Adding Evidence Tool');
console.log(JSON.stringify(diff, null, 2));

logSection('Done');
console.log('Fraud agent ready for delegation + discovery.');
