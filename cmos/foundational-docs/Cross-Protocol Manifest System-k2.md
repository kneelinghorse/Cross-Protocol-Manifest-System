# Technical Approach & Roadmap: Cross-Protocol Manifest System

## Technical Architecture

### 0) Executive Summary

This system provides a **declarative, self-describing protocol framework** that transforms codebases into observable systems of record. By representing datasets, events, APIs, and AI agents as versioned, validated manifests, it enables automated SDK generation, compliance checking, migration synthesis, and cross-service impact analysis—**all with zero external dependencies**.

The core innovation is a **shared architectural pattern** where each protocol uses an immutable factory, pluggable validators, a tiny query language, and semantic diffing. The Semantic Protocol (v3.2) acts as an analytical overlay, auto-enriching manifests with intent, criticality scores, and 64-dimensional vectors for similarity discovery, enabling system-wide reasoning via URN-based linking.

---

### 1) Goals / Non-Goals

**Goals:**
- Enable **GitOps for data contracts, APIs, events, and agents** via version-controlled manifests
- Provide **instant developer utility**: generate clients, tests, migrations, and docs from declarations
- Enforce **shift-left governance**: PII leakage detection, compatibility checks, and breaking-change prevention in CI
- Create a **unified query layer** across disparate system components using a shared query language
- Build a **semantic catalog** that automatically discovers relationships and predicts system impact

**Non-Goals:**
- **NOT** a runtime framework—these are design-time/build-time tools; no production overhead
- **NOT** a replacement for OpenAPI/AsyncAPI—rather, a complementary, more analytical layer
- **NOT** a blockchain or distributed ledger—URNs are symbolic references, not decentralized IDs
- **NOT** a schema registry service—manifests are files, though they can be served via HTTP
- **NOT** a full IDE/language server—focus is on CLI and library usage

---

### 2) System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     SEMANTIC LAYER (v3.2)                   │
│  (Intent, Criticality, Confidence, Vector, Similarity)     │
└────────────────────┬────────────────────────────────────────┘
                     │ URN-based References & Analysis
┌────────────────────┴────────────────────────────────────────┐
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ DATA (v1.1)  │  │ EVENT (v1.1) │  │ API (v1.1)   │    │
│  │              │  │              │  │              │    │
│  │ createData-  │  │ createEvent- │  │ createAPI-   │    │
│  │ Protocol()   │  │ Protocol()   │  │ Protocol()   │    │
│  │   ↓          │  │   ↓          │  │   ↓          │    │
│  │ Catalog      │  │ Catalog      │  │ Catalog      │    │
│  │ (Cycles,     │  │ (Flow,       │  │ (Discovery)  │    │
│  │  PII Egress) │  │  Compat)     │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│         └─────────┬────────┴──────────────────┘            │
│                   │                                      │
│         ┌─────────▼────────┐                               │
│         │  AGENT (v1.1)    │  (Capability Registration)  │
│         │  createAgent-    │  & Cross-Protocol Linking   │
│         │  Protocol()      │                             │
│         └─────────┬────────┘                               │
│                   │                                        │
└───────────────────┴────────────────────────────────────────┘
                    │
         ┌──────────▼─────────┐
         │  CLI / GitHub      │
         │  Action / Library  │
         └────────────────────┘
