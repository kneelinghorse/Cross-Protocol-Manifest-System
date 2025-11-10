# @proto/api

API Protocol v1.1.1 – declarative manifests for REST/HTTP services with OpenAPI generation, validator chaining, diffing, and SDK synthesis.

## Install

```bash
pnpm add @proto/api
# or
npm install @proto/api
```

## Usage

```js
import { createApiProtocol } from '@proto/api';

const api = createApiProtocol({
  api: { name: 'payments', version: '1.1.0' },
  servers: { list: [{ url: 'https://api.example.com' }] },
  endpoints: {
    paths: {
      '/payments': {
        summary: 'Create payment',
        responses: { '200': { description: 'Accepted' } }
      }
    }
  }
});

const validation = api.validate(['api.shape', 'endpoints.security']);
const openapi = api.generateOpenApi();
const sdk = api.generateClientSdk('javascript');
```

## Features

- Rich manifest schema with lifecycle + governance metadata.
- Built-in validators for surface coverage, security, rate limits, and dependency analysis.
- OpenAPI 3.0 document synthesis + SDK generation.
- Catalog + dependency analysis helpers for cross-protocol views.

## Scripts

- `pnpm build` – produce dual ESM/CJS bundles.
- `pnpm dev` – watch rebuilds.
- `pnpm check-size` – ensures 15kb budget.

## License

MIT © Cross-Protocol Manifest System
