#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createEventProtocol } = await loadModule(
  '@cpms/event',
  '../../event-protocol.js'
);

/**
 * Scenario: fan out high-signal fraud alerts.
 * - Strict schema validation guards against malformed payloads
 * - Multiple subscribers (Slack + case management) receive the same event
 */
const alertSchema = {
  type: 'object',
  required: ['orderId', 'score', 'rule', 'raisedAt'],
  properties: {
    orderId: { type: 'string', description: 'Checkout identifier' },
    score: { type: 'number', description: '0-1 fraud score', required: true },
    rule: { type: 'string', description: 'Rule or model that fired' },
    raisedAt: { type: 'string', description: 'ISO timestamp', required: true },
    tags: { type: 'object', description: 'Enrichment key/values' }
  }
};

const fraudAlerts = createEventProtocol({
  maxListeners: 8,
  validateEvents: true,
  enableStats: true,
  eventSchema: alertSchema
});

const logSection = (title) => console.log(`\n=== ${title} ===`);

// Subscriber #1: push to Slack bridge
const slackSub = fraudAlerts.subscribe('fraud.alert', (event) => {
  console.log('[slack] 🚨 high-risk order', event.orderId, 'score', event.score);
});

// Subscriber #2: open a case in the risk agent mesh
const caseSub = fraudAlerts.subscribe('fraud.alert', (event) => {
  console.log('[cases] creating case for', event.orderId, 'rule', event.rule);
});

logSection('Publishing Valid Payload');
fraudAlerts.publish('fraud.alert', {
  orderId: 'ORD-43991',
  score: 0.92,
  rule: 'velocity_chargeback_window',
  raisedAt: new Date().toISOString(),
  tags: { cohort: 'high-touch', paymentMethod: 'amex' }
});

logSection('Blocked Payload');
try {
  // Missing required score + raisedAt → validation should reject
  fraudAlerts.publish('fraud.alert', { orderId: 'ORD-00000' });
} catch (error) {
  console.log('Validation stopped delivery:', error.message);
}

logSection('Stats Snapshot');
console.log(fraudAlerts.getStats());

logSection('Schema Health Check');
console.log(fraudAlerts.validateSchema(alertSchema));

// Unsubscribe after demo to avoid leaking listeners if this script is imported elsewhere
fraudAlerts.unsubscribe(slackSub);
fraudAlerts.unsubscribe(caseSub);

logSection('Done');
console.log('Fraud alerts enforced (no external queue needed).');
