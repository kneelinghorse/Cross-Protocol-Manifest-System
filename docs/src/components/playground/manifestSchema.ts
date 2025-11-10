export const manifestSchema = {
  $id: 'https://cross-protocol.dev/manifest-schema.json',
  type: 'object',
  additionalProperties: true,
  required: ['protocol'],
  properties: {
    protocol: {
      type: 'string',
      description: 'Which protocol factory to use (data, event, api, agent, semantic).',
      enum: ['data', 'event', 'api', 'agent', 'semantic'],
    },
    channel: {
      type: 'object',
      description: 'Event channel metadata.',
      properties: {
        name: {type: 'string'},
        transport: {type: 'string'},
        retention_hours: {type: 'number'},
      },
    },
    version: {
      type: 'string',
      description: 'Semantic version of the manifest or protocol implementation.',
    },
    dataset: {
      type: 'object',
      description: 'Dataset identity + lifecycle metadata.',
      properties: {
        name: {type: 'string', description: 'Unique dataset name or URN.'},
        type: {
          type: 'string',
          enum: ['fact-table', 'dimension', 'view', 'file', 'stream', 'unknown'],
        },
        lifecycle: {
          type: 'object',
          properties: {
            status: {type: 'string', enum: ['active', 'deprecated']},
            sunset_at: {type: 'string', description: 'ISO8601 timestamp'},
          },
        },
        owner: {type: 'string'},
        tags: {type: 'array', items: {type: 'string'}},
      },
    },
    schema: {
      type: 'object',
      description: 'Field dictionary and keys for structured data.',
      properties: {
        primary_key: {
          description: 'Primary key field(s).',
          anyOf: [{type: 'string'}, {type: 'array', items: {type: 'string'}}],
        },
        fields: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              type: {type: 'string'},
              required: {type: 'boolean'},
              pii: {type: 'boolean'},
              description: {type: 'string'},
            },
          },
        },
        keys: {
          type: 'object',
          properties: {
            unique: {type: 'array', items: {type: 'string'}},
            foreign_keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {type: 'string'},
                  ref: {type: 'string'},
                },
              },
            },
            partition: {
              type: 'object',
              properties: {
                field: {type: 'string'},
                type: {type: 'string', enum: ['daily', 'hourly', 'monthly']},
              },
            },
          },
        },
      },
    },
    governance: {
      type: 'object',
      description: 'Policy + residency metadata.',
      properties: {
        policy: {
          type: 'object',
          properties: {
            classification: {type: 'string', enum: ['internal', 'confidential', 'pii']},
            legal_basis: {type: 'string', enum: ['gdpr', 'ccpa', 'hipaa', 'other']},
          },
        },
        storage_residency: {
          type: 'object',
          properties: {
            region: {type: 'string'},
            vendor: {type: 'string'},
            encrypted_at_rest: {type: 'boolean'},
          },
        },
      },
    },
    lineage: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {type: 'string'},
              id: {type: 'string'},
            },
          },
        },
        consumers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {type: 'string'},
              id: {type: 'string'},
            },
          },
        },
      },
    },
    operations: {
      type: 'object',
      properties: {
        refresh: {
          type: 'object',
          properties: {
            schedule: {type: 'string', enum: ['hourly', 'daily', 'cron']},
            expected_by: {type: 'string'},
          },
        },
        retention: {type: 'string'},
      },
    },
    service: {
      type: 'object',
      description: 'API/agent service metadata.',
      properties: {
        name: {type: 'string'},
        owner: {type: 'string'},
        lifecycle: {
          type: 'object',
          properties: {
            status: {type: 'string', enum: ['alpha', 'beta', 'ga', 'deprecated']},
          },
        },
      },
    },
    endpoints: {
      type: 'array',
      description: 'HTTP/GraphQL endpoints for API manifests.',
      items: {
        type: 'object',
        properties: {
          path: {type: 'string'},
          method: {type: 'string'},
          summary: {type: 'string'},
        },
      },
    },
    agent: {
      type: 'object',
      description: 'Agent metadata for AI workflows.',
      properties: {
        name: {type: 'string'},
        owner: {type: 'string'},
        version: {type: 'string'},
      },
    },
  },
};
