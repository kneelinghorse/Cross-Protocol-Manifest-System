# Cross-Protocol Manifest System

**Version:** 1.0.0  
**Status:** Public v1 release (npm packages published • docs live)

A zero-dependency, manifest-first protocol framework that treats every dataset, API, event stream, agent, and semantic surface as a verifiable contract. CPMS turns manifests into observable systems of record with deterministic hashing, validator registries, diff + migration tooling, and a batteries-included CLI.

> **The manifest is the source of truth. Everything else is a derived artifact.**

**Live docs:** https://cpms-docs.pages.dev · **npm org:** https://www.npmjs.com/org/cpms · **Examples:** [examples/](examples) · **Issues:** https://github.com/kneelinghorse/Cross-Protocol-Manifest-System/issues · **License:** [MIT](LICENSE)

## Why CPMS?
- **Declarative everywhere** – manifests describe reality once, then power validation, SDK generation, docs, and telemetry.
- **Zero external dependencies** – every package ships as pure Node 20+ modules to keep the attack surface tiny.
- **Immutable + pluggable** – factories return frozen instances, validators are registered dynamically, and every mutation returns a new manifest.
- **CLI + packages together** – `proto` wraps the published packages so teams can validate, diff, and generate migrations from any repo or CI job.

## ⚡ Quick Start (2 minutes)
```bash
# 1. Create a clean workspace
mkdir cpms-quickstart && cd cpms-quickstart
npm init -y

# 2. Install the CLI (includes the zero-dependency data protocol fallback)
npm install --save-dev @cpms/cli

# 3. Declare a manifest and validate it
mkdir -p datasets
cat <<'JSON' > datasets/checkout.json
{
  "dataset": {
    "name": "checkout_events",
    "type": "fact-table",
    "lifecycle": { "status": "active" }
  },
  "schema": {
    "primary_key": "event_id",
    "fields": {
      "event_id": { "type": "string", "required": true },
      "user_id": { "type": "string", "required": true },
      "total": { "type": "number" }
    }
  },
  "governance": {
    "policy": { "classification": "internal" }
  }
}
JSON

npx proto validate --manifest datasets/checkout.json --format text
```
Outputs `✓ Manifest is valid` in under 2 minutes. Replace the manifest with your own data/API/event definitions and re-run the same command locally or in CI.

## 🧰 CLI in Action
```bash
# Validate manifests with human-readable or JSON output
npx proto validate --manifest manifests/data/users.json --format text
npx proto validate --manifest manifests/data/users.json --format json

# Detect breaking changes between revisions
npx proto diff --from manifests/data/users-v1.json --to manifests/data/users-v2.json

# Generate ordered migrations straight from manifests
npx proto generate migration --from manifests/data/users-v1.json --to manifests/data/users-v2.json

# Query or graph manifests using URN-aware helpers
npx proto query "dataset.name:=:checkout_events" --manifest-dir ./manifests --limit 5
npx proto graph --manifest manifests/data/users.json --output graph.mmd
```

