# @cpms/semantic

Semantic Protocol v3.2.0 adds self-enriching semantic surfaces to any manifest. Compute intent, criticality, similarity vectors, and bindings without leaving Node.

## Installation

```bash
npm install @cpms/semantic
# pnpm add @cpms/semantic
```

## Quick Example

```js
import { createSemanticProtocol, createSemanticCatalog } from '@cpms/semantic';

const semantic = createSemanticProtocol({
  id: 'semantic.intent.checkout',
  element: { type: 'service', role: 'checkout-intent' },
  semantics: {
    purpose: 'capture checkout signals',
    criticality: 'high',
    signals: ['cart_abandonment', 'fraud_alert']
  }
});

const manifest = semantic.manifest();
const docs = semantic.generateDocs();
const catalog = createSemanticCatalog([semantic]);
const suggestions = catalog.discoverRelationships(0.8);
```

## Features

- Automatic enrichment: intent, criticality, similarity vectors, and context bindings.
- Validation of semantic surfaces, resource requirements, and downstream dependencies.
- Catalog + search helpers for linking related intents or detecting drift.
- Deterministic hashing + immutable updates for Git-friendly diffs.
- Works alongside `@cpms/data`, `@cpms/api`, and `@cpms/event` for full cross-protocol coverage.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/protocols/semantic

## License

MIT © Cross-Protocol Manifest System
