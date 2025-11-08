# Cross-Protocol Manifest System - AI Agent Configuration

## Project Overview
**Project Name:** Cross-Protocol Manifest System  
**Project Type:** Open-source protocol framework (npm packages)  
**Primary Language:** TypeScript/JavaScript (protocol implementations) with Python (CMOS tooling)  
**Framework:** Zero-dependency vanilla JavaScript + Node.js tooling  
**Repository Structure:** Monorepo with CMOS orchestration layer

**Core Philosophy:** *The manifest is the source of truth. Everything else is a derived artifact.*

---

## Build & Development Commands

### Protocol Development (Root Directory)
```bash
# Install dependencies (if needed for development tooling)
npm install

# Run tests for protocol implementations
npm test

# Run benchmarks
npm run benchmark

# Lint code
npm run lint

# Format code
npm run format
```

### CMOS Operations (cmos/ directory)
```bash
# Check mission status
python3 cmos/scripts/mission_runtime.py status

# Start a mission
python3 cmos/scripts/mission_runtime.py start --mission MISSION_ID --summary "Description" --agent "Agent Name"

# Complete a mission
python3 cmos/scripts/mission_runtime.py complete --mission MISSION_ID --summary "Results"

# Validate database/file parity
python3 cmos/scripts/validate_parity.py

# Seed SQLite database (if needed)
python3 cmos/scripts/seed_sqlite.py
```

**IMPORTANT:** Never manually edit mission statuses in YAML files. Always use the CMOS scripts above.

---

## Critical Agent Rules - READ FIRST

### 🚫 FORBIDDEN - DO NOT MODIFY
- **NEVER** modify files in `cmos/` directory except `cmos/PROJECT_CONTEXT.json`
- **NEVER** manually edit `cmos/missions/backlog.yaml` or `cmos/SESSIONS.jsonl`
- **NEVER** edit `cmos/context/MASTER_CONTEXT.json` directly (use SQLite)
- **NEVER** create files in `cmos/` subdirectories without explicit instruction
- **NEVER** bypass CMOS scripts for mission lifecycle operations

### ✅ REQUIRED - ALWAYS DO
- **ALWAYS** load this `agents.md` file before starting any work
- **ALWAYS** use `python3 cmos/scripts/mission_runtime.py` for mission operations
- **ALWAYS** validate parity after database operations: `python3 cmos/scripts/validate_parity.py`
- **ALWAYS** maintain 100% test coverage for protocol code
- **ALWAYS** follow OWASP Top 10 security guidelines
- **ALWAYS** use immutable patterns (no object mutation)
- **ALWAYS** maintain zero dependencies for core protocol files

---

## Project Structure & Navigation

### Root Directory (Protocol Implementation)
```
project-root/
├── agents.md                      # This file - root agent instructions
├── utils.js                       # Foundation utilities (B1.1 deliverable)
├── utils.test.js                  # Foundation tests
├── data-protocol.js               # Data Protocol implementation (B1.2)
├── api-protocol.js                # API Protocol (future)
├── event-protocol.js              # Event Protocol (future)
├── agent-protocol.js              # Agent Protocol (future)
├── semantic-protocol.js           # Semantic Protocol (future)
├── package.json                   # Root package configuration
└── README.md                      # Project documentation
```

### CMOS Directory (Orchestration - DO NOT MODIFY)
```
cmos/                              # CMOS orchestration system
├── agents.md                      # CMOS-specific agent rules (DO NOT EDIT)
├── PROJECT_CONTEXT.json           # Project state (OK to update)
├── SESSIONS.jsonl                 # Session log (auto-generated)
├── missions/                      # Mission definitions
├── workers/                       # Worker configurations
├── scripts/                       # Mission runtime scripts
├── db/                            # SQLite database (canonical store)
└── context/                       # Context files
```

**Rule:** The root directory contains protocol implementations. The `cmos/` directory contains orchestration tooling. Keep them separate.

---

## Coding Standards & Style

### Protocol Implementation (JavaScript/TypeScript)
- **Zero Dependencies:** Core protocol files must have NO external dependencies
- **Immutability:** All functions must be pure; no object mutation
- **Functional Patterns:** Use `const` and arrow functions; avoid classes
- **JSDoc:** Document all public APIs with JSDoc comments
- **Naming:** Descriptive function and variable names
- **Error Handling:** Graceful handling of null, undefined, circular refs
- **Performance:** Meet benchmark targets (1M hashes/sec, <5ms parsing)