## 📦 npm Packages
| Package | Version | Docs | Description |
|---------|---------|------|-------------|
| [@cpms/core](https://www.npmjs.com/package/@cpms/core) | [![core](https://img.shields.io/npm/v/%40cpms%2Fcore?label=%40cpms%2Fcore)](https://www.npmjs.com/package/@cpms/core) | [Overview](https://cpms-docs.pages.dev/docs/getting-started/overview) | Foundation utilities: canonical JSON, hashing, validator registry, immutable getters/setters, query DSL. |
| [@cpms/data](https://www.npmjs.com/package/@cpms/data) | [![data](https://img.shields.io/npm/v/%40cpms%2Fdata?label=%40cpms%2Fdata)](https://www.npmjs.com/package/@cpms/data) | [Data Protocol](https://cpms-docs.pages.dev/docs/protocols/data) | Data Protocol v1.1.1 with schema validators, diff + migration synthesis, and catalog hooks. |
| [@cpms/event](https://www.npmjs.com/package/@cpms/event) | [![event](https://img.shields.io/npm/v/%40cpms%2Fevent?label=%40cpms%2Fevent)](https://www.npmjs.com/package/@cpms/event) | [Event Protocol](https://cpms-docs.pages.dev/docs/protocols/event) | Immutable event runtime with schema enforcement, subscriber lifecycle controls, and high-volume stats. |
| [@cpms/api](https://www.npmjs.com/package/@cpms/api) | [![api](https://img.shields.io/npm/v/%40cpms%2Fapi?label=%40cpms%2Fapi)](https://www.npmjs.com/package/@cpms/api) | [API Protocol](https://cpms-docs.pages.dev/docs/protocols/api) | REST/API manifests, OpenAPI 3.0 generation, SDK scaffolding, and dependency analysis. |
| [@cpms/agent](https://www.npmjs.com/package/@cpms/agent) | [![agent](https://img.shields.io/npm/v/%40cpms%2Fagent?label=%40cpms%2Fagent)](https://www.npmjs.com/package/@cpms/agent) | [Agent Protocol](https://cpms-docs.pages.dev/docs/protocols/agent) | Agent manifests, capability graphs, delegation chains, and diff/normalization helpers. |
| [@cpms/semantic](https://www.npmjs.com/package/@cpms/semantic) | [![semantic](https://img.shields.io/npm/v/%40cpms%2Fsemantic?label=%40cpms%2Fsemantic)](https://www.npmjs.com/package/@cpms/semantic) | [Semantic Protocol](https://cpms-docs.pages.dev/docs/protocols/semantic) | Intent, criticality, similarity, and enrichment utilities for semantic overlays. |
| [@cpms/catalog](https://www.npmjs.com/package/@cpms/catalog) | [![catalog](https://img.shields.io/npm/v/%40cpms%2Fcatalog?label=%40cpms%2Fcatalog)](https://www.npmjs.com/package/@cpms/catalog) | [System Report](https://cpms-docs.pages.dev/docs/examples/06-cross-protocol-system-report) | URN-based catalog system with relationship graphs, cycle detection, and health reporting. |
| [@cpms/cli](https://www.npmjs.com/package/@cpms/cli) | [![cli](https://img.shields.io/npm/v/%40cpms%2Fcli?label=%40cpms%2Fcli)](https://www.npmjs.com/package/@cpms/cli) | [CLI Guide](https://cpms-docs.pages.dev/docs/guides/cli) | `proto` CLI for validate/diff/generate/query/graph commands on any manifest set. |

## 🔗 Live Resources
- **Documentation Site:** https://cpms-docs.pages.dev (Cloudflare Pages, auto-deployed from `docs/`)
- **Examples:** [examples/README.md](examples/README.md) – run any script directly with `node` to see protocol interactions.
- **Release Notes:** [docs/community/releases](docs/community/releases) – mission-by-mission changelog.
- **Workflow References:** [.github/workflows](.github/workflows) – npm publish + docs deploy automation.
- **CLI Guide:** [docs/guides/cli.mdx](docs/docs/guides/cli.mdx) – manifest directory structure, query syntax, and graph tips.

## 🎯 Core Philosophy
All protocols, validators, and tooling follow the same rules:
- Manifests own the truth; generators and SDKs consume them.
- Everything stays immutable and deterministic for observability + diffability.
- Validators are pluggable, zero-dependency functions with clear input/output contracts.
- Cross-protocol links always use URNs so catalogs can reason about the full system.

## ✨ Capabilities
### Protocol Coverage
- **Data Protocol v1.1.1** – schema validation, migration synthesis, catalog analysis.
- **Event Protocol v1.1.1** – 1M+ events/sec publish/subscribe with schema enforcement.
- **API Protocol v1.1.1** – OpenAPI 3.0.3 + client SDK generation.
- **Agent Protocol v1.1.1** – capability graphs, delegation diffing, agent cards.
- **Semantic Protocol v3.2.0** – intent, criticality, vector similarity scoring.
- **Catalog System v1.1.1** – URN resolution, relationship graphs, health reports.

### Tooling & Automation
- **`proto` CLI** – validate, diff, generate migrations, query manifests, render graphs.
- **GitHub Actions** – manifest validation + docs deploy pipelines (`.github/workflows`).
- **Examples & Benchmarks** – runnable scripts under `examples/` and `benchmark.js`.
- **CMOS Mission Tracking** – database-backed orchestration for maintainers (see `cmos/`).

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     SEMANTIC LAYER (v3.2)                   │
│  (Intent, Criticality, Confidence, Vector, Similarity)      │
└────────────────────┬────────────────────────────────────────┘
                     │ URN-based References & Analysis
┌────────────────────┴────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ DATA (v1.1)  │  │ EVENT (v1.1) │  │ API (v1.1)   │       │
│  │ createData-  │  │ createEvent- │  │ createApi-   │       │
│  │ Protocol()   │  │ Protocol()   │  │ Protocol()   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         └─────────┬────────┴──────────────────┘             │
│         ┌─────────▼────────┐                                │
│         │  AGENT (v1.1)    │  (Capability Registration)     │
│         │  createAgent-    │  & Cross-Protocol Linking      │
│         │  Protocol()      │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Repository Layout
```
Cross-Protocol-Manifest-System/
├── README.md                 # You are here
├── LICENSE                   # MIT license (required for v1 release)
├── package.json              # Workspace scripts (pnpm + turbo)
├── packages/                 # Published npm packages (@cpms/*)
│   ├── core/ data/ event/ api/ agent/ semantic/ catalog/ cli/
├── docs/                     # Docusaurus site → https://cpms-docs.pages.dev
├── examples/                 # Runnable manifest scenarios
├── manifests/                # Sample manifests for tests + demos
├── proto.js                  # Workspace CLI entrypoint (mirrors @cpms/cli)
└── cmos/                     # Mission/orchestration tooling (maintainer-only)
```

## 🧪 Quality & Tests
- 55/55 utils tests · 53/53 API protocol · 53/53 data protocol · 39/39 event protocol · 53/53 agent protocol · 13/13 catalog · 20/20 integration (100% across suites).
- Benchmarks confirm ≥1M hashes/sec for FNV-1a and <5ms parsing for 1K-field manifests.

```bash
pnpm install              # bootstrap workspace (once)
pnpm test                 # run all root tests (node --test)
pnpm test:workspace       # turbo fan-out through every package
node benchmark.js         # verify hashing + parsing performance
node cmos/context/integration_test_runner.js  # CMOS orchestration checks (maintainers)
```

## 🚀 Workspace Development
```bash
pnpm install           # install + build workspace packages
pnpm build             # turbo build across packages/ (ESM + CJS bundles)
pnpm benchmark         # protocol-level benchmarks
pnpm lint && pnpm format  # formatting + linting helpers
```

## 📚 Documentation
- **Live Site:** https://cpms-docs.pages.dev (auto-deployed via [.github/workflows/deploy-docs.yml](.github/workflows/deploy-docs.yml))
- **Architecture Deep Dive:** [cmos/foundational-docs/Cross-Protocol Manifest System-k2.md](cmos/foundational-docs/Cross-Protocol%20Manifest%20System-k2.md)
- **Getting Started:** [docs/docs/getting-started/overview.mdx](docs/docs/getting-started/overview.mdx)
- **Publishing Runbook:** [docs/publishing/npm-publishing-runbook.md](docs/publishing/npm-publishing-runbook.md)
- **CMOS Operations:** [cmos/docs/operations-guide.md](cmos/docs/operations-guide.md) (maintainers)

## 🔒 Security & Performance
- OWASP Top 10 alignment: no `eval`, strict input validation, immutable state, principle-of-least-privilege CLI.
- Deterministic hashing (FNV-1a + SHA-256) with ≥1M ops/sec targets.
- Parsing targets: <5ms for 1K-field manifests · Diff targets: <10ms for 500-field comparisons.
- Zero runtime dependencies keep the attack surface ≤100KB per package.

## 🚚 Release Automation
- Managed with [Changesets](https://github.com/changesets/changesets); run `pnpm changeset` for every mission-level change.
- `.github/workflows/publish-packages.yml` handles build → test → publish with `pnpm release`.
- Docs deploy via `.github/workflows/deploy-docs.yml` to Cloudflare Pages (`cpms-docs`).

## ✅ Launch Checklist
- ✅ npm install instructions + working quick start (`@cpms/cli`).
- ✅ Live documentation URL surfaced near the top.
- ✅ Package table + badges reflect published versions.
- ✅ Repository layout + LICENSE (MIT) visible.
- ✅ Quick start validated locally (`proto validate` succeeds).

## 📜 License
Released under the [MIT License](LICENSE).
