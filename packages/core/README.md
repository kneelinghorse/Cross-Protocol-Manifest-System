# @cpms/core

Zero-dependency foundation utilities shared across every Cross-Protocol Manifest System package. Deterministic hashing, canonical JSON formatting, immutable getters/setters, and validator registries all live here.

## Installation

```bash
npm install @cpms/core
# pnpm add @cpms/core
```

## Quick Example

```js
import { jsonCanon, hash, dget, dset, registerValidator } from '@cpms/core';

const canonical = jsonCanon({ b: 2, a: 1 });
const digest = hash(canonical, 'fnv1a');

const manifest = { schema: { fields: { user_id: { type: 'string' } } } };
const userId = dget(manifest, 'schema.fields.user_id');
const next = dset(manifest, 'schema.fields.status', { type: 'string', required: true });

registerValidator('schema.required', (m) => ({
  ok: !!m.schema?.fields?.status,
  issues: m.schema?.fields?.status ? [] : [{ level: 'error', path: 'schema.fields.status', msg: 'Missing status field' }]
}));
```

## Features

- Canonical JSON + hashing helpers for reproducible manifests.
- Immutable getters/setters (`dget`/`dset`) that never mutate the source object.
- Validator registry utilities with deterministic execution order.
- Query/DSL helpers for filtering manifests by arbitrary paths.
- Ships as a single ESM module with zero runtime dependencies.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/getting-started/overview

## License

MIT © Cross-Protocol Manifest System
