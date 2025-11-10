# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to manage independent versions for each `@proto/*` package.

## Workflow

1. After making changes, run `pnpm changeset` and select the affected packages.
2. Describe the change and choose the correct semver bump.
3. Commit the generated file under `.changeset/`.
4. When you're ready to release, run `pnpm version-packages` to apply bumps.
5. Push the release PR — merging it triggers the publish workflow.

All scoped packages are published publicly to npm under the `@proto` organization. Internal helpers (`@proto/utils`) remain ignored/private.
