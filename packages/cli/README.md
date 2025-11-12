# @cpms/cli

Official `proto` CLI for the Cross-Protocol Manifest System. Validate manifests, diff revisions, generate migrations, run catalog queries, and render graphs straight from the terminal.

## Installation

```bash
npm install --save-dev @cpms/cli
# Optional global install: npm install -g @cpms/cli
```

## Quick Example

```bash
# Validate a manifest (text or JSON output)
npx proto validate --manifest manifests/data/users.json --format text
npx proto validate --manifest manifests/data/users.json --format json

# Diff two manifest revisions
npx proto diff --from manifests/data/users-v1.json --to manifests/data/users-v2.json

# Generate an ordered migration plan
npx proto generate migration --from manifests/data/users-v1.json --to manifests/data/users-v2.json

# Query manifests in bulk
npx proto query "dataset.name:=:checkout_events" --manifest-dir ./manifests --limit 5
```

## Features

- Ships with the zero-dependency Data Protocol fallback; automatically uses published `@cpms/data` when available.
- Deterministic text + JSON output for CI, along with exit codes for gating.
- Diff + migration helpers built on immutable manifest factories.
- Query + graph commands for URN-aware discovery across manifest directories.
- Runs anywhere Node 20+ is available; no external services required.

## Documentation

Full documentation: https://cpms-docs.pages.dev/docs/guides/cli

## License

MIT © Cross-Protocol Manifest System
