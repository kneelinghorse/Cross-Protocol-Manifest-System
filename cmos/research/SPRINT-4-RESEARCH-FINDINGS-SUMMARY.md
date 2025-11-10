# Sprint 4 Research Findings Summary
**Date:** November 10, 2025  
**Status:** Complete - Ready for Build Phase

This document consolidates all research findings from R4.1, R4.2, and R4.3 for quick reference during build missions.

---

## R4.1: npm Monorepo Tooling Research - KEY FINDINGS

### Executive Decision: Best-of-Breed Stack

**Recommendation:** Use a layered, best-in-class tooling stack (NOT a monolithic framework):

1. **Foundation:** `pnpm workspaces` (NON-NEGOTIABLE)
2. **Orchestration:** `Turborepo`
3. **Bundling:** `tsup` (using esbuild)
4. **Publishing:** `Changesets`

### Critical Architecture: Zero-Dependency Strategy

**Problem:** How to share code (utils.js) while maintaining zero runtime dependencies?

**Solution:** Internal devDependencies + Build-Time Inlining

```
internal/
  └── utils/          # @proto/utils (devDependency only)
packages/
  └── core/           # Depends on @proto/utils as devDependency
      └── package.json: { "devDependencies": { "@proto/utils": "workspace:*" } }
```

**How It Works:**
1. `pnpm add @proto/utils --filter @proto/core --save-dev`
2. At build time, `tsup` (via esbuild) **inlines** the code from `@proto/utils` directly into `@proto/core`'s output
3. Published `@proto/core` on npm has **zero** entries in `dependencies` block

### Package Structure

```
/ (root)
├── internal/
│   ├── utils/         # @proto/utils (shared code, devDep only)
│   ├── eslint-config/ # @proto/eslint-config
│   └── tsconfig/      # @proto/tsconfig
├── packages/
│   ├── core/          # @proto/core (published to npm)
│   ├── data/          # @proto/data (published to npm)
│   ├── event/         # @proto/event (published to npm)
│   ├── api/           # @proto/api (published to npm)
│   ├── agent/         # @proto/agent (published to npm)
│   ├── semantic/      # @proto/semantic (published to npm)
│   ├── catalog/       # @proto/catalog (published to npm)
│   └── cli/           # @proto/cli (published to npm)
├── .changeset/        # Changesets configuration
├── pnpm-workspace.yaml
├── turbo.json
└── package.json       # Root (private: true)
```

### Critical Configuration Templates

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
  - 'internal/*'
```

**turbo.json:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "check-size": {
      "dependsOn": ["build"]
    }
  }
}
```

