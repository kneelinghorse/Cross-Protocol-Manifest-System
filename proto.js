#!/usr/bin/env node

/**
 * Cross-Protocol Manifest System - CLI Tool
 * Zero-dependency CLI for manifest operations
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';

// Import protocol implementations (prefer workspace package, fall back to local zero-dep file)
import { createDataProtocol as localCreateDataProtocol } from './data_protocol_v_1_1_1.js';
import { createAgentProtocol as localCreateAgentProtocol } from './agent_protocol_v_1_1_1.js';
import { createApiProtocol as localCreateApiProtocol } from './api_protocol_v_1_1_1.js';
import { createEventProtocol as localCreateEventProtocol } from './event_protocol_v_1_1_1.js';
import { createSemanticProtocol as localCreateSemanticProtocol } from './Semantic Protocol — v3.2.0.js';

let createDataProtocol = localCreateDataProtocol;
let createAgentProtocol = localCreateAgentProtocol;
let createApiProtocol = localCreateApiProtocol;
let createEventProtocol = localCreateEventProtocol;
let createSemanticProtocol = localCreateSemanticProtocol;

try {
  const dataProtocolModule = await import('@cpms/data');
  if (dataProtocolModule?.createDataProtocol) {
    createDataProtocol = dataProtocolModule.createDataProtocol;
  }
} catch (error) {
  if (process?.env?.PROTO_DEBUG === '1') {
    console.warn('[proto-cli] fallback to local data protocol implementation:', error.message);
  }
}

try {
  const agentProtocolModule = await import('@cpms/agent');
  if (agentProtocolModule?.createAgentProtocol) {
    createAgentProtocol = agentProtocolModule.createAgentProtocol;
  }
} catch (error) {
  if (process?.env?.PROTO_DEBUG === '1') {
    console.warn('[proto-cli] fallback to local agent protocol implementation:', error.message);
  }
}

try {
  const apiProtocolModule = await import('@cpms/api');
  if (apiProtocolModule?.createApiProtocol) {
    createApiProtocol = apiProtocolModule.createApiProtocol;
  }
} catch (error) {
  if (process?.env?.PROTO_DEBUG === '1') {
    console.warn('[proto-cli] fallback to local api protocol implementation:', error.message);
  }
}

try {
  const eventProtocolModule = await import('@cpms/event');
  if (eventProtocolModule?.createEventProtocol) {
    createEventProtocol = eventProtocolModule.createEventProtocol;
  }
} catch (error) {
  if (process?.env?.PROTO_DEBUG === '1') {
    console.warn('[proto-cli] fallback to local event protocol implementation:', error.message);
  }
}

try {
  const semanticProtocolModule = await import('@cpms/semantic');
  if (semanticProtocolModule?.createSemanticProtocol) {
    createSemanticProtocol = semanticProtocolModule.createSemanticProtocol;
  }
} catch (error) {
  if (process?.env?.PROTO_DEBUG === '1') {
    console.warn('[proto-cli] fallback to local semantic protocol implementation:', error.message);
  }
}

/**
 * CLI Argument Parser
 * @param {string[]} args - Process arguments (process.argv.slice(2))
 * @returns {Object} Parsed command and options
 */
function parseArgs(args) {
  const result = {
    command: null,
    subcommand: null,
    options: {},
    errors: []
  };

  if (args.length === 0) {
    result.errors.push('No command specified');
    return result;
  }

  result.command = args[0];
  let i = 1;

  // Handle commands with subcommands (generate, query, graph)
  if ((result.command === 'generate' || result.command === 'query' || result.command === 'graph') && args.length > 1) {
    result.subcommand = args[1];
    i = 2;
  }

  // Parse options
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        result.options[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result.options[key] = args[i + 1];
        i++;
      } else {
        result.options[key] = true;
      }
    } else {
      result.errors.push(`Unexpected argument: ${arg}`);
    }
    i++;
  }

  return result;
}

/**
 * Load manifest from file
 * @param {string} filePath - Path to manifest file
 * @returns {Object} Parsed manifest
 */
