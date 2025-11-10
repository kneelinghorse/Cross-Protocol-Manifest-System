# @proto/agent

Agent Protocol v1.1.1 for describing AI/automation agents, their capabilities, resources, delegation graph, and URN bindings. Ships immutable helpers for validation, cataloging, diffing, and normalization.

## Install

```bash
pnpm add @proto/agent
# or
npm install @proto/agent
```

## Usage

```js
import { createAgentProtocol } from '@proto/agent';

const agent = createAgentProtocol({
  agent: { id: 'proto.writer', name: 'Protocol Writer', version: '1.1.1' },
  capabilities: {
    tools: [{ name: 'manifest.validate', description: 'Validate manifests' }]
  }
});

const validation = agent.validate(['agent.identity', 'capabilities.tools']);
const card = agent.generateAgentCard?.();
```

## Features

- Immutable manifest factory with lifecycle metadata.
- Validator registry (`registerValidator`, `runValidators`).
- Catalog builder for relationship analysis.
- Diff + normalization helpers for comparing agent revisions.
- Query DSL for delegations and resource discovery.

## Scripts

- `pnpm build` – tsup bundle to `dist/`.
- `pnpm dev` – watch mode.
- `pnpm check-size` – enforce size budget.

## License

MIT © Cross-Protocol Manifest System
