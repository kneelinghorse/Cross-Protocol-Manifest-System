export type ProtocolId = 'data' | 'event' | 'api' | 'agent' | 'semantic';

export const sampleManifests: Record<ProtocolId, string> = {
  data: JSON.stringify(
    {
      protocol: 'data',
      version: 'v1.1.1',
      dataset: {
        name: 'user_events',
        type: 'fact-table',
        lifecycle: {status: 'active'},
        owner: 'identity-team',
        tags: ['events', 'pii'],
      },
      schema: {
        primary_key: 'event_id',
        fields: {
          event_id: {type: 'string', required: true},
          user_id: {type: 'string', required: true},
          email: {type: 'string', pii: true},
          event_date: {type: 'date', required: true},
        },
      },
      governance: {
        policy: {classification: 'pii', legal_basis: 'gdpr'},
        storage_residency: {region: 'eu-west-1', encrypted_at_rest: true},
      },
      lineage: {
        sources: [{type: 'event', id: 'user-signups'}],
        consumers: [{type: 'model', id: 'churn-risk'}],
      },
    },
    null,
    2,
  ),
  event: JSON.stringify(
    {
      protocol: 'event',
      channel: {
        name: 'user-signups',
        transport: 'kafka',
        retention_hours: 168,
      },
      schema: {
        fields: {
          user_id: {type: 'string', required: true},
          email: {type: 'string', pii: true},
          signup_at: {type: 'timestamp', required: true},
        },
      },
      delivery: {
        guarantee: 'at-least-once',
        ordering_key: 'user_id',
      },
      ingress: [{type: 'service', id: 'identity-api'}],
      egress: [{type: 'warehouse', id: 'lakehouse:user_signups'}],
    },
    null,
    2,
  ),
  api: JSON.stringify(
    {
      protocol: 'api',
      service: {
        name: 'payments',
        owner: 'pay-core',
        lifecycle: {status: 'ga'},
      },
      endpoints: [
        {
          path: '/v1/payments',
          method: 'post',
          summary: 'Create a payment',
          request: {
            body: {
              type: 'object',
              fields: {
                amount: {type: 'number', required: true},
                currency: {type: 'string', required: true},
                customer_id: {type: 'string', required: true},
              },
            },
          },
          response: {
            '200': {
              description: 'Payment accepted',
              schema: {ref: '#/components/schemas/Payment'},
            },
          },
        },
      ],
      auth: {
        default: 'oauth',
        schemes: {
          oauth: {
            type: 'oauth2',
            flows: ['client_credentials'],
            scopes: ['payments:create'],
          },
        },
      },
      limits: {rate: {unit: 'minute', max: 200}},
    },
    null,
    2,
  ),
  agent: JSON.stringify(
    {
      protocol: 'agent',
      agent: {
        name: 'support-triage',
        version: '1.2.0',
        owner: 'cx-automation',
      },
      inputs: {
        ticket: {type: 'object', required: true},
        history: {type: 'array'},
      },
      outputs: {
        resolution: {type: 'string'},
        handoff_required: {type: 'boolean'},
      },
      guardrails: {
        max_tool_invocations: 5,
        disallowed_content: ['credentials', 'PII'],
      },
      evaluation: {
        judges: ['Claude', 'Gemini'],
        metrics: ['correctness', 'tone', 'policy_adherence'],
      },
    },
    null,
    2,
  ),
  semantic: JSON.stringify(
    {
      protocol: 'semantic',
      intent: {
        id: 'intent.detect-pii',
        description: 'Detect PII leaks across outbound webhooks',
        category: 'governance',
      },
      confidence: {
        score: 0.92,
        explanation: 'Validated on 5K webhook payloads',
      },
      vectors: {
        model: 'text-embedding-3-large',
        values: '3zvABcdEF...',
      },
      bindings: [
        {type: 'dataset', urn: 'urn:data:dataset:user_events:v1.1.1'},
        {type: 'api', urn: 'urn:api:service:webhooks:v2'},
      ],
      criticality: {
        tier: 'high',
        review_window_days: 14,
      },
    },
    null,
    2,
  ),
};
