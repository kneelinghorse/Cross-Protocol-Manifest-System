# @cpms/agent

Agent Protocol v1.1.1 describes AI/automation agents, their capabilities, resources, delegation graph, and URN bindings. Build catalogs of agents, diff revisions, and emit agent cards without relying on external packages.

## Installation

```bash
npm install @cpms/agent
# pnpm add @cpms/agent
```

## Quick Example

```js
import { createAgentProtocol } from '@cpms/agent';

const manifest = {
  agent: { id: 'proto.writer', name: 'Protocol Writer', version: '1.1.1' },
  capabilities: {
    tools: [
      { name: 'manifest.validate', description: 'Run validators against manifests' },
      { name: 'manifest.diff', description: 'Detect drift between revisions' }
    ]
  },
  lifecycle: { status: 'active' }
};

const agent = createAgentProtocol(manifest);
const validation = agent.validate(['agent.identity', 'capabilities.tools']);
const card = agent.generateAgentCard();
```

## Features

- Immutable manifest factory + diff helpers for tracking capability drift.
- Validator registry covering identity, capability coverage, delegation loops, and governance.
- Agent card/document generation for quick sharing.
- Catalog helpers for URN-backed relationship graphs.
- Runs anywhere Node 20+ is available—no dependencies, no network calls.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/protocols/agent

## License

MIT © Cross-Protocol Manifest System
