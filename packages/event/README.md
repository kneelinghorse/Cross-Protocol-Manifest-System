# @cpms/event

Immutable event runtime for Cross-Protocol manifests. Ship high-volume publish/subscribe pipelines with schema validation, listener lifecycle management, and zero external dependencies.

## Installation

```bash
npm install @cpms/event
# pnpm add @cpms/event
```

## Quick Example

```js
import { createEventProtocol } from '@cpms/event';

const events = createEventProtocol({
  validateEvents: true,
  eventSchema: {
    type: 'object',
    properties: {
      eventId: { type: 'string', required: true },
      timestamp: { type: 'number', required: true }
    }
  }
});

const subscriptionId = events.subscribe('semantic.updated', (payload) => {
  console.log('semantic updated', payload);
});

events.publish('semantic.updated', { eventId: 'evt-1', timestamp: Date.now() });
events.unsubscribe(subscriptionId);
```

## Features

- Immutable publish/subscribe handles with automatic teardown helpers.
- Optional schema validation per channel plus defensive guards against circular payloads.
- Listener metrics (per-channel counts, total events, peak concurrency) for operations insight.
- Zero dependencies, works in any Node 20+ runtime and inside `@cpms/cli` commands.
- Drop-in support for semantic + catalog URN annotations.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/protocols/event

## License

MIT © Cross-Protocol Manifest System
