# @proto/semantic

Semantic Protocol v3.2.0 delivers self-enriching semantic manifests that compute intent, criticality, confidence, semantic vectors, and rich protocol bindings for discovery and governance.

## Install

```bash
pnpm add @proto/semantic
# or
npm install @proto/semantic
```

## Usage

```js
import { createSemanticProtocol } from '@proto/semantic';

const semantic = createSemanticProtocol({
  id: 'semantic.intent.resolver',
  element: { type: 'service', role: 'intent-resolver' },
  semantics: { purpose: 'interpret manifest intent' }
});

const manifest = semantic.manifest();
const docs = semantic.generateDocs();
const catalog = createSemanticCatalog([semantic]);
```

## Features

- Automatic enrichment: intent, criticality, confidence, semantic vectors.
- Protocol bindings (`requires` / `provides`) with validation.
- Catalog helpers for similarity discovery and cross-validation.
- Deterministic hashing for diff-friendly signatures.

## Scripts

- `pnpm build` – create CJS/ESM bundles + types.
- `pnpm dev` – watch builds.
- `pnpm check-size` – enforce size constraints.

## License

MIT © Cross-Protocol Manifest System
