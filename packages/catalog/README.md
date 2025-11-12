# @cpms/catalog

Catalog System v1.1.1 unifies every manifest via URNs. Resolve entities, traverse relationships, detect dependency cycles, and emit health reports without adding dependencies.

## Installation

```bash
npm install @cpms/catalog
# pnpm add @cpms/catalog
```

## Quick Example

```js
import { createCatalogSystem } from '@cpms/catalog';

const catalog = createCatalogSystem([
  { urn: 'urn:proto:data:checkout_events@1.1.1', dataset: { name: 'checkout_events' } },
  { urn: 'urn:proto:api:payments@1.1.0', api: { name: 'payments' } }
]);

const relationships = catalog.getRelationships();
const validation = catalog.validate();
const report = catalog.generateSystemReport();
```

## Features

- URN parsing/building helpers plus lookup APIs for any manifest type.
- Relationship graphs, cycle detection, and dependency summaries.
- Catalog-level validators for governance, lifecycle, lineage, and drift.
- Deterministic system reports suitable for docs, telemetry, or audits.
- Pure ESM module that runs in Node 20+ with zero dependencies.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/examples/06-cross-protocol-system-report

## License

MIT © Cross-Protocol Manifest System
