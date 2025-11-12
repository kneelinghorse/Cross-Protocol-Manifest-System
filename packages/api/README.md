# @cpms/api

API Protocol v1.1.1 for declarative HTTP/REST contracts. Author manifests, run validator chains, generate OpenAPI documents, and synthesize SDKs — all without pulling in extra dependencies.

## Installation

```bash
npm install @cpms/api
# pnpm add @cpms/api
```

## Quick Example

```js
import { createApiProtocol } from '@cpms/api';

const manifest = {
  api: { name: 'payments', version: '1.1.0' },
  servers: { list: [{ url: 'https://api.example.com', environment: 'prod' }] },
  endpoints: {
    paths: {
      '/payments': {
        summary: 'Create payment',
        method: 'POST',
        auth: { type: 'oauth2', scopes: ['payments:write'] },
        responses: { '200': { description: 'Payment accepted' } }
      }
    }
  }
};

const api = createApiProtocol(manifest);
const validation = api.validate(['api.shape', 'security.oauth']);
const openapi = api.generateOpenApi();
const sdk = api.generateClientSdk('javascript');
```

## Features

- Immutable manifest factory with lifecycle + governance metadata baked in.
- Validator registry shipping coverage, security, dependency, and quota checks.
- OpenAPI 3.0.3 generation plus language-specific SDK skeletons.
- Diff helpers for catching breaking changes between contract versions.
- Works standalone in CI, the `proto` CLI, or bespoke tooling.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/protocols/api

## License

MIT © Cross-Protocol Manifest System