```

**Control Plane:** Manifest authoring, validation, diffing, and code generation via CLI/library  
**Data Plane:** Runtime consumption of generated SDKs, tests, and migrations; optional manifest serving for discovery

---

### 3) Core Components

#### Component: **Shared Foundation**
**Purpose:** Zero-dependency utilities used by all protocols

**Responsibilities:**
- `jsonCanon()`: Deterministic JSON serialization for stable hashing
- `hash()`: FNV-1a (fast) or SHA-256 (cryptographic) based on use case
- `dget()` / `dset()`: Dot-path navigation for query/mutation
- Validator registry: Pluggable, named validation functions
- Query parser: Tiny DSL (`:=:`, `contains`, `>`, `<`)

**Implementation:** Single `utils.js` file, no imports, copied into each protocol bundle

---

#### Component: **Protocol Factories**
**Purpose:** Immutable manifest wrappers with uniform API

**Responsibilities:**
- Accept plain manifest object, return frozen instance
- Provide: `manifest()`, `validate()`, `diff()`, `match()`, `set()`, `generate*()`
- Normalization: Auto-compute hashes, field-level metadata
- Immutable updates: `set()` returns new instance (functional pattern)

**Implementation:** Each protocol exports `create{Data|Event|API|Agent|Semantic}Protocol()`

---

#### Component: **Catalog System**
**Purpose:** Cross-entity analysis and system-wide validation

**Responsibilities:**
- Ingest multiple protocol instances
- Run bulk validations (e.g., detect lineage cycles)
- URN resolution and cross-references
- Export analysis results (warnings, errors, suggestions)

**Implementation:** `createDataCatalog()`, `createEventCatalog()`, `createSemanticCatalog()`

---

#### Component: **Semantic Engine**
**Purpose:** Analytical overlay that enriches and relates manifests

**Responsibilities:**
- Auto-calculate: intent (CRUDE), criticality (0-1), confidence (Bayesian), semantic vector (64-dim)
- Protocol bindings: `requires`/`provides` linking via URNs
- Similarity discovery: Cosine similarity between vectors
- Cross-validation: Ensure URN references exist and are compatible

**Implementation:** `SemanticProtocolV32` class with `_resolveIntent()`, `_calculateCriticality()`, etc.

---

### 4) Primary Interface/API

#### Operation: `createDataProtocol(manifestInput)`

**Input:** Plain JavaScript object matching `DataManifest` shape

**Output:** Frozen instance with methods:
- `manifest()` → cloned manifest
- `validate(names?)` → `{ok, results[]}`
- `diff(other)` → `{changes[], breaking[], significant[]}`
- `match('schema.fields:contains:email')` → boolean
- `generateMigration(toManifest)` → SQL-like migration steps
- `set('path', value)` → new protocol instance

**Behavior:**
1. Normalizes input: computes `schema_hash`, `field_hashes`
2. Freezes instance to prevent mutation
3. Provides query access without external dependencies

**Example:**
```javascript
const users = createDataProtocol({
  dataset: { name: 'users', lifecycle: { status: 'active' } },
  schema: {
    primary_key: 'id',
    fields: {
      id: { type: 'string', required: true },
      email: { type: 'string', pii: true }
    }
  },
  governance: { policy: { classification: 'pii' } }
});

users.match('governance.policy.classification:=:pii') // true
```

---

### 5) Internal Service APIs

#### API: `Semantic Catalog Discovery`

**Request:** `POST /semantic/discover` with `{ vectors: [...] }`

**Response:** `{ relationships: [{ from, to, similarity }] }`

**Purpose:** Enable AI agents or tools to find related manifests by semantic similarity

**Transport:** HTTP (manifests can be served statically or via microservice)

---

### 6) Data Model

#### Entity: `URN Reference`

**Fields:**
- `urn` (string) | `urn:proto:data:user_events@v1.1.1#schema.fields.email` | Must match URN regex
- `purpose` (string?) | "consumes", "produces", "requires", "provides" | Semantic relationship
- `requires` (string[]?) | List of capability names needed
- `provides` (string[]?) | List of capability names offered

**Relationships:** Links Data → Event → API → Agent manifests

---

#### Entity: `SemanticVector`

**Fields:**
- `vector` (number[64]) | Normalized cosine similarity vector | Computed from type + purpose + description
- `confidence` (number) | 0-1 Bayesian confidence score | Based on manifest completeness
- `criticality` (number) | 0-1 composite score | `impact × 0.4 + visibility × 0.2 + PII × 0.3 + blastRadius × 0.1`

---

### 7) Canonical Flows

#### **Flow: Developer Adds PII Field to Dataset**

