#!/usr/bin/env node

/**
 * Cross-Protocol Manifest System - CLI Tool
 * Zero-dependency CLI for manifest operations
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Import protocol implementations
const { createDataProtocol } = require('./data_protocol_v_1_1_1.js');

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

  // Handle generate command with subcommand
  if (result.command === 'generate' && args.length > 1) {
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

Options:
  --manifest=<file>     Path to manifest file (JSON)
  --from=<file>         Source manifest file for diff/migration
  --to=<file>           Target manifest file for diff/migration
  --format=<format>     Output format: json, text (default: text)
  --help                Show this help message

Examples:
  proto validate --manifest=dataset.json
  proto diff --from=v1.json --to=v2.json --format=json
  proto generate migration --from=v1.json --to=v2.json
  proto validate --manifest=dataset.json --format=text

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
    const manifest = loadManifest(options.manifest);
    const protocol = createDataProtocol(manifest);
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
if (require.main === module) {
  main(process.argv.slice(2))
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { main, parseArgs, loadManifest, formatOutput };