**packages/core/tsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],        // Both CJS and ESM
  dts: true,                     // Generate .d.ts files
  splitting: true,               // Code splitting
  clean: true,                   // Clean dist/ before build
  treeshake: true,               // Tree-shaking
  minify: true,                  // Minify output
  // tsup automatically bundles devDependencies and externalizes dependencies
});
```

**packages/core/package.json (CRITICAL):**
```json
{
  "name": "@proto/core",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "sideEffects": false,              // CRITICAL for tree-shaking
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint .",
    "check-size": "monosize --threshold 10kb"
  },
  "dependencies": {
    "//": "This block MUST be empty - enforced by CI gate"
  },
  "devDependencies": {
    "@proto/utils": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

### CI/CD Pipeline - Zero-Dependency Enforcement Gate

**.github/workflows/ci.yml:**
```yaml
- name: Check for Zero-Dependencies (CI Gate)
  run: |
    if [ -n "$(find packages -name package.json -print0 | xargs -0 -I {} sh -c 'jq ".dependencies | select(.) | select(length > 0)" {}')" ]; then
      echo "::error:: Found packages with runtime dependencies."
      echo "All published packages must be zero-dependency."
      echo "Shared code must be in internal/utils as devDependency."
      exit 1
    fi
    echo "Zero-dependency constraint verified."
```

### Publishing Workflow - Changesets

**.github/workflows/release.yml:**
```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      
      - uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm -r publish --no-git-checks
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Local Development Commands

```bash
# Install all dependencies (one time)
pnpm install

# Build everything
turbo run build

# Develop single package (watch mode)
turbo run dev --filter=@proto/core

# Build package and its dependencies
turbo run build --filter=@proto/data

# Run tests with caching
turbo run test

# Check bundle sizes
turbo run check-size
```

### Versioning Strategy: Independent Versioning

Each package has its own semver version. Use Changesets workflow:

```bash
# Developer makes changes, then:
pnpm changeset add
# (Select packages, version bump type, summary)

# CI automatically:
# 1. Creates "Release PR" with version bumps
# 2. Team reviews and merges Release PR
# 3. Merging triggers publish to npm
```

---

## R4.2: Documentation Site Research - KEY FINDINGS

### Executive Decision: WASM-in-a-Worker Playground

**Architecture:** Live playground uses WebAssembly inside a Web Worker

**Why:**
- **WASM:** Provides security sandbox (no DOM/network access)
- **Worker:** Provides UI concurrency (non-blocking)
- **Combined:** Best of both worlds

**Rejected Alternatives:**
- JS-in-Worker: No security sandbox
- Hybrid-Serverless: Violates "in-browser" constraint
- WASM-in-Main-Thread: Blocks UI

### Stack Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Docusaurus v3 | Requires React 18 for `React.lazy()` |
| **Editor** | Monaco Editor | Via `@monaco-editor/react` wrapper |
| **Validation** | WASM module | Compiled protocols in sandbox |
| **Search** | Algolia DocSearch | Free for OSS, excellent perf |
| **Deployment** | Cloudflare Pages | Best global TTFB (~50ms), native WASM support |

### Critical Implementation Patterns

#### Pattern 1: Lazy Playground Loading (Performance)

**Problem:** Monaco Editor is massive, kills LCP target

**Solution:** Route-level code splitting with React.lazy()

```javascript
// src/components/LazyPlayground.js
import React, { Suspense } from 'react';

const PlaygroundComponent = React.lazy(() => import('./PlaygroundComponent'));

export default function LazyPlayground() {
  return (
    <Suspense fallback={<div>Loading Playground...</div>}>
      <PlaygroundComponent />
    </Suspense>
  );
}
```

**Result:** Playground bundle only loads when user visits `/playground` page

#### Pattern 2: JSON Schema for IntelliSense (80/20 Solution)

**Problem:** Building custom LSP is over-engineering

**Solution:** Inject JSON schema into Monaco's built-in JSON service

```javascript
function handleEditorDidMount(editor, monaco) {
  const manifestSchema = {
    uri: "http://example.com/manifest-schema.json",
    fileMatch: ["*"],
    schema: {
      type: "object",
      properties: {
        protocol: {
          description: "Protocol ID",
          enum: ["data-protocol", "event-protocol", "api-protocol"]
        },
        // ... more schema
      },
      required: ["protocol", "version"]
    }
  };
  
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [manifestSchema]
  });
}
```

**Result:** Automatic validation, autocomplete, hover documentation - 90% functionality, 10% effort

#### Pattern 3: WASM-in-Worker Data Flow

**Main Thread → Worker → WASM → Worker → Main Thread**

```javascript
// Main Thread (PlaygroundEditor.js)
const worker = new Worker(new URL('./validator.worker.js', import.meta.url));

editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  const version = editor.getModel().getVersionId();
  worker.postMessage({ code, version });
});

worker.onmessage = (event) => {
  const { errors, version } = event.data;
  if (model.getVersionId() === version) { // Race condition protection
    monaco.editor.setModelMarkers(model, 'protocol-validator', errors);
  }
};

// Worker (validator.worker.js)
import init, { validate } from './pkg/protocol_validator.js';

await init(); // Load WASM module once

self.onmessage = (event) => {
  const { code, version } = event.data;
  try {
    const validationErrors = validate(code); // WASM function
    self.postMessage({ errors: validationErrors, version });
  } catch (e) {
    self.postMessage({ errors: [{ message: e.toString() }], version });
  }
};
```

### Docusaurus Configuration

**docusaurus.config.js (Key settings):**
```javascript
module.exports = {
  future: {
    experimental_faster: true, // Use Rspack for faster builds
  },
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'default',
        path: 'docs',
        routeBasePath: 'docs',
        versions: {
          // Versioning enabled
        },
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'community',
        path: 'community',
        routeBasePath: 'community',
        // Unversioned community content
      },
    ],
    '@docusaurus/plugin-google-gtag',
  ],
  themeConfig: {
    algolia: {
      apiKey: 'YOUR_API_KEY',
      indexName: 'proto-manifests',
      appId: 'YOUR_APP_ID',
    },
  },
};
```

### Content Structure (Multi-Instance)

```
docs/                    # Instance 1: Product docs (versioned)
├── getting-started/
├── protocols/
├── guides/
├── examples/
└── playground/

community/               # Instance 2: Community (unversioned)
├── contributing.md
├── code-of-conduct.md
└── changelog.md
```

### Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Lighthouse Score | ≥90 | Lazy loading, code splitting |
| LCP | <2.5s | Route-based splitting |
| FID | <100ms | Web Worker for heavy ops |
| CLS | <0.1 | Proper sizing, no layout shift |
| Playground Bundle | <500KB gzipped | Dynamic imports |

### Deployment Workflow (Cloudflare Pages)

**.github/workflows/deploy-docs.yml:**
```yaml
name: Deploy Docs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: 'proto-manifests'
          directory: 'build'
```

### Accessibility Checklist (WCAG 2.1 AA)

- [ ] Keyboard navigation (Tab, Enter, Space)
- [ ] Monaco Editor: Ctrl+M to toggle Tab behavior
- [ ] High contrast mode support
- [ ] Screen reader announcements (via setModelMarkers)
- [ ] Semantic heading order (H1 → H2 → H3)
- [ ] Color contrast ≥4.5:1

---

## R4.3: GitHub Action Research - KEY FINDINGS

### Executive Decision: TypeScript Action (NOT Docker)

**Architecture:** TypeScript Action with decoupled CLI

**Why:**
- **Performance:** No Docker image pull (fastest startup)
- **Compatibility:** Works on Linux, macOS, Windows
- **Decoupled:** CLI version independent of action version
- **Maintainability:** CLI updates don't require action rebuild

**How CLI is Managed:**
```typescript
// Action downloads proto CLI at runtime
import * as tc from '@actions/tool-cache';

const version = core.getInput('proto-cli-version') || 'latest';
const cachedTool = tc.find('proto', version);

if (!cachedTool) {
  const downloadPath = await tc.downloadTool(url);
  const extractedPath = await tc.extractTar(downloadPath);
  const toolPath = await tc.cacheDir(extractedPath, 'proto', version);
  tc.addPath(toolPath);
}
```

### Action Input/Output Schema

**Critical Inputs:**
```yaml
inputs:
  manifest-glob:
    required: true
    default: '**/*.proto.json'
  
  fail-on-breaking:
    default: 'true'
  
  comment-on-pr:
    default: 'true'
  
  github-token:
    required: true
```

**Outputs:**
```yaml
outputs:
  validated-count:
    description: 'Number of manifests validated'
  
  failed-count:
    description: 'Number of manifests that failed'
  
  breaking-changes-count:
    description: 'Number of breaking changes detected'
  
  validation-report-json:
    description: 'Full validation report (JSON)'
```

### Critical Feature: API-Driven Breaking Change Detection

**Problem:** How to compare PR code vs base branch?

**Rejected Approaches:**
- Dual checkout (slow, complex)
- Full git history (extremely slow)

**Specified Solution:** GitHub API-driven diff

```typescript
// Algorithm:
// 1. Checkout HEAD (PR code) - fast, fetch-depth: 1
// 2. Get base SHA from event payload
const baseSha = github.context.payload.pull_request.base.sha;

// 3. For each manifest file:
//    - Read local file (HEAD content)
const contentHead = fs.readFileSync(filePath, 'utf8');

//    - Fetch base content via API
const { data } = await github.rest.repos.getContent({
  owner, repo,
  path: filePath,
  ref: baseSha
});
const contentBase = Buffer.from(data.content, 'base64').toString();

//    - Run proto diff
const diffResult = runProtoDiff(contentHead, contentBase);
```

**Benefits:**
- Fast (only fetches needed bytes)
- Reliable (no git gymnastics)
- Simple (treats repo as key-value store)

### Three-Tiered Reporting Model

**Tier 1: Inline Annotations (Highest Immediacy)**
```typescript
core.error('PII field missing governance policy', {
  file: 'data/users.proto.json',
  startLine: 45,
  endLine: 47,
  title: 'PII Governance Violation'
});
```
→ Creates red "X" on exact line in PR's "Files changed" tab

**Tier 2: Job Summary (Maximum Detail)**
```typescript
core.summary
  .addHeading('🔍 Proto Manifest Validation')
  .addTable([
    ['Metric', 'Count'],
    ['Validated', '12'],
    ['Failed', '2'],
    ['Breaking Changes', '1']
  ])
  .addCodeBlock(breakingChangesDiff, 'diff')
  .write();
```
→ Full report in Actions tab (supports 1MB markdown)

**Tier 3: PR Comment (Maximum Discoverability)**
```typescript
// "Sticky" comment pattern
const sentinel = '<!-- proto-validate-action -->';
const comments = await github.rest.issues.listComments({ issue_number });
const existingComment = comments.data.find(c => c.body.includes(sentinel));