1. **Developer** edits `user_events.manifest.json`: adds `ssn: { type: 'string', pii: true }`
2. **CLI** runs `proto validate user_events.manifest.json`
3. **Data Protocol Validator** `governance.pii_policy` flags: *PII present but classification is 'internal'*
4. **Developer** updates classification to `pii`
5. **CLI** runs `proto diff HEAD~1` → detects PII addition as **significant** (not breaking)
6. **GitHub Action** passes and posts comment: *"⚠️ PII field added; ensure encryption policy"*
7. **Semantic Catalog** recomputes criticality score: increases from 0.5 → 0.8
8. **Impact Analysis** queries: `proto query 'relationships.targets:contains:user_events'` → finds 3 downstream agents needing review

---

#### **Flow: API Breaking Change Detection in CI**

1. **Developer** changes `GET /v1/users/{id}` response schema: removes `email` field
2. **API Protocol Diff** flags: *breaking change on `validation.schema_hashes.response`* and *endpoint signature changed*
3. **GitHub Action** runs `proto diff main --fail-on=breaking` → exits with error
4. **Developer** must either:
   - Bump `service.version` to `2.0.0` and add compatibility policy, OR
   - Keep `email` as optional with deprecation notice
5. **Semantic Protocol** validates no active agents depend on removed field
6. **Migration Path**: Auto-generates SDK changelog showing field removal

---

### 8) Performance, Caching & SLOs

**SLO Targets:**
- **Manifest Parsing**: ≤ 5ms p99 (single protocol, 1000 fields)
- **Diff Computation**: ≤ 10ms p99 (two manifests, 500 fields each)
- **Catalog Analysis**: ≤ 100ms p99 (100 manifests, cycle detection)
- **Semantic Vector**: ≤ 50ms p99 (single manifest)

**Caching Strategy:**
- **Validation Results**: Cache in `node_modules/.proto-cache/`, TTL: 1 hour, keyed by manifest hash
- **Generated SDKs**: Cache in `.proto-generated/`, invalidated on manifest change
- **Semantic Vectors**: Precompute at CI time, store in manifest metadata

**Optimization:**
- **Hashing**: FNV-1a for structural diffs (fast), SHA-256 for cryptographic needs
- **Query Indexing**: Build inverted index of URN references in catalogs for O(1) lookups
- **Diff Short-Circuit**: Compare top-level hashes first; skip deep walk if identical

---

### 9) Security, Governance, Cost Controls

**Authentication (AuthN):**
- Manifests can be signed: `sig: { spec, protected, payload, hash, signature, header }`
- Signature algorithms: EdDSA, ES256
- Verification is optional; immutable instances prevent tampering post-load

**Authorization (AuthZ):**
- **PII Egress Control**: `piiEgressWarnings()` detects PII datasets consumed by external consumers
- **Delegation Chains**: Agent Protocol enforces signature verification when `authorization.delegation_supported=true`

**Rate Limits:**
- API Protocol defines consumption limits, but enforcement is external (e.g., Kong, AWS API Gateway)
- Manifests describe limits for client SDK generation and documentation

**Audit Trail:**
- All generator outputs (SDKs, migrations, tests) include provenance comment: `// Generated from manifest <hash> at <timestamp>`
- Semantic Catalog logs all cross-protocol link validations

**Cost Controls:**
- **CLI Guardrails**: `proto validate --max-size=1MB` prevents oversized manifests
- **Catalog Limits**: `createDataCatalog(protocols, { maxItems: 1000 })`
- **Rate Limit Static Analysis**: Find endpoints with `limit>10000` and flag for review

---

### 10) Observability

**System Metrics:**
- `proto_manifests_loaded_total`: Counter of manifests processed
- `proto_validations_failed_total`: Counter by validator name and severity
- `proto_breaking_changes_detected_total`: Counter by protocol type
- `proto_generation_duration_ms`: Histogram of code generation latencies
- `proto_catalog_analysis_duration_ms`: Histogram of catalog operations