function loadManifest(filePath) {
  if (!filePath) {
    throw new Error('Manifest file path is required');
  }

  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest file not found: ${filePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in manifest file: ${error.message}`);
  }
}

/**
 * Normalize manifest shape before validation
 * @param {Object} manifest - Raw manifest object
 * @returns {Object} Prepared manifest
 */
function prepareManifestForValidation(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest));
  const type = (copy.type || '').toLowerCase();
  
  if (type === 'agent') {
    copy.agent = copy.agent || {};
    copy.agent.id = copy.agent.id || copy.id || copy.urn || copy.name || 'agent';
    copy.agent.name = copy.agent.name || copy.name || copy.agent.id;
    copy.agent.version = copy.agent.version || copy.version;
  }
  
  return copy;
}

/**
 * Format output based on format option
 * @param {*} data - Data to output
 * @param {string} format - Output format (json or text)
 * @returns {string} Formatted output
 */
function formatOutput(data, format = 'text') {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  
  // Default text formatting
  if (typeof data === 'string') {
    return data;
  }
  
  if (data && typeof data === 'object') {
    if (data.valid !== undefined) {
      // Validation result
      return formatValidationResult(data);
    }
    if (data.changes !== undefined) {
      // Diff result
      return formatDiffResult(data);
    }
    if (data.steps !== undefined) {
      // Migration result
      return formatMigrationResult(data);
    }
  }
  
  return JSON.stringify(data, null, 2);
}

/**
 * Format validation result for text output
 * @param {Object} result - Validation result from protocol
 * @returns {string} Formatted text
 */
function formatValidationResult(result) {
  const lines = [];
  
  // Handle both protocol format (ok/results) and expected format (valid/errors)
  const isValid = result.valid !== undefined ? result.valid : result.ok;
  const validatorResults = result.validatorResults || result.results;
  
  if (isValid) {
    lines.push('✓ Manifest is valid');
  } else {
    lines.push('✗ Manifest validation failed');
  }
  
  if (result.errors && result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    result.errors.forEach(error => {
      lines.push(`  - ${error}`);
    });
  }
  
  if (validatorResults) {
    lines.push('');
    lines.push('Validator Results:');
    validatorResults.forEach(validatorResult => {
      const name = validatorResult.name || 'unknown';
      const status = validatorResult.ok || validatorResult.valid ? '✓' : '✗';
      lines.push(`  ${status} ${name}`);
      
      if (validatorResult.issues && validatorResult.issues.length > 0) {
        validatorResult.issues.forEach(issue => {
          const level = issue.level || 'error';
          lines.push(`    - ${issue.path}: ${issue.msg} [${level}]`);
        });
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Format diff result for text output
 * @param {Object} result - Diff result
 * @returns {string} Formatted text
 */
function formatDiffResult(result) {
  const lines = [];
  
  if (result.changes && result.changes.length > 0) {
    lines.push(`Found ${result.changes.length} change(s):`);
    lines.push('');
    
    result.changes.forEach(change => {
      const path = change.path || 'unknown';
      const from = change.from !== undefined ? JSON.stringify(change.from) : '(undefined)';
      const to = change.to !== undefined ? JSON.stringify(change.to) : '(undefined)';
      lines.push(`  ${path}:`);
      lines.push(`    from: ${from}`);
      lines.push(`    to:   ${to}`);
    });
  } else {
    lines.push('No changes detected');
  }
  
  if (result.breaking && result.breaking.length > 0) {
    lines.push('');
    lines.push(`⚠️  ${result.breaking.length} breaking change(s):`);
    result.breaking.forEach(breaking => {
      lines.push(`  - ${breaking.path}: ${breaking.reason}`);
    });
  }
  
  if (result.significant && result.significant.length > 0) {
    lines.push('');
    lines.push(`ℹ️  ${result.significant.length} significant change(s):`);
    result.significant.forEach(sig => {
      lines.push(`  - ${sig.path}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Format migration result for text output
 * @param {Object} result - Migration result
 * @returns {string} Formatted text
 */
function formatMigrationResult(result) {
  const lines = [];
  
  if (result.steps && result.steps.length > 0) {
    lines.push('Migration Steps:');
    lines.push('');
    result.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  } else {
    lines.push('No migration steps required');
  }
  
  if (result.notes && result.notes.length > 0) {
    lines.push('');
    lines.push('Notes:');
    result.notes.forEach(note => {
      lines.push(`  - ${note}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Show help message
 */
function showHelp() {
  const help = `
Cross-Protocol Manifest System CLI

Usage:
  proto <command> [options]

Commands:
  validate              Validate a manifest file
  diff                  Compare two manifests
  generate migration    Generate migration script between manifests
  query                 Search manifests using query DSL
  graph                 Generate graph visualization of protocol relationships

Options:
  --manifest=<file>     Path to manifest file (JSON)
  --from=<file>         Source manifest file for diff/migration
  --to=<file>           Target manifest file for diff/migration
  --format=<format>     Output format: json, text, table (default: text)
  --help                Show this help message

Query Options:
  --manifest-dir=<path> Directory containing manifests (default: ./manifests)
  --type=<protocol>     Filter by protocol type (data, event, api, agent, semantic)
  --limit=N            Limit results (default: 10)

Graph Options:
  --format=mermaid|json|dot  Output format (default: mermaid)
  --depth=N           Traversal depth (default: 3)
  --show-dependencies Show inter-mission dependencies
  --show-urns         Show all URN references
  --output=<file>     Write to file instead of stdout

Examples:
  proto validate --manifest=dataset.json
  proto diff --from=v1.json --to=v2.json --format=json
  proto generate migration --from=v1.json --to=v2.json
  proto query 'governance.policy.classification:=:pii'
  proto query 'agent.capabilities.tools:contains:refund' --type=agent
  proto graph manifests/agent/support.json --format=mermaid
  proto graph manifests/data/users.json --show-dependencies --depth=2

Exit Codes:
  0 - Success
  1 - General error
  2 - Validation failed
  3 - File not found
  4 - Invalid manifest format
`;
  
  console.log(help);
}

/**
 * Validate command handler
 * @param {Object} parsed - Parsed arguments
 * @returns {number} Exit code
 */
async function handleValidate(parsed) {
  const { options } = parsed;
  
  if (!options.manifest) {
    console.error('Error: --manifest option is required');
    return 1;
  }
  
  try {
    const manifest = prepareManifestForValidation(loadManifest(options.manifest));
    let type = (manifest.type || '').toLowerCase();
    if (!type && manifest.schema) type = 'data';
    if (!type && manifest.element?.type) type = manifest.element.type.toLowerCase();
    
    const factories = {
      data: createDataProtocol,
      agent: createAgentProtocol,
      api: createApiProtocol,
      event: createEventProtocol,
      semantic: createSemanticProtocol
    };
    
    const factory = factories[type] || createDataProtocol;
    const protocol = factory(manifest);
    
    if (typeof protocol.validate !== 'function') {
      console.log('No validator available for this manifest type - assuming valid');
      return 0;
    }
    const protocolResult = await protocol.validate();
    
    // Convert protocol result format to CLI format
    const cliResult = {
      valid: protocolResult.ok,
      validatorResults: protocolResult.results,
      errors: []
    };
    
    // Extract errors from validator results
    if (protocolResult.results) {
      protocolResult.results.forEach(validatorResult => {
        if (!validatorResult.ok && validatorResult.issues) {
          validatorResult.issues.forEach(issue => {
            cliResult.errors.push(`${issue.path}: ${issue.msg}`);
          });
        }
      });
    }
    
    const output = formatOutput(cliResult, options.format || 'text');
    console.log(output);
    
    return cliResult.valid ? 0 : 2;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message.includes('not found') ? 3 : 4;
  }
}

/**
 * Diff command handler
 * @param {Object} parsed - Parsed arguments
 * @returns {number} Exit code
 */
async function handleDiff(parsed) {
  const { options } = parsed;
  
  if (!options.from || !options.to) {
    console.error('Error: Both --from and --to options are required');
    return 1;
  }
  
  try {
    const manifestA = loadManifest(options.from);
    const manifestB = loadManifest(options.to);
    
    const protocolA = createDataProtocol(manifestA);
    const result = protocolA.diff(manifestB);
    
    const output = formatOutput(result, options.format);
    console.log(output);
    
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message.includes('not found') ? 3 : 4;
  }
}

/**
 * Generate migration command handler
 * @param {Object} parsed - Parsed arguments
 * @returns {number} Exit code
 */
async function handleGenerateMigration(parsed) {
  const { options } = parsed;
  
  if (!options.from || !options.to) {
    console.error('Error: Both --from and --to options are required');
    return 1;
  }
  
  try {
    const manifestA = loadManifest(options.from);
    const manifestB = loadManifest(options.to);
    
    const protocolA = createDataProtocol(manifestA);
    const result = protocolA.generateMigration(manifestB);
    
    const output = formatOutput(result, options.format);
    console.log(output);
    
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message.includes('not found') ? 3 : 4;
  }
}

/**
 * Parse query expression into structured query object
 * @param {string} expression - Query expression like 'field:=:value'
 * @returns {Object} Parsed query with field, operator, value
 */
function parseQueryExpression(expression) {
  const operators = [':=:', ':contains:', '>:', '<:', '>=:', '<=:', ':=array:'];
  
  for (const op of operators) {
    const parts = expression.split(op);
    if (parts.length === 2) {
      return {
        field: parts[0].trim(),
        operator: op,
        value: parts[1].trim().replace(/^["']|["']$/g, '')
      };
    }
  }
  
  throw new Error(`Invalid query expression: ${expression}. Supported operators: ${operators.join(', ')}`);
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path (e.g., 'governance.policy.classification')
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Check if value matches query criteria
 * @param {*} actual - Actual value from manifest
 * @param {string} operator - Query operator
 * @param {*} expected - Expected value from query
 * @returns {boolean} True if matches
 */
function matchesQuery(actual, operator, expected) {
  if (actual === undefined) return false;
  
  // Handle array values
  if (Array.isArray(actual)) {
    if (operator === ':contains:') {
      return actual.some(item => item.toString().toLowerCase().includes(expected.toLowerCase()));
    }
    if (operator === ':=array:') {
      const expectedArray = expected.split(',').map(v => v.trim());
      return expectedArray.every(val => actual.includes(val));
    }
    return false;
  }
  
  // Handle string values
  if (typeof actual === 'string') {
    if (operator === ':contains:') {
      return actual.toLowerCase().includes(expected.toLowerCase());
    }
    if (operator === ':=:') {
      return actual.toLowerCase() === expected.toLowerCase();
    }
    return false;
  }
  
  // Handle numeric comparisons
  const actualNum = Number(actual);
  const expectedNum = Number(expected);
  
  if (!isNaN(actualNum) && !isNaN(expectedNum)) {
    switch (operator) {
      case '>:': return actualNum > expectedNum;
      case '<:': return actualNum < expectedNum;
      case '>=:': return actualNum >= expectedNum;
      case '<=:': return actualNum <= expectedNum;
      case ':=:': return actualNum === expectedNum;
    }
  }
  
  // Default equality check
  if (operator === ':=:') {
    return actual == expected;
  }
  
  return false;
}

/**
 * Load all manifests from directory
 * @param {string} dirPath - Directory path
 * @param {string} protocolType - Optional protocol type filter
 * @returns {Array} Array of manifest objects
 */
async function loadManifestsFromDir(dirPath, protocolType) {
  const fullPath = path.resolve(dirPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest directory not found: ${dirPath}`);
  }
  
  const manifests = [];
  const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(fullPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const manifest = JSON.parse(content);
      
      // Filter by protocol type if specified
      if (!protocolType || manifest.type === protocolType) {
        manifests.push(manifest);
      }
    } catch (error) {
      // Skip invalid files
      console.error(`Warning: Skipping invalid manifest ${file}: ${error.message}`);
    }
  }
  
  return manifests;
}

/**
 * Format query results for table output
 * @param {Array} results - Query results
 * @returns {string} Formatted table
 */
function formatQueryResults(results) {
  if (results.length === 0) {
    return 'No manifests found matching query';
  }
  
  const lines = [];
  lines.push(`Found ${results.length} manifest(s) matching query:`);
  lines.push('');
  
  results.forEach((result, index) => {
    lines.push(`${index + 1}. URN: ${result.urn || 'unknown'}`);
    lines.push(`   Type: ${result.type || 'unknown'}`);
    lines.push(`   Match: ${result.matchPath} ${result.operator} ${JSON.stringify(result.matchValue)}`);
    if (result.file) {
      lines.push(`   File: ${result.file}`);
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Query command handler
 * @param {Object} parsed - Parsed arguments
 * @returns {Promise<number>} Exit code
 */
async function handleQuery(parsed) {
  const { options } = parsed;
  
  if (!parsed.subcommand) {
    console.error('Error: Query expression is required');
    return 1;
  }
  
  try {
    const query = parseQueryExpression(parsed.subcommand);
    const manifestDir = options['manifest-dir'] || './manifests';
    const protocolType = options.type;
    const limit = parseInt(options.limit) || 10;
    
    // Load manifests
    const manifests = await loadManifestsFromDir(manifestDir, protocolType);
    
    // Filter manifests based on query
    const results = [];
    for (const manifest of manifests) {
      const value = getNestedValue(manifest, query.field);
      if (matchesQuery(value, query.operator, query.value)) {
        results.push({
          urn: manifest.urn,
          type: manifest.type,
          matchPath: query.field,
          operator: query.operator,
          matchValue: value,
          manifest: manifest
        });
        
        if (results.length >= limit) break;
      }
    }
    
    // Format output
    const format = options.format || 'table';
    let output;
    if (format === 'json') {
      output = JSON.stringify(results, null, 2);
    } else if (format === 'table') {
      output = formatQueryResults(results);
    } else {
      output = formatOutput(results, format);
    }
    
    console.log(output);
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return 1;
  }
}

/**
 * Extract URN references from manifest
 * @param {Object} manifest - Manifest object
 * @returns {Array} Array of URN strings
 */
function extractURNs(manifest) {
  const urns = new Set();
  
  // Search for URN patterns in the entire manifest
  const jsonStr = JSON.stringify(manifest);
  const urnRegex = /urn:proto:[^"'\s]+/g;
  const matches = jsonStr.match(urnRegex);
  
  if (matches) {
    matches.forEach(urn => urns.add(urn));
  }
  
  // Remove self-reference
  if (manifest.urn) {
    urns.delete(manifest.urn);
  }
  
  return Array.from(urns);
}

/**
 * Build graph structure from manifest
 * @param {Object} manifest - Starting manifest
 * @param {number} depth - Traversal depth
 * @param {Set} visited - Visited URNs to prevent cycles
 * @returns {Object} Graph node structure
 */
async function buildGraph(manifest, depth, visited = new Set()) {
  const urn = manifest.urn || 'unknown';
  
  if (visited.has(urn) || depth <= 0) {
    return null;
  }
  
  visited.add(urn);
  
  const node = {
    urn: urn,
    type: manifest.type || 'unknown',
    edges: []
  };
  
  // Extract URN references from manifest
  const referencedURNs = extractURNs(manifest);
  
  for (const targetURN of referencedURNs) {
    node.edges.push({
      target: targetURN,
      relationship: 'references'
    });
  }
  
  return node;
}

/**
 * Generate Mermaid graph syntax
 * @param {Object} graph - Graph structure
 * @returns {string} Mermaid syntax
 */
function generateMermaid(graph) {
  if (!graph) return '';
  
  const lines = ['graph TD'];
  const visited = new Set();
  
  function processNode(node, parentId = null) {
    if (!node || visited.has(node.urn)) return;
    
    visited.add(node.urn);
    const nodeId = node.urn.replace(/[^a-zA-Z0-9]/g, '_');
    const label = `${node.type}:${node.urn.split(':').pop()}`;
    
    lines.push(`  ${nodeId}[${label}]`);
    
    if (parentId) {
      lines.push(`  ${parentId} -->|references| ${nodeId}`);
    }
    
    if (node.edges) {
      for (const edge of node.edges) {
        const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${nodeId} -->|${edge.relationship}| ${targetId}[${edge.target}]`);
      }
    }
  }
  
  processNode(graph);
  return lines.join('\n');
}

/**
 * Generate DOT graph syntax
 * @param {Object} graph - Graph structure
 * @returns {string} DOT syntax
 */
function generateDot(graph) {
  if (!graph) return '';
  
  const lines = ['digraph G {', '  rankdir=TB;'];
  const visited = new Set();
  
  function processNode(node, parentId = null) {
    if (!node || visited.has(node.urn)) return;
    
    visited.add(node.urn);
    const nodeId = node.urn.replace(/[^a-zA-Z0-9]/g, '_');
    const label = `${node.type}:${node.urn.split(':').pop()}`;
    
    lines.push(`  ${nodeId} [label="${label}"];`);
    
    if (parentId) {
      lines.push(`  ${parentId} -> ${nodeId} [label="references"];`);
    }
    
    if (node.edges) {
      for (const edge of node.edges) {
        const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${nodeId} -> ${targetId} [label="${edge.relationship}"];`);
      }
    }
  }
  
  processNode(graph);
  lines.push('}');
  return lines.join('\n');
}

/**
 * Graph command handler
 * @param {Object} parsed - Parsed arguments
 * @returns {Promise<number>} Exit code
 */
async function handleGraph(parsed) {
  const { options } = parsed;
  
  if (!parsed.subcommand) {
    console.error('Error: Manifest file path is required');
    return 1;
  }
  
  try {
    const manifestPath = parsed.subcommand;
    const manifest = loadManifest(manifestPath);
    const depth = parseInt(options.depth) || 3;
    const format = options.format || 'mermaid';
    
    // Build graph structure
    const graph = await buildGraph(manifest, depth);
    
    if (!graph) {
      console.log('No graph data available');
      return 0;
    }
    
    // Generate output based on format
    let output;
    switch (format) {
      case 'mermaid':
        output = generateMermaid(graph);
        break;
      case 'dot':
        output = generateDot(graph);
        break;
      case 'json':
        output = JSON.stringify(graph, null, 2);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Handle output file option
    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf8');
      console.log(`Graph written to ${options.output}`);
    } else {
      console.log(output);
    }
    
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message.includes('not found') ? 3 : 4;
  }
}

/**
 * Main CLI handler
 * @param {string[]} args - Command line arguments
 * @returns {Promise<number>} Exit code
 */
async function main(args) {
  const startTime = Date.now();
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return 0;
  }
  
  const parsed = parseArgs(args);
  
  if (parsed.errors.length > 0) {
    parsed.errors.forEach(error => console.error(`Error: ${error}`));
    showHelp();
    return 1;
  }
  
  let exitCode;
  switch (parsed.command) {
    case 'validate':
      exitCode = await handleValidate(parsed);
      break;
    case 'diff':
      exitCode = await handleDiff(parsed);
      break;
    case 'generate':
      if (parsed.subcommand === 'migration') {
        exitCode = await handleGenerateMigration(parsed);
      } else {
        console.error(`Error: Unknown generate subcommand: ${parsed.subcommand}`);
        showHelp();
        exitCode = 1;
      }
      break;
    case 'query':
      exitCode = await handleQuery(parsed);
      break;
    case 'graph':
      exitCode = await handleGraph(parsed);
      break;
    default:
      console.error(`Error: Unknown command: ${parsed.command}`);
      showHelp();
      exitCode = 1;
  }
  
  // Log performance for debugging
  const duration = Date.now() - startTime;
  if (duration > 500) {
    console.error(`Warning: CLI execution took ${duration}ms (target: < 500ms)`);
  }
  
  return exitCode;
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2))
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

export { main, parseArgs, loadManifest, formatOutput };