### CMOS Tooling (Python)
- **Database-First:** SQLite is canonical; files are mirrors
- **Parity Validation:** Always validate after database operations
- **Script Usage:** Use provided scripts; don't bypass tooling
- **Error Handling:** Check exit codes and validate outputs

---

## Security & Quality Guardrails

### OWASP Top 10 Compliance
- **A01: Broken Access Control:** Validate all inputs; principle of least privilege
- **A02: Cryptographic Failures:** Use SHA-256 for security-sensitive operations
- **A03: Injection:** No eval(); validate all manifest inputs
- **A04: Insecure Design:** Immutable patterns; defense in depth
- **A05: Security Misconfiguration:** Secure defaults; minimal attack surface
- **A06: Vulnerable Components:** Zero dependencies = minimal vulnerability surface
- **A07: Auth Failures:** Not applicable (design-time tool)
- **A08: Integrity Failures:** Hash verification; signed manifests
- **A09: Logging Failures:** Comprehensive telemetry in CMOS
- **A10: SSRF:** Not applicable (no network requests in core)

### Input Validation Requirements
- Validate all manifest fields against schema
- Sanitize data before processing
- Implement length limits and format validation
- Use whitelist approach for allowed inputs
- Log validation failures for monitoring

### Performance & Efficiency
- **Hashing:** 1M ops/sec (FNV-1a), 100K ops/sec (SHA-256)
- **Parsing:** < 5ms for 1000-field manifests
- **Diff:** < 10ms for 500-field manifests
- **Memory:** < 100MB for 10,000 field manifests
- **CLI Startup:** < 500ms

---

## Architecture Patterns

### Manifest-First Development
1. **Declare:** Write manifest files describing contracts
2. **Validate:** Use protocol validators to check manifests
3. **Generate:** Auto-generate SDKs, tests, migrations, docs
4. **Evolve:** Use diff and migration tools for changes

### Core Patterns
- **Immutable Factory:** `createDataProtocol(manifest)` returns frozen instance
- **Functional Updates:** `protocol.set(path, value)` returns new instance
- **URN References:** All cross-protocol links use URN format
- **Pluggable Validators:** Validator registry for extensibility
- **Zero Dependencies:** Standalone protocol files

### Project-Specific Patterns
- **Database-First CMOS:** SQLite is source of truth; files are mirrors
- **Mission-Driven:** All work tracked through CMOS missions
- **Delegation Orchestration:** Multiple workers per mission
- **LLM-as-Judge:** Automated validation with Gemini + Claude

---

## AI Agent Specific Instructions

### Context Loading Priority
1. **Load this agents.md** (root project instructions)
2. **Load cmos/agents.md** (CMOS orchestration rules)
3. **Load cmos/PROJECT_CONTEXT.json** (current session state)
4. **Load cmos/context/MASTER_CONTEXT.json** (project history)
5. **Check SQLite database** for canonical mission status

### Pre-Flight Checklist (Before Each Mission)
- [ ] Load and review this agents.md file
- [ ] Confirm active mission via `python3 cmos/scripts/mission_runtime.py status`
- [ ] Validate database parity: `python3 cmos/scripts/validate_parity.py`
- [ ] Review mission YAML in `cmos/missions/`
- [ ] Check worker assignments in `cmos/workers/manifest.yaml`

### Mission Execution Rules
- **Scope Boundaries:** Never expand mission scope; split if needed
- **File Locations:** 
  - Protocol code → root directory
  - Tests → root directory (or appropriate subdirs)
  - Documentation → root directory
  - **NEVER** place implementation files in `cmos/`
- **Database Operations:** Always use CMOS scripts; never direct DB edits
- **Status Updates:** Use mission_runtime.py for all status changes
- **Telemetry:** Log events per mission requirements

### Tool Usage Guidelines
- **File Operations:** Use write_to_file, apply_diff, read_file as needed
- **Commands:** Use execute_command for npm, python3 scripts
- **Database:** Use execute_command with python3 scripts (never direct SQLite)
- **Validation:** Always run parity validation after DB operations

### Communication Style
- Be concise and direct in responses
- Use structured formats (lists, tables, code blocks)
- Provide confidence levels for uncertain information
- Ask clarifying questions when requirements are ambiguous
- Document all decisions in mission notes