const body = `${sentinel}\n## 🔍 Validation: ❌ Failed\n[View Details](${jobUrl})`;

if (existingComment) {
  await github.rest.issues.updateComment({ comment_id: existingComment.id, body });
} else {
  await github.rest.issues.createComment({ issue_number, body });
}
```
→ Brief summary + link to Job Summary (avoids spam)

### Security Model: Safe pull_request_target

**Problem:** Need write access to comment on fork PRs

**Solution:** `pull_request_target` with "trusted tool, untrusted data" pattern

```yaml
on:
  pull_request_target:  # Runs in context of base repo

permissions:
  contents: read           # Fetch repo content
  checks: write            # Post inline annotations
  pull-requests: write     # Post PR comments

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # Checkout PR code
      
      - uses: proto/validate-action@v1
        with:
          manifest-glob: '**/*.proto.json'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**CRITICAL:** 
- Workflow file is trusted (from base branch)
- Action code is trusted (pinned version)
- Manifest files are untrusted (PR code) but read as **data**, not executed
- NEVER run `npm install` or execute code from PR

### Input Sanitization

**Threat:** Shell injection via manifest-glob

```yaml
# Attacker sets: manifest-glob: '**/*; rm -rf /'
```

**Mitigation:** Use `@actions/glob` library (NOT shell commands)

```typescript
import * as glob from '@actions/glob';

// SAFE: Treats pattern as data, not executable command
const globber = await glob.create(pattern);
const files = await globber.glob();
```

### Performance: Dual-Cache Strategy

**Cache 1: Action Dependencies**
```yaml
# In user's workflow
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Cache 2: proto CLI Binary**
```typescript
// In action code
const cachedPath = tc.find('proto', version);
if (!cachedPath) {
  const downloadPath = await tc.downloadTool(url);
  const extractedPath = await tc.extractTar(downloadPath);
  await tc.cacheDir(extractedPath, 'proto', version);
}
```

### Marketplace Publishing

**Requirements:**
- Public repository
- action.yml with:
  - Unique name
  - Branding (icon: 'shield', color: 'purple')
  - Complete inputs/outputs
- Comprehensive README.md
- LICENSE file (MIT)

**Versioning Strategy:**
```bash
# Release v1.0.0
git tag v1.0.0
git push origin v1.0.0

# Also maintain floating v1 tag
git tag -f v1 v1.0.0
git push -f origin v1

# Users can use:
uses: proto/validate-action@v1        # Gets latest v1.x.x (recommended)
uses: proto/validate-action@v1.0.0    # Pinned (most secure)
```

---

## Cross-Mission Dependencies

```
R4.1 (Complete) ────────┐
                        ├─→ B4.2 (Monorepo Structure)
B4.1 (Tests) ───────────┘       │
                                ├─→ B4.3 (npm Publishing)
R4.2 (Complete) ────────┐       │       │
                        ├───────┼───────┴─→ B4.4 (Docs Site)
B4.3 (Publishing) ──────┘       │
                                │
R4.3 (Complete) ────────────────┼─→ B4.5 (GitHub Action)
                                │         │
B4.3 (Publishing) ──────────────┴─────────┴─→ B4.6 (Example Repo)

B4.7 (Community) - Independent, can run anytime
```

---

## Agent Quick Reference

### For B4.2 (Monorepo Structure):
- **Read:** R4.1 findings (above)
- **Key File:** `cmos/research/R4.1- npm Monorepo Tooling and Zero-Dependency Architecture.md`
- **Critical Decision:** pnpm + Turborepo + tsup + Changesets
- **Zero-Dep Pattern:** internal/utils as devDependency, inlined at build time

### For B4.4 (Documentation Site):
- **Read:** R4.2 findings (above)
- **Key File:** `cmos/research/R4.2_Documentation Site & Live Playground- Architecture & Technical Specificatio.md`
- **Critical Decision:** WASM-in-Worker, React.lazy() for perf, Cloudflare Pages
- **Monaco Hack:** JSON schema injection for IntelliSense

### For B4.5 (GitHub Action):
- **Read:** R4.3 findings (above)
- **Key File:** `cmos/research/R4.3-github-action-specification.md`
- **Critical Decision:** TypeScript Action, API-driven diff, three-tiered reporting
- **Security:** pull_request_target with "trusted tool, untrusted data"

---

**All research complete. Build phase ready to proceed.**

