# CLI Usage Guide

This guide covers the command-line interface for the Cross-Protocol Manifest System.

## Installation

The CLI is built into the `proto.js` file and requires no additional installation:

```bash
# Make sure you have Node.js installed
node --version

# The CLI is ready to use
node proto.js --help
```

## Commands

### `validate` - Validate Manifests

Validate one or more manifest files against their protocol schemas.

```bash
# Validate a single manifest
node proto.js validate data-manifest.json

# Validate multiple manifests
node proto.js validate manifest1.json manifest2.json

# Validate with specific validators
node proto.js validate data-manifest.json --validators core.shape,governance.pii_policy

# Validate all manifests in a directory
node proto.js validate ./manifests/*.json
```

**Examples:**

```bash
# Validate a data protocol manifest
node proto.js validate manifests/user-events.json

# Validate with governance checks
node proto.js validate manifests/payments-api.json --validators governance.pii_policy

# Validate multiple protocol types
node proto.js validate manifests/*.json
```

### `diff` - Compare Manifests

Generate a diff between two manifest versions with migration suggestions.

```bash
# Diff two manifests
node proto.js diff --from v1.json --to v2.json

# Diff with detailed output
node proto.js diff --from v1.json --to v2.json --verbose

# Diff and generate migration script
node proto.js diff --from v1.json --to v2.json --generate-migration
```

**Examples:**

```bash
# Compare data protocol versions
node proto.js diff --from data-v1.json --to data-v2.json

# Compare API protocol versions
node proto.js diff --from api-v1.json --to api-v2.json

# Generate migration steps
node proto.js diff --from manifest-v1.json --to manifest-v2.json --generate-migration
```

**Output:**
```json
{
  "changes": [
    {
      "path": "schema.fields.email.required",
      "from": false,
      "to": true
    }
  ],
  "breaking": [
    {
      "path": "schema.fields.email.required",
      "reason": "required flag changed"
    }
  ],
  "significant": [],
  "migration": {
    "steps": [
      "-- BACKFILL: make 'email' NOT NULL (add default or backfill)"
    ],
    "notes": [
      "BREAKING: required flag changed @ schema.fields.email.required"
    ]
  }
}
```

### `generate` - Generate Artifacts

Generate SDKs, documentation, schemas, and validation code from manifests.

```bash
# Generate all artifacts
node proto.js generate all --manifest manifest.json --output ./generated

# Generate specific artifacts
node proto.js generate schema --manifest data-manifest.json
node proto.js generate docs --manifest data-manifest.json
node proto.js generate validation --manifest data-manifest.json

# Generate client SDK
node proto.js generate sdk --manifest api-manifest.json --language javascript
```

**Examples:**

```bash
# Generate documentation
node proto.js generate docs --manifest manifests/user-events.json

# Generate JSON Schema
node proto.js generate schema --manifest manifests/payments-api.json

# Generate validation function
node proto.js generate validation --manifest manifests/data-manifest.json

# Generate all artifacts to output directory
node proto.js generate all --manifest manifests/*.json --output ./generated
```

### `query` - Search Manifests

Search and query manifests using the catalog system.

```bash
# Query by name
node proto.js query --manifests ./manifests/*.json --expr "dataset.name:contains:user"

# Query by classification
node proto.js query --manifests ./manifests/*.json --expr "governance.policy.classification:=:pii"

# Query by field presence
node proto.js query --manifests ./manifests/*.json --expr "schema.fields.email.pii:=:true"

# Query with multiple conditions
node proto.js query --manifests ./manifests/*.json --expr "dataset.type:=:fact-table" --expr "governance.policy.classification:=:pii"
```

**Examples:**

```bash
# Find all PII datasets
node proto.js query --manifests manifests/*.json --expr "governance.policy.classification:=:pii"

# Find active APIs
node proto.js query --manifests manifests/*.json --expr "api.lifecycle.status:=:active"

# Find datasets with specific fields
node proto.js query --manifests manifests/*.json --expr "schema.fields.email:exists"

# Complex query: Find active PII datasets
node proto.js query --manifests manifests/*.json \
  --expr "dataset.lifecycle.status:=:active" \
  --expr "governance.policy.classification:=:pii"
```

