# Cross-Protocol Examples

These self-contained Node.js scripts demonstrate how to exercise every CPMS protocol implementation without additional dependencies. Each script can be executed directly with Node 20+ from the repository root.

## Quick Start

```bash
# Ensure workspace deps are bootstrapped once
pnpm install

# Run any example
overview='examples/01-data-quality-guardrails.js'
node "$overview"
```

All scripts assume the workspace packages (e.g., `@cpms/data`) are built, which happens as part of `pnpm install`. No network calls or external services are required.

## Script Index

| Script | Protocols | Purpose |
| --- | --- | --- |
| `01-data-quality-guardrails.js` | Data Protocol + Data Catalog | Harden the checkout dataset, diff revisions, and surface PII egress warnings. |
| `02-event-fraud-alerts.js` | Event Protocol | Fan out fraud alerts with strict schema validation and subscriber stats. |
| `03-api-contract-snapshot.js` | API Protocol | Promote the Payments API to v1.1.0, inspect validation output, and preview the generated OpenAPI doc. |
| `04-agent-delegation-handshake.js` | Agent Protocol | Generate an agent card/docs/test scaffold and diff a new capability addition. |
| `05-semantic-surface-map.js` | Semantic Protocol | Model checkout vs. fraud semantic surfaces and auto-link related intents via cosine similarity. |
| `06-cross-protocol-system-report.js` | Data + API Protocols, Catalog System, Event manifest | Build a mini system catalog, run health checks, search entities, and inspect URN lookups. |

## Tips

- Scripts stream helpful commentary to stdout; pipe through `less -R` if you want pagination.
- To compare outputs between revisions, capture logs via `node examples/03-api-contract-snapshot.js > /tmp/api.log`.
- Extend any scenario by importing additional `@cpms/*` packages—everything stays zero-dependency.