---

## CMOS-Specific Rules

### Database-First Approach
- **Canonical Store:** `cmos/db/cmos.sqlite` is source of truth
- **File Mirrors:** JSON/YAML files are readable copies only
- **Parity Validation:** Always run after database changes
- **Script Usage:** Use provided Python scripts for all operations

### Mission Lifecycle (MANDATORY)
1. **Start:** `python3 cmos/scripts/mission_runtime.py start --mission ID --summary "Desc" --agent "Name"`
2. **Execute:** Do the work, log telemetry
3. **Complete:** `python3 cmos/scripts/mission_runtime.py complete --mission ID --summary "Results"`
4. **Validate:** `python3 cmos/scripts/validate_parity.py`

### Forbidden Operations
- ❌ Direct SQLite database edits
- ❌ Manual YAML/JSON file edits for mission status
- ❌ Creating files in `cmos/` subdirectories
- ❌ Bypassing CMOS scripts
- ❌ Modifying `cmos/agents.md` or `cmos/context/MASTER_CONTEXT.json`

---

## Project-Specific Context

### Active Mission
**Mission:** B1.1_core-foundation (In Progress)  
**Objective:** Create zero-dependency foundation utilities  
**Worker Pattern:** Delegation (implementation.backend + research.code-analysis)  
**Success Criteria:** 100% coverage, 1M hashes/sec, zero dependencies

### Current Phase
**Phase:** Phase 1 - Foundation & Data Protocol (Weeks 1-4)  
**Sprint:** SPRINT-01-PHASE1  
**Total Missions:** 4 (B1.1 → B1.2 → B1.3 → B1.4)

### Key Deliverables
- utils.js (foundation utilities)
- data-protocol.js (Data Protocol v1.1.1)
- CLI tools (validate, diff, generate)
- Test suite (100% coverage)

---

## Reference Documents

### Primary References
- [`foundational-docs/Cross-Protocol Manifest System-k2.md`](foundational-docs/Cross-Protocol Manifest System-k2.md) - Technical architecture
- [`docs/initial-implementation-plan.md`](docs/initial-implementation-plan.md) - Implementation roadmap
- [`cmos/agents.md`](cmos/agents.md) - CMOS orchestration rules
- [`cmos/workers/manifest.yaml`](cmos/workers/manifest.yaml) - Worker capabilities

### CMOS Documentation
- [`cmos/docs/cmos_Playbook.md`](cmos/docs/cmos_Playbook.md) - CMOS operations
- [`cmos/docs/AI-coding-assistant-workflows.md`](cmos/docs/AI-coding-assistant-workflows.md) - Agent workflows
- [`cmos/docs/Agentic_Migration_Playbook.md`](cmos/docs/Agentic_Migration_Playbook.md) - Migration guide

### Mission Protocol Templates
- [`cmos/missions/templates/Build.Implementation.v1.yaml`](cmos/missions/templates/Build.Implementation.v1.yaml) - Implementation template
- [`cmos/missions/B1.1_core-foundation.yaml`](cmos/missions/B1.1_core-foundation.yaml) - Current mission spec

---

## Emergency Procedures

### If Parity Validation Fails
1. Stop all operations
2. Run `python3 cmos/scripts/validate_parity.py --verbose`
3. Identify discrepancies
4. If file is outdated: refresh from database
5. If database is outdated: restore from backup or re-seed
6. Do not proceed until parity is restored

### If Mission Status Conflicts
1. Check SQLite database: `SELECT * FROM missions WHERE id = 'MISSION_ID'`
2. Check file mirror: `cat cmos/missions/backlog.yaml`
3. Use database as source of truth
4. Update file mirror to match database
5. Validate parity before continuing

### If Agents.md Not Loaded
1. Immediately load this file
2. Review all instructions before proceeding
3. Validate understanding of forbidden operations
4. Confirm active mission and scope
5. Do not execute any commands until agents.md is loaded

---

**Last Updated:** 2025-11-07  
**Version:** 1.0.0  
**Maintained by:** Cross-Protocol Manifest System Team  
**CMOS Version:** 2.0.0  
**Mission Protocol Version:** v2

**⚠️ CRITICAL:** This file is mandatory for all AI agents working on this project. Load and review before every session.