**Query Operators:**
- `:=:` - Exact match
- `contains` - Substring match
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal

### `graph` - Generate Relationship Graph

Generate a graph of relationships between manifests.

```bash
# Generate graph for all manifests
node proto.js graph --manifests ./manifests/*.json

# Generate graph in specific format
node proto.js graph --manifests ./manifests/*.json --format json
node proto.js graph --manifests ./manifests/*.json --format dot
node proto.js graph --manifests ./manifests/*.json --format mermaid

# Save graph to file
node proto.js graph --manifests ./manifests/*.json --output graph.json
```

**Examples:**

```bash
# Generate JSON graph
node proto.js graph --manifests manifests/*.json --format json

# Generate DOT format for Graphviz
node proto.js graph --manifests manifests/*.json --format dot

# Generate Mermaid diagram
node proto.js graph --manifests manifests/*.json --format mermaid

# Save to file
node proto.js graph --manifests manifests/*.json --output system-graph.json
```

**Output (JSON format):**
```json
{
  "nodes": [
    {
      "urn": "urn:data:dataset:user_events:v1.1.1",
      "type": "data",
      "name": "user_events"
    },
    {
      "urn": "urn:api:api:payments-api:v1.1.0",
      "type": "api",
      "name": "payments-api"
    }
  ],
  "edges": [
    {
      "from": "urn:data:dataset:user_events:v1.1.1",
      "to": "urn:api:api:payments-api:v1.1.0",
      "type": "serves"
    }
  ]
}
```

## Global Options

### `--verbose` - Enable verbose output

```bash
node proto.js validate manifest.json --verbose
node proto.js diff --from v1.json --to v2.json --verbose
```

### `--output` - Specify output file

```bash
node proto.js generate docs --manifest manifest.json --output docs.md
node proto.js graph --manifests manifests/*.json --output graph.json
```

### `--format` - Specify output format

```bash
node proto.js graph --manifests manifests/*.json --format mermaid
node proto.js generate sdk --manifest api.json --format typescript
```

## Examples

### Complete Workflow Example

```bash
# 1. Validate all manifests
node proto.js validate manifests/*.json

# 2. Query for PII datasets
node proto.js query --manifests manifests/*.json --expr "governance.policy.classification:=:pii"

# 3. Generate relationship graph
node proto.js graph --manifests manifests/*.json --output system-graph.json

# 4. Compare versions
node proto.js diff --from manifests/v1.json --to manifests/v2.json --generate-migration

# 5. Generate documentation
node proto.js generate docs --manifests manifests/*.json --output ./docs
```

### CI/CD Integration

```bash
#!/bin/bash
# validate-manifests.sh

echo "Validating manifests..."
node proto.js validate manifests/*.json
if [ $? -ne 0 ]; then
  echo "Validation failed!"
  exit 1
fi

echo "Checking for breaking changes..."
node proto.js diff --from manifests/main/*.json --to manifests/pr/*.json --verbose
if [ $? -ne 0 ]; then
  echo "Breaking changes detected!"
  exit 1
fi

echo "All checks passed!"
```

## Troubleshooting

### Common Issues

**Issue:** `Error: Cannot find module './manifests/...'`
**Solution:** Check that manifest files exist and paths are correct.

**Issue:** `Error: Invalid manifest format`
**Solution:** Validate your manifest against the protocol schema.

**Issue:** `Error: Query expression parse error`
**Solution:** Check query syntax: `path:operator:value`

### Debug Mode

Enable debug logging:

```bash
DEBUG=proto node proto.js validate manifest.json
```

## Performance

- **CLI Startup:** ≤500ms
- **Manifest Validation:** ≤5ms per manifest
- **Query Execution:** ≤50ms for 100 manifests
- **Graph Generation:** ≤100ms for 100 manifests

## Further Reading

- [URN Resolver Setup Guide](urn-resolver-setup.md)
- [Protocol Specifications](../README.md)
- [CMOS Operations Guide](../cmos/docs/operations-guide.md)