**Infrastructure Metrics:**
- File I/O latency for manifest loading
- Memory usage of semantic vector computations
- Cache hit rate for validation results

**Tracing Spans:**
- `validate(manifest)` → `runValidators()` → `validator[name]()`
- `diff(a, b)` → `normalize()` → `walk()` → `breaking_heuristics()`
- `semantic.analyze()` → `_resolveIntent()` → `_calculateCriticality()`

**Events:**
- `manifest.validated`: { urn, ok, validator_results }
- `breaking.change.detected`: { protocol, path, reason, sha }
- `catalog.cycle.found`: { datasets: [...], cycle_path: [...] }
- `agent.capability.linked`: { agent_urn, target_urn, purpose }

---

### 11) Deployment & Release

**Deployment Architecture:**
- **npm Packages**: Publish each protocol as `@cpms/{data,event,api,agent,semantic}` + `@cpms/cli`
- **Monorepo Structure**: Lerna/Nx for coordination; each protocol is standalone
- **Static Hosting**: Manifests served from S3/GitHub Pages for discovery
- **Serverless Option**: Lambda@Edge for URN resolution and semantic similarity queries

**Release Process:**
1. **Versioning**: Protocols follow semver (manifest format version in `version` field)
2. **Canary**: CLI features released behind `--experimental` flag
3. **Rollback**: Manifests are immutable; rollback is file revert + cache purge

**Disaster Recovery:**
- Manifests stored in Git; no persistence layer to recover
- Generated code can be regenerated from manifests
- Semantic vectors recomputed on-demand if cache lost

---

### 12) Testing & Benchmarking

**Unit/Integration Tests:**
- **Schema Validation**: 100+ malformed manifests, assert validator catches each issue
- **Diff Correctness**: Property-based tests: generate random manifests, assert diff symmetry
- **URN Validation**: Test all valid URN patterns and common invalid formats
- **Generator Idempotence**: Run generator twice, assert identical output

**Quality Benchmarks:**
- **Coverage**: ≥ 95% line coverage for each protocol
- **Bundle Size**: Each protocol ≤ 10KB minified (shared utils deduped)
- **Startup Time**: CLI ready in ≤ 500ms

**Resilience Testing:**
- **Malformed Input**: Each function handles `null`, `undefined`, circular refs gracefully
- **Large Manifests**: Test with 10,000 fields; assert memory usage < 100MB
- **Concurrent Catalogs**: 100 catalogs created simultaneously; no race conditions

**Performance Testing:**
- **Hashing**: 1M operations/sec for FNV-1a, 100K ops/sec for SHA-256
- **Diff**: Compare two 500-field manifests in < 10ms
- **Query**: Execute 1000 queries against 100-manifest catalog in < 50ms

---

### 13) Reference Interfaces

#### **URN Reference Schema**
```typescript
interface URNReference {
  urn: string; // urn:proto:{type}:{id}@{version}#{fragment}
  purpose?: 'consumes' | 'produces' | 'requires' | 'provides';
  requires?: string[]; // capability names needed
  provides?: string[]; // capability names offered
}
```

#### **Protocol Instance Interface**
```typescript
interface ProtocolInstance<TManifest> {
  manifest(): TManifest;
  validate(names?: string[]): { ok: boolean; results: any[] };
  diff(other: ProtocolInstance): { changes: any[]; breaking: any[]; significant: any[] };
  match(expr: string): boolean;
  set(path: string, value: any): ProtocolInstance<TManifest>;
}
```

---

### 14) Roadmap (High-Level)

**MVP (4 weeks):**
- ✅ Shared foundation utilities
- ✅ Data Protocol with diff & migration generator
- ✅ Event Protocol with compatibility checker
- ✅ CLI tool with `validate`, `diff`, `generate migration`
- ✅ 100% unit test coverage

**Phase 2 (4 weeks):**
- ✅ API Protocol with SDK generator
- ✅ Catalog system (Data + Event)
- ✅ GitHub Action for CI integration
- ✅ Performance benchmarks

