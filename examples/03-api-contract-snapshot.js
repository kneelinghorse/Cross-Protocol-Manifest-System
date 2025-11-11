#!/usr/bin/env node

import { loadModule } from './support/load-module.js';

const { createApiProtocol } = await loadModule(
  '@proto/api',
  '../../api_protocol_v_1_1_1.js'
);

/**
 * Scenario: promote the Payments API to v1.1.0.
 * - Show validator output
 * - Produce a diff + OpenAPI preview for release notes
 */
const paymentsV1 = createApiProtocol({
  api: {
    name: 'payments-api',
    version: '1.0.0',
    lifecycle: { status: 'active' }
  },
  info: {
    title: 'Payments API',
    description: 'Process card payments and inspect settlement status',
    contact: { name: 'Payments Platform', email: 'payments@aurora.dev' }
  },
  servers: {
    list: [
      { url: 'https://api.aurora.dev/payments', description: 'production' },
      { url: 'https://staging.api.aurora.dev/payments', description: 'staging' }
    ]
  },
  security: {
    schemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Aurora ID token' }
    },
    global: ['bearerAuth']
  },
  endpoints: {
    paths: {
      '/payments': {
        summary: 'Submit a checkout payment',
        requestBody: {
          description: 'Card + billing details',
          required: true,
          content: {
            'application/json': {
              properties: {
                orderId: { type: 'string', description: 'Checkout identifier', 'x-pii': true },
                currency: { type: 'string', description: 'ISO currency code' },
                amountCents: { type: 'number', description: 'Charge amount in cents' }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Payment accepted' },
          '402': { description: 'Card declined' }
        },
        rateLimit: { requests: 150, period: '1m' }
      }
    }
  },
  governance: {
    policy: { classification: 'pii', legal_basis: 'gdpr' }
  },
  metadata: {
    owner: 'Payments Platform',
    tags: ['api', 'payments', 'critical']
  }
});

// Evolve to v1.1.0 with phone verification + fetch endpoint
const v2Manifest = paymentsV1.manifest();
v2Manifest.api.version = '1.1.0';
v2Manifest.endpoints.paths['/payments'].requestBody.content['application/json'].properties.phone = {
  type: 'string',
  description: 'Optional phone for 3DS verification',
  'x-pii': true
};
v2Manifest.endpoints.paths['/payments'].responses['201'].description = 'Payment accepted and awaiting capture';
v2Manifest.endpoints.paths['/payments/{paymentId}'] = {
  summary: 'Inspect a specific payment',
  parameters: {
    path: {
      paymentId: { description: 'Payment identifier', required: true, type: 'string' }
    }
  },
  responses: {
    '200': { description: 'Payment status payload' },
    '404': { description: 'Payment not found' }
  }
};

const paymentsV2 = createApiProtocol(v2Manifest);
const validation = paymentsV2.validate();
const diff = paymentsV1.diff(paymentsV2.manifest());
const openApiDoc = paymentsV2.generateOpenApi();

const logSection = (title) => console.log(`\n=== ${title} ===`);

logSection('Validation Results');
console.log(JSON.stringify(validation, null, 2));

logSection('Breaking/Significant Changes');
console.log('Breaking:', diff.breaking);
console.log('Significant:', diff.changes.filter((c) => c.path.startsWith('endpoints.paths')));

logSection('OpenAPI Preview (first 25 lines)');
const preview = openApiDoc.split('\n').slice(0, 25).join('\n');
console.log(`${preview}\n...`);

logSection('Done');
console.log('Payments API v1.1.0 manifest ready for release.');
