# Cross-Protocol Manifest System

**Version:** 0.3.0  
**Status:** Sprint 2 Complete, Sprint 3 In Progress

A declarative, self-describing protocol framework that transforms codebases into observable systems of record. By representing datasets, events, APIs, and AI agents as versioned, validated manifests, it enables automated SDK generation, compliance checking, migration synthesis, and cross-service impact analysis—**all with zero external dependencies**.

## 📦 npm Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@proto/core](https://www.npmjs.com/package/@proto/core) | [![core](https://img.shields.io/npm/v/%40proto%2Fcore?label=%40proto%2Fcore)](https://www.npmjs.com/package/@proto/core) | Foundation utilities (hashing, canonical JSON, validator registry, query DSL). |
| [@proto/data](https://www.npmjs.com/package/@proto/data) | [![data](https://img.shields.io/npm/v/%40proto%2Fdata?label=%40proto%2Fdata)](https://www.npmjs.com/package/@proto/data) | Data Protocol v1.1.1 with validators, diff, and migration synthesis. |
| [@proto/event](https://www.npmjs.com/package/@proto/event) | [![event](https://img.shields.io/npm/v/%40proto%2Fevent?label=%40proto%2Fevent)](https://www.npmjs.com/package/@proto/event) | Runtime event engine with immutable publish/subscribe APIs. |
| [@proto/api](https://www.npmjs.com/package/@proto/api) | [![api](https://img.shields.io/npm/v/%40proto%2Fapi?label=%40proto%2Fapi)](https://www.npmjs.com/package/@proto/api) | API Protocol v1.1.1 plus OpenAPI/SDK generation. |
| [@proto/agent](https://www.npmjs.com/package/@proto/agent) | [![agent](https://img.shields.io/npm/v/%40proto%2Fagent?label=%40proto%2Fagent)](https://www.npmjs.com/package/@proto/agent) | Agent manifests, capability graphs, diff, and registries. |
| [@proto/semantic](https://www.npmjs.com/package/@proto/semantic) | [![semantic](https://img.shields.io/npm/v/%40proto%2Fsemantic?label=%40proto%2Fsemantic)](https://www.npmjs.com/package/@proto/semantic) | Semantic Protocol v3.2.0 for intent/criticality analysis. |
| [@proto/catalog](https://www.npmjs.com/package/@proto/catalog) | [![catalog](https://img.shields.io/npm/v/%40proto%2Fcatalog?label=%40proto%2Fcatalog)](https://www.npmjs.com/package/@proto/catalog) | URN-based catalog system with relationship + cycle detection. |
| [@proto/cli](https://www.npmjs.com/package/@proto/cli) | [![cli](https://img.shields.io/npm/v/%40proto%2Fcli?label=%40proto%2Fcli)](https://www.npmjs.com/package/@proto/cli) | `proto` CLI for validate/diff/generate/query/graph commands. |

## 🎯 Core Philosophy

**The manifest is the source of truth. Everything else is a derived artifact.**

## ✨ Features

### Implemented (Sprints 1-2)
- ✅ **Zero-Dependency Foundation** - Standalone utilities for all protocols
- ✅ **Data Protocol v1.1.1** - Dataset manifest validation and migration
- ✅ **Event Protocol v1.1.1** - Kafka/AsyncAPI compatible event system (18M+ events/sec)
- ✅ **API Protocol v1.1.1** - OpenAPI 3.0.3 generation and client SDKs
- ✅ **Catalog System v1.1.1** - Cross-protocol URN resolution and analysis
- ✅ **CLI Tools** - `proto validate`, `proto diff`, `proto generate`
- ✅ **GitHub Actions** - CI/CD integration for manifest validation

### Sprint 3 (Complete)
- ✅ **Agent Protocol v1.1.1** - Capability registration and delegation chains
- ✅ **Semantic Protocol v3.2.0** - Intent analysis and criticality scoring
- ✅ **URN Resolver Service** - Cross-protocol manifest discovery
- ✅ **Enhanced CLI** - `proto query` and `proto graph` commands

## 🚀 Quick Start

```bash
# Install dependencies (dev only, protocols are zero-dependency)
pnpm install

# Run root protocol tests
pnpm test

# Build and test all workspace packages
pnpm build && pnpm test:workspace

# Validate a manifest
node proto.js validate data-manifest.json

# Generate migration
node proto.js generate migration --from v1.json --to v2.json
```

## 📊 Project Status

### Test Coverage
- **Utils:** 55/55 tests passing (100%)
- **API Protocol:** 53/53 tests passing (100%)
- **Catalog System:** 13/13 tests passing (100%)
- **Data Protocol:** 53/53 tests passing (100%)
- **Event Protocol:** 39/39 tests passing (100%)
- **Agent Protocol:** 53/53 tests passing (100%)
- **Integration Tests:** 20/20 tests passing (100%)

### Sprints Completed
- ✅ **Sprint 1** (Phase 1): Foundation & Data Protocol - 4/4 missions (100%)
- ✅ **Sprint 2** (Phase 2): Event & API Protocols - 4/4 missions (100%)
- ✅ **Sprint 3** (Phase 3): Agent & Semantic Protocols - 7/7 missions (100%)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SEMANTIC LAYER (v3.2)                   │
│  (Intent, Criticality, Confidence, Vector, Similarity)     │
└────────────────────┬────────────────────────────────────────┘
                     │ URN-based References & Analysis
┌────────────────────┴────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ DATA (v1.1)  │  │ EVENT (v1.1) │  │ API (v1.1)   │     │
│  │ createData-  │  │ createEvent- │  │ createAPI-   │     │
│  │ Protocol()   │  │ Protocol()   │  │ Protocol()   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         └─────────┬────────┴──────────────────┘             │
│         ┌─────────▼────────┐                                │
│         │  AGENT (v1.1)    │  (Capability Registration)    │
│         │  createAgent-    │  & Cross-Protocol Linking     │
│         │  Protocol()      │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Repository Structure

```
├── agents.md                      # Root agent instructions
├── utils.js                       # Foundation utilities (zero-dep)
├── data-protocol.js               # Data Protocol implementation
├── event-protocol.js              # Event Protocol implementation
├── api-protocol.js                # API Protocol implementation
├── agent_protocol_v_1_1_1.js     # Agent Protocol (validated)
├── semantic_protocol_v_3_2_0.js  # Semantic Protocol (validated)
├── catalog_system_v_1_1_1.js     # Catalog system
├── proto.js                       # CLI tool
├── cmos/                          # CMOS orchestration system
│   ├── db/cmos.sqlite            # Mission tracking database
│   ├── missions/                  # Mission specifications
│   │   ├── B3.1_agent-protocol-validation.yaml
│   │   ├── B3.2_semantic-protocol-validation.yaml
│   │   ├── B3.3_data-protocol-fixes.yaml
│   │   ├── B3.4_event-protocol-fixes.yaml
│   │   ├── B3.5_urn-resolver.yaml
│   │   ├── B3.6_cli-query-graph.yaml
│   │   └── B3.7_integration-docs.yaml
│   ├── docs/                      # CMOS documentation
│   └── foundational-docs/         # Architecture specs
└── test files...
```

## 🎯 Design Principles

1. **Zero Dependencies** - Every protocol file runs standalone
2. **Immutability** - All instances frozen; updates return new instances
3. **URN-First** - All cross-protocol references use URN format
4. **Pluggable Everything** - Validators, hash functions, query operators
5. **Generate, Don't Write** - SDKs, docs, tests, migrations are machine-generated
6. **Semantic by Default** - Auto-enrichment with intent and criticality

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run package tasks via turbo
pnpm test:workspace

# Run specific protocol tests
node --test data-protocol.test.js
node --test event-protocol.test.js
node --test api-protocol.test.js

# Run CMOS integration tests
node cmos/context/integration_test_runner.js
```

## 📚 Documentation

- **Architecture:** [Cross-Protocol Manifest System-k2.md](cmos/foundational-docs/Cross-Protocol%20Manifest%20System-k2.md)
- **CMOS Operations:** [operations-guide.md](cmos/docs/operations-guide.md)
- **Getting Started:** [getting-started.md](cmos/docs/getting-started.md)
- **Mission Templates:** [cmos/missions/templates/](cmos/missions/templates/)
- **Publishing Runbook:** [docs/publishing/npm-publishing-runbook.md](docs/publishing/npm-publishing-runbook.md)

## 🛠️ CMOS Management

This project uses CMOS (Cross-Mission Orchestration System) for sprint planning and mission tracking:

```bash
# View current missions
./cmos/cli.py db show current

# View backlog
./cmos/cli.py db show backlog

# Start a mission
./cmos/cli.py mission start B3.1_agent-protocol-validation

# Check database health
./cmos/cli.py db show current
```

## 🤝 Contributing

This is an open-source project. We balance providing great value to developers for free with reasonable testing and quality standards.

**Mission-Driven Development:**
- All work tracked through CMOS missions
- Sprints are session-based (not time-based)
- 4-10 missions per sprint based on complexity
- Database-first: SQLite is source of truth

## 📊 Performance Targets

- **Manifest Parsing:** ≤5ms p99 (1000 fields)
- **Diff Computation:** ≤10ms p99 (500 fields each)
- **Catalog Analysis:** ≤100ms p99 (100 manifests)
- **Event Throughput:** ≥1M events/sec (achieved 18M+ events/sec)
- **CLI Startup:** ≤500ms

## 🔒 Security

- **OWASP Top 10 Compliance** - All code validated against security standards
- **Zero Dependencies** - Minimal attack surface
- **Immutable Design** - Prevents state mutation vulnerabilities
- **Input Validation** - All manifest inputs validated
- **No eval()** - No dynamic code execution

## 📈 Roadmap

- **Phase 1** (Complete): Foundation & Data Protocol
- **Phase 2** (Complete): Event & API Protocols
- **Phase 3** (Complete): Agent & Semantic Protocols
- **Phase 4** (Planned): Documentation site, npm release
- **Phase 5** (Future): VS Code extension, PostgreSQL adapter

## 🔁 Release Automation

- Independent versioning via [Changesets](https://github.com/changesets/changesets); run `pnpm changeset` for every mission-level change.
- `.github/workflows/publish-packages.yml` installs with pnpm, runs `pnpm audit`, root/tests/builds, and either opens a Release PR or publishes on merge.
- Detailed operational guidance (tokens, verification, rollback) lives in [docs/publishing/npm-publishing-runbook.md](docs/publishing/npm-publishing-runbook.md).

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built with mission-driven development using CMOS orchestration system.

---

**Current Sprint:** Sprint 3 Complete - Phase 3 Agent & Semantic Protocols
**Last Updated:** 2025-11-08
**Repository:** https://github.com/kneelinghorse/Cross-Protocol-Manifest-System