**Phase 3 (4 weeks):**
- ✅ Agent Protocol with URN linking
- ✅ Semantic Protocol (intent, criticality, vectors)
- ✅ CLI `query` and `graph` commands
- ✅ Agent Card generator

**Phase 4 (4 weeks):**
- ✅ Full documentation site
- ✅ Example repo with real-world manifests
- ✅ npm monorepo release
- ✅ Community contributor guide

**Phase 5 (Ongoing):**
- VS Code extension for manifest editing
- PostgreSQL manifest store adapter
- CloudFormation/Terraform generator
- AI assistant fine-tuned on semantic vectors

---

### 15) Open Questions

- **Q1:** Should we support JSONPath in addition to the tiny query DSL for power users?
- **Q2:** How to handle URN versioning when target manifest version is bumped? Implicit latest or explicit pinning?
- **Q3:** For generated SDKs, should we support multiple HTTP clients (axios, fetch, got) or enforce fetch-only?
- **Q4:** Should semantic vectors be computed on-demand or precomputed in CI? Tradeoff: freshness vs. performance.
- **Q5:** How to handle circular URN references in catalogs? Detect and warn, or fail validation?

---

## High-Level Implementation Roadmap

### Vision Statement

Create the **universal system of record for modern software architecture**—a manifest-first toolchain that makes APIs, events, datasets, and AI agents **self-describing, automatically validated, and intelligently connected**. Developers stop writing boilerplate SDKs, tests, and migrations; instead, they **declare the contract, and the system generates the rest**.

