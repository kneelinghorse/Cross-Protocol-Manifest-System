# proto-validate-action

A TypeScript GitHub Action that validates Cross-Protocol manifests, detects breaking schema changes, emits annotations, and posts sticky PR comments. It is designed for the `pull_request_target` pattern so teams can safely comment on forked pull requests while only executing trusted code.

## CLI Resolution

The action prefers to run the published `proto` CLI. Resolution order:

1. `PROTO_CLI_PATH` (absolute path to the binary/script).
2. Cached tool from `@actions/tool-cache` (`proto` / requested version).
3. Download via `PROTO_CLI_DOWNLOAD_URL` or `PROTO_CLI_DOWNLOAD_TEMPLATE` (placeholders: `{version}`, `{platform}`, `{arch}`) and optional `PROTO_CLI_BIN` to point to the binary inside the archive.
4. Bundled fallback archive (`packages/validate-action/bundled/proto-cli-v0.4.0.{tar.gz,zip}`) that hydrates into the tool-cache automatically when no remote download is configured.
5. Local fallbacks (`node_modules/.bin/proto`, `packages/cli/dist/proto.js`).

If the CLI cannot be located the action falls back to the embedded data protocol implementation and logs a warning. Set `proto-cli-version` to control the version key used for caching.

## Features
- Manifest discovery via glob or newline-separated glob lists
- Data protocol validation with OWASP-aligned warnings
- API-driven diffing (base commit vs PR head) for breaking change detection
- PII egress warnings when sensitive datasets feed external consumers
- Three-tier reporting: annotations, job summary, optional PR comment
- JSON report output for downstream tooling integrations

## Required Permissions & Trigger
Use the "trusted workflow, untrusted data" pattern:

```yaml
on:
  pull_request_target:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    permissions:
      contents: read
      checks: write
      pull-requests: write
```

Checkout must target the head SHA so the action reads the untrusted manifests, but no scripts from the PR should be executed.

## Inputs
| Name | Description | Default |
| --- | --- | --- |
| `manifest-glob` | Glob or newline-separated globs for manifests. | `**/*.proto.json` |
| `fail-on-breaking` | Fail workflow when breaking changes are present. | `true` |
| `fail-on-warnings` | Fail workflow when warnings (validation or PII) occur. | `false` |
| `comment-on-pr` | Post/update sticky PR comment with summary. | `true` |
| `comment-on-pr-sentinel` | Hidden marker for sticky comment updates. | `<!-- proto-validate-action -->` |
| `compare-branch` | Override base ref used for diffing. | auto-detect |
| `output-format` | `github-annotations` for inline issues or `json` to emit `proto-validation-report.json` in the workspace. | `github-annotations` |
| `proto-cli-version` | Version label used for tool-cache downloads. | `latest` |
| `github-token` | Token for GitHub API calls. | _required_ |

## Outputs
| Name | Description |
| --- | --- |
| `validated-count` | Number of manifests processed. |
| `passed-count` | Count of manifests without errors. |
| `failed-count` | Count of manifests with validation errors. |
| `breaking-changes-count` | Total breaking changes detected. |
| `validation-report-json` | Minified JSON report for downstream steps. |

## Environment Variables

| Name | Purpose |
| --- | --- |
| `PROTO_CLI_PATH` | Absolute path to a pre-installed `proto` binary/script. |
| `PROTO_CLI_DOWNLOAD_URL` | Direct URL to a tar/zip archive containing the CLI. |
| `PROTO_CLI_DOWNLOAD_TEMPLATE` | Template for downloads (`{version}`, `{platform}`, `{arch}`). |
| `PROTO_CLI_BIN` | Relative path to the binary inside the downloaded/cached directory. |

## Usage
```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.sha || github.sha }}
      - name: Validate manifests
        uses: proto/validate-action@v1
        with:
          manifest-glob: 'manifests/**/*.json'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action automatically publishes annotations and, when enabled, posts a sticky PR comment summarizing the run with a link to the workflow execution.

When `output-format: json` is supplied the action skips GitHub annotations and instead writes the sanitized report to `proto-validation-report.json` (also exposed via the `validation-report-json` output) so downstream steps can archive or attach it.
