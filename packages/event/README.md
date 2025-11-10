# @proto/event

High-throughput event runtime for v1.1.1 manifests. Provides immutable publish/subscribe APIs, schema validation, statistics tracking, and listener lifecycle controls with zero external dependencies.

## Install

```bash
pnpm add @proto/event
# or
npm install @proto/event
```

## Usage

```js
import { createEventProtocol } from '@proto/event';

const events = createEventProtocol({
  maxListeners: 1000,
  validateEvents: true,
  eventSchema: {
    type: 'object',
    properties: {
      eventId: { type: 'string', required: true },
      timestamp: { type: 'number', required: true }
    }
  }
});

const sub = events.subscribe('semantic.updated', (payload) => {
  console.log('received', payload);
});

events.publish('semantic.updated', { eventId: 'evt-1', timestamp: Date.now() });
events.unsubscribe(sub);
```

## Features

- Immutable publish/subscribe handles with automatic cleanup.
- Optional JSON schema validation per event type.
- Listener throttling + stats (total events, subscribers, per-type counts).
- Defensive guards for circular references and listener leaks.

## Scripts

- `pnpm build` – produce optimized `dist/`.
- `pnpm dev` – rebuild on change.
- `pnpm check-size` – enforce bundle ceiling.

## License

MIT © Cross-Protocol Manifest System