**Core Philosophy:** *The manifest is the source of truth. Everything else is a derived artifact.*

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PROTOCOL LAYER                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌────────┐      │
│  │ Data │  │ Event│  │ API  │  │ Agent│  │Semantic│      │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └───┬────┘      │
│     │         │         │         │         │            │
┌─────▼─────────▼─────────▼─────────▼─────────▼────────────┐│
│  SHARED FOUNDATION (Utils, Validators, Query, Diff)      ││
│  • jsonCanon  • hash  • dget/dset  • clone                ││
│  • registerValidator  • runValidators                     ││
└────────────────────────────────────────────────────────────┘
```

---

### Implementation Plan (20 Weeks)

#### **Phase 1: Foundation & Data Protocol (Weeks 1-4)**

**Goal:** Deliver the core pattern and first working protocol.

**Deliverables:**
- `@cpms/core` package (utilities, validator registry)
- `@cpms/data` package (Data Protocol v1.1.1)
- `proto` CLI with `validate` and `diff` commands
- GitHub repo with MIT license and contributor guide

**Tools/Features:**
```
- proto validate --manifest=data.users.json
- proto diff --from=v1.json --to=v2.json --format=json
- proto generate migration --from=v1.json --to=v2.json
```

**Each [component] includes:**
- **Unit tests**: 100% coverage, property-based diff testing
- **README**: Usage examples for manifest shapes
- **Benchmarks**: Hashing and parsing performance baselines

---

#### **Phase 2: Event & API Protocols (Weeks 5-8)**

**Goal:** Expand to event-driven and API-first use cases.

**Deliverables:**
- `@cpms/event` package (Event Protocol v1.1.1)
- `@cpms/api` package (API Protocol v1.1.1)
- `proto` CLI with `generate sdk` and `generate tests`
- DataCatalog and EventCatalog implementations

**Tools/Features:**
```
- proto generate sdk --manifest=api.billing.json --lang=ts
- proto generate tests --manifest=event.payment.json
- proto catalog analyze --glob="**/*.event.json" --find-cycles
```

**Each [component] includes:**
- **Integration tests**: Cross-protocol URN validation
- **Examples**: Real-world Kafka event + Express API manifests
- **TypeScript types**: Exported from each package

---

#### **Phase 3: Catalogs & Cross-Protocol Linking (Weeks 9-12)**

**Goal:** Enable system-wide analysis and linking.

**Deliverables:**
- `@cpms/catalog` package (combined analysis engine)
- `@cpms/agent` package (Agent Protocol v1.1.1)
- URN resolver service (static or serverless)
- CLI `query` and `graph` commands

**Tools/Features:**
```
- proto query 'agent.capabilities.tools:contains:refund'
- proto graph --manifest=agent.support.json --format=mermaid
- proto catalog validate --cross-protocol --fail-on=unresolved-urn
```

**Each [component] includes:**
- **URN validation**: Regex + existence checks in catalog
- **Flow analysis**: Event → Service → Consumer mapping
- **Cycle detection**: In data lineage and event flows

---

#### **Phase 4: Semantic Layer & Intelligence (Weeks 13-16)**

**Goal:** Add analytical capabilities and self-enrichment.

**Deliverables:**
- `@cpms/semantic` package (Protocol v3.2.0)
- Semantic vector computation engine
- Similarity discovery in catalogs
- Agent Card generator

**Tools/Features:**
```
- proto semantic enrich --manifest=data.users.json
- proto semantic discover --threshold=0.85 --output=graph.json
- proto generate agent-card --manifest=agent.support.json
```

**Each [component] includes:**
- **ML-ready**: Semantic vectors exportable to Pinecone/Weaviate
- **Confidence tuning**: Bayesian prior adjustment via config
- **Criticality rules**: Pluggable scoring functions

---

#### **Phase 5: Release & Ecosystem (Weeks 17-20)**

**Goal:** Polish, document, and release to open source.

**Deliverables:**
- Documentation site (Docusaurus with live playground)
- GitHub Action: `proto/validate-action@v1`
- Example monorepo with full-stack usage
- npm monorepo release automation

**Tools/Features:**
```
- npm install -g @cpms/cli
- uses: proto/validate-action@v1
- docker run -v $(pwd):/manifests proto/cli validate --glob="**/*.json"
```

**Each [component] includes:**
- **Performance**: Bundle size <10KB per protocol (minified)
- **Security**: Dependency audit, signed releases
- **Community**: Issue templates, Discord server, contribution guide

---

### Success Metrics

**Adoption Metrics:**
- **100** GitHub stars within 30 days of launch
- **50** weekly npm downloads by Week 24
- **10** external contributors by Week 30

**Quality Metrics:**
- **95%** unit test coverage maintained
- **0** reported security vulnerabilities
- **<500ms** CLI startup time (95th percentile)

**Performance Metrics:**
- **10ms** p99 diff latency for 500-field manifests
- **50ms** p99 query latency across 100-manifest catalog
- **1M** hashes/sec throughput on 4-core VM

---

### Key Design Principles

1. **Zero Dependencies**: Every protocol file runs standalone; no `npm install` required for core functionality
2. **Immutability**: All instances frozen; updates return new instances; eliminates state bugs
3. **URN-First**: All cross-protocol references are URNs, enabling loose coupling and discovery
4. **Pluggable Everything**: Validators, hash functions, query operators are all replaceable
5. **Generate, Don't Write**: SDKs, docs, tests, migrations are machine-generated; humans write manifests
6. **Semantic by Default**: Even simple manifests get auto-enriched with intent and criticality

---

### Getting Started (Week 0)

```bash
# Install CLI
npm install -g @cpms/cli

# Initialize a manifest from your database
proto init --from=postgres://localhost/mydb > data.users.json

# Validate it
proto validate --manifest=data.users.json

# See what changed
git diff data.users.json | proto diff --from-stdin
```

**Manifest Example:**
```json
{
  "dataset": { "name": "user_events", "lifecycle": { "status": "active" } },
  "schema": {
    "fields": {
      "event_id": { "type": "string", "required": true },
      "user_id": { "type": "string", "required": true }
    }
  }
}
```

---

This technical approach and roadmap deliver a **practical, powerful open-source tool** that gives developers immediate value (code generation) while building toward a **semantic platform** that makes entire systems observable and AI-ready.