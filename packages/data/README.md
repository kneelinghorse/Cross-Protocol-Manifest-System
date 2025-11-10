# @proto/data

Data Protocol v1.1.1 packaged for npm. It validates dataset manifests, runs pluggable validators, diffs schema revisions, and synthesizes migration plans while remaining zero-dependency.

## Install

```bash
pnpm add @proto/data
# or
npm install @proto/data
```

## Usage

```js
import { createDataProtocol } from '@proto/data';

const protocol = createDataProtocol({
  dataset: { name: 'users' },
  schema: {
    fields: {
      user_id: { type: 'string', required: true },
      email: { type: 'string', pii: true }
    },
    primary_key: 'user_id'
  }
});

const result = protocol.validate(['core.shape', 'governance.pii_policy']);
```

## Features

- Immutable factory via `createDataProtocol`.
- Built-in validators for schema shape, keys, governance, operations, and catalog metadata.
- Manifest diff + migration helpers for schema drift detection.
- Catalog analysis hooks for URN alignment.
- Deterministic hashing and circular-safe cloning.

## Scripts

- `pnpm build` – bundle to `dist/`.
- `pnpm dev` – watch mode builds.
- `pnpm check-size` – enforce 10kb bundle targets.

## License

MIT © Cross-Protocol Manifest System
