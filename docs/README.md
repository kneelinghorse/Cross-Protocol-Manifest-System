# Website

The documentation site lives in this workspace package and is powered by [Docusaurus](https://docusaurus.io/). It consumes the local `@cpms/*` packages directly, so always run workspace builds before publishing.

## Installation

```bash
pnpm install
```

The repo uses pnpm workspaces. Running the install command at the repository root is enough for every package (including `docs/`).

## Local Development

```bash
pnpm --filter docs start
```

This launches the dev server with hot-module reload. If you change any of the protocol packages that are aliased in `docusaurus.config.ts`, rebuild them (`pnpm build`) so the playground picks up the new dist files.

## Build

```bash
pnpm build        # builds every workspace, including packages/*
pnpm --filter docs build
```

The explicit docs build step guarantees the static assets land in `docs/build/`, which is what the deployment workflow publishes.

## Deployment (Cloudflare Pages)

Docs are deployed automatically from `main` via [`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml). Configure the workflow with:

- `CLOUDFLARE_API_TOKEN` that grants **Pages:Edit** and **Pages:Deploy** scopes
- `CLOUDFLARE_ACCOUNT_ID` for the Cloudflare account

Create a Cloudflare Pages project named `cpms-docs` (default URL: `https://cpms-docs.pages.dev`). Once the workflow runs, production deployments track the `main` branch and previews attach to feature branches. Add a custom domain such as `cross-protocol.dev` in the Cloudflare dashboard after DNS is delegated.
