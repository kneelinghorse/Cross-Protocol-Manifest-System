# @proto/catalog

Catalog System v1.1.1 unifies manifests across protocols using URNs. It resolves entities, analyzes relationships, detects dependency cycles, and validates catalog health.

## Install

```bash
pnpm add @proto/catalog
# or
npm install @proto/catalog
```

## Usage

```js
import { createCatalogSystem } from '@proto/catalog';

const catalog = createCatalogSystem([
  { urn: 'urn:proto:data:users@1.1.1', dataset: { name: 'users' } },
  { urn: 'urn:proto:api:payments@1.1.0', api: { name: 'payments' } }
]);

const relationships = catalog.getRelationships();
const validation = catalog.validate();
const report = catalog.generateSystemReport();
```

## Features

- URN parsing, building, resolution, and generation helpers.
- Relationship graph + cycle detection across manifests.
- Catalog-level validation with governance + lifecycle checks.
- Deterministic system reports for telemetry + release notes.

## Scripts

- `pnpm build` – bundle to `dist/`.
- `pnpm dev` – watch for local edits.
- `pnpm check-size` – guard 20kb bundle budget.

## License

MIT © Cross-Protocol Manifest System
