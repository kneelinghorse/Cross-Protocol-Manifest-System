# @proto/cli

The official Cross-Protocol Manifest System CLI. Provides `proto` commands for validating manifests, diffing revisions, generating migrations, running semantic queries, and rendering graph views.

## Install

```bash
pnpm add -D @proto/cli
# or globally
pnpm add -g @proto/cli
```

## Usage

```bash
# Validate a manifest
proto validate --file manifests/data/users.json

# Diff two manifests
proto diff --from manifests/data/users-v1.json --to manifests/data/users-v2.json

# Generate migrations
proto generate migration --from manifest-a.json --to manifest-b.json
```

The CLI automatically prefers the published `@proto/data` package but falls back to the local zero-dependency implementation when running inside this repository.

## Commands

- `validate` – run manifest validators and report issues.
- `diff` – structural diff with breaking-change detection.
- `generate migration` – produce ordered migration steps between manifests.
- `query` / `graph` – semantic queries and relationship graphs (from Sprint 3 enhancements).

## Scripts

- `pnpm build` – bundle CLI to `dist/proto.js`.
- `pnpm dev` – watch mode for local development.

## License

MIT © Cross-Protocol Manifest System
