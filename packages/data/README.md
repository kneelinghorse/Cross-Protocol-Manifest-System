# @cpms/data

Data Protocol v1.1.1 packaged for npm. Validate datasets, diff revisions, synthesize migrations, and run catalog health checks without bringing in any external dependencies.

## Installation

```bash
npm install @cpms/data
# pnpm add @cpms/data
```

## Quick Example

```js
import { createDataProtocol } from '@cpms/data';

const manifest = {
  dataset: { name: 'checkout_events', type: 'fact-table' },
  schema: {
    primary_key: 'event_id',
    fields: {
      event_id: { type: 'string', required: true },
      user_id: { type: 'string', required: true },
      total: { type: 'number' }
    }
  },
  governance: { policy: { classification: 'internal' } }
};

const protocol = createDataProtocol(manifest);
const validation = protocol.validate(['core.shape', 'schema.keys']);
const migration = protocol.generateMigration({
  ...manifest,
  schema: { ...manifest.schema, fields: { ...manifest.schema.fields, currency: { type: 'string' } } }
});
```

## Features

- Immutable factory via `createDataProtocol` with cloned manifests and deterministic hashes.
- Built-in validators for schema shape, governance, lineage, PII policy, and operational freshness.
- First-class diff + migration helpers for schema drift detection and remediation plans.
- Catalog helpers for URN alignment, consumer detection, and dataset search.
- Works everywhere Node 20+ runs—no dependencies, no native bindings.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/protocols/data

## License

MIT © Cross-Protocol Manifest System
