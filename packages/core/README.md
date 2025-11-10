# @proto/core

Foundation utilities shared across every Cross-Protocol Manifest System package. The module stays zero-dependency and exposes deterministic helpers for hashing, canonical JSON formatting, deep gets/sets, validator registration, and manifest querying.

## Install

```bash
pnpm add @proto/core
# or
npm install @proto/core
```

## Usage

```js
import { jsonCanon, hash, dget, dset } from '@proto/core';

const canonical = jsonCanon({ b: 2, a: 1 });
const digest = hash(canonical, 'fnv1a');
const value = dget(manifest, 'schema.fields.user_id');
const next = dset(manifest, 'schema.fields.status', { type: 'string' });
```

## API Highlights

- `jsonCanon(value)` – deterministic serialization for manifests.
- `hash(value, algorithm?)` – FNV-1a or SHA-256 hashing without dependencies.
- `dget(path)` / `dset(path)` – safe immutable path helpers.
- `registerValidator(name, fn)` / `runValidators(manifest, names)` – pluggable validation engine.
- `parseQuery(expr)` – query DSL for manifest filtering.

## Scripts

- `pnpm build` – bundle to `dist/`.
- `pnpm dev` – rebuild on file changes via tsup.
- `pnpm check-size` – ensure bundle stays within the mission budget.

## License

MIT © Cross-Protocol Manifest System
