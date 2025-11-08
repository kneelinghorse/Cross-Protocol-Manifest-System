/**
 * URN Resolver Service - v1.0.0
 * Cross-protocol manifest discovery and validation with URN-based linking
 * 
 * URN Format: urn:proto:{type}:{id}@{version}#{fragment}
 * Examples:
 * - urn:proto:data:user_events@v1.1.1#schema.fields.email
 * - urn:proto:api:billing@v2.0.0#endpoints./v1/charge
 * - urn:proto:agent:support@v1.0.0#capabilities.refund
 */

import { dget } from './utils.js';
import { createCatalogSystem, parseURN as catalogParseURN, resolveURN as catalogResolveURN } from './catalog_system_v_1_1_1.js';
import { readFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';

// URN parsing regex for urn:proto:{type}:{id}@{version}#{fragment}
// Version can be: v1.1.1, 1.1.1, or latest
// Fragment can contain dots, slashes, and other characters
const URN_REGEX = /^urn:proto:(data|event|api|agent|semantic):([a-zA-Z0-9._-]+)(?:@(v?[\d.]+|latest))?(?:#([\w.\/\-]+))?$/;

/**
 * Parse URN string into components
 * @param {string} urnString - URN to parse
 * @returns {Object} Parsed URN components or null if invalid
 */
function parseURN(urnString) {
  if (!urnString || typeof urnString !== 'string') {
    return null;
  }

  const match = urnString.match(URN_REGEX);
  if (!match) {
    return null;
  }

  return {
    type: match[1],
    id: match[2],
    version: match[3] || 'latest',
    fragment: match[4] || null,
    original: urnString
  };
}

/**
 * Validate URN format
 * @param {string} urnString - URN to validate
 * @returns {Object} Validation result
 */
function validateURNFormat(urnString) {
  const parsed = parseURN(urnString);
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid URN format',
      details: 'URN must match: urn:proto:{type}:{id}[@version][#fragment]'
    };
  }

  return {
    valid: true,
    parsed: parsed
  };
}

/**
 * Check version compatibility using semantic versioning rules
 * @param {string} requestedVersion - Version from URN
 * @param {string} actualVersion - Version from manifest
 * @returns {Object} Compatibility result
 */
function checkVersionCompatibility(requestedVersion, actualVersion) {
  if (requestedVersion === 'latest') {
    return {
      compatible: true,
      reason: 'latest always compatible'
    };
  }

  const requested = parseSemanticVersion(requestedVersion);
  const actual = parseSemanticVersion(actualVersion);

  if (!requested || !actual) {
    return {
      compatible: false,
      reason: 'Invalid version format'
    };
  }

  // Major version must match exactly
  if (requested.major !== actual.major) {
    return {
      compatible: false,
      reason: `Major version mismatch: ${requested.major} vs ${actual.major}`
    };
  }

  // Requested minor version must be <= actual minor version
  if (requested.minor > actual.minor) {
    return {
      compatible: false,
      reason: `Requested minor version ${requested.minor} > actual ${actual.minor}`
    };
  }

  // If minor versions match, patch must be <= actual patch
  if (requested.minor === actual.minor && requested.patch > actual.patch) {
    return {
      compatible: false,
      reason: `Requested patch version ${requested.patch} > actual ${actual.patch}`
    };
  }

  return {
    compatible: true,
    reason: 'Version compatible'
  };
}

/**
 * Parse semantic version string into components
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {Object} Version components or null if invalid
 */
function parseSemanticVersion(version) {
  // Remove 'v' prefix if present
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Load manifest from file system
 * @param {string} type - Protocol type
 * @param {string} id - Manifest ID
 * @param {string} version - Version
 * @param {Object} options - Resolution options
 * @returns {Object} Loaded manifest or null
 */
function loadManifestFromFile(type, id, version, options = {}) {
  const { manifestDir = './manifests' } = options;
  
  // Construct file path: manifests/{type}/{id}@{version}.json
  const filename = `${id}@${version}.json`;
  const filepath = `${manifestDir}/${type}/${filename}`;

  if (!existsSync(filepath)) {
    // Try without version for latest
    if (version === 'latest') {
      const latestPath = `${manifestDir}/${type}/${id}.json`;
      if (existsSync(latestPath)) {
        try {
          const content = readFileSync(latestPath, 'utf8');
          return JSON.parse(content);
        } catch (error) {
          return null;
        }
      }
    }
    
    // Try with 'v' prefix for version
    const vFilename = `${id}@v${version}.json`;
    const vFilepath = `${manifestDir}/${type}/${vFilename}`;
    if (existsSync(vFilepath)) {
      try {
        const content = readFileSync(vFilepath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        return null;
      }
    }
    
    return null;
  }

  try {
    const content = readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Resolve URN to manifest with optional fragment resolution
 * @param {string} urnString - URN to resolve
 * @param {Object} options - Resolution options
 * @returns {Promise<Object>} Resolution result
 */
async function resolveURN(urnString, options = {}) {
  const { mode = 'static', manifestDir = './manifests', catalog = null } = options;

  // Parse URN
  const parsed = parseURN(urnString);
  if (!parsed) {
    return {
      success: false,
      error: 'Invalid URN format',
      urn: urnString
    };
  }

  let manifest;
  
  // Resolve using catalog if provided
  if (catalog && mode === 'catalog') {
    const catalogItem = catalogResolveURN({ items: catalog.items || [] }, urnString);
    if (catalogItem) {
      manifest = catalogItem.manifest ? catalogItem.manifest() : catalogItem;
    }
  } else {
    // Static file resolution
    manifest = loadManifestFromFile(parsed.type, parsed.id, parsed.version, { manifestDir });
  }

  if (!manifest) {
    return {
      success: false,
      error: 'Manifest not found',
      urn: urnString,
      parsed: parsed
    };
  }

  // Check version compatibility
  const manifestVersion = manifest.version || '1.0.0';
  const compatibility = checkVersionCompatibility(parsed.version, manifestVersion);

  if (!compatibility.compatible) {
    return {
      success: false,
      error: 'Version incompatible',
      details: compatibility.reason,
      urn: urnString,
      parsed: parsed,
      manifestVersion: manifestVersion
    };
  }

  // Apply fragment resolution if specified
  let resolvedData = manifest;
  if (parsed.fragment) {
    resolvedData = dget(manifest, parsed.fragment);
    if (resolvedData === undefined) {
      return {
        success: false,
        error: 'Fragment not found',
        details: `Fragment '${parsed.fragment}' not found in manifest`,
        urn: urnString,
        parsed: parsed
      };
    }
  }

  return {
    success: true,
    urn: urnString,
    parsed: parsed,
    manifest: manifest,
    resolvedData: resolvedData,
    manifestVersion: manifestVersion,
    compatibility: compatibility
  };
}

/**
 * Validate URN existence and compatibility
 * @param {string} urnString - URN to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
async function validateURN(urnString, options = {}) {
  try {
    const result = await resolveURN(urnString, options);
    
    if (result.success) {
      return {
        valid: true,
        exists: true,
        compatible: result.compatibility.compatible,
        urn: urnString,
        parsed: result.parsed,
        manifestVersion: result.manifestVersion,
        compatibility: result.compatibility
      };
    } else {
      return {
        valid: false,
        exists: result.error !== 'Manifest not found',
        compatible: false,
        urn: urnString,
        error: result.error,
        details: result.details
      };
    }
  } catch (error) {
    return {
      valid: false,
      exists: false,
      compatible: false,
      urn: urnString,
      error: error.message
    };
  }
}

/**
 * Batch resolve multiple URNs
 * @param {string[]} urnStrings - Array of URNs to resolve
 * @param {Object} options - Resolution options
 * @returns {Promise<Array>} Array of resolution results
 */
async function batchResolveURN(urnStrings, options = {}) {
  const results = [];
  
  for (const urnString of urnStrings) {
    const result = await resolveURN(urnString, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Create URN resolver instance with configuration
 * @param {Object} config - Resolver configuration
 * @returns {Object} Resolver instance
 */
function createURNResolver(config = {}) {
  const {
    manifestDir = './manifests',
    mode = 'static',
    baseUrl = null,
    catalog = null,
    enableCache = true
  } = config;

  const cache = new Map();

  function getCacheKey(urnString, options = {}) {
    return `${urnString}:${JSON.stringify(options)}`;
  }

  async function resolveWithCache(urnString, options = {}) {
    if (!enableCache) {
      return resolveURN(urnString, { ...config, ...options });
    }

    const cacheKey = getCacheKey(urnString, options);
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      // Simple TTL of 5 minutes
      if (Date.now() - cached.timestamp < 300000) {
        return cached.result;
      } else {
        cache.delete(cacheKey);
      }
    }

    const result = await resolveURN(urnString, { ...config, ...options });
    
    if (result.success) {
      cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  function clearCache() {
    cache.clear();
  }

  function getCacheStats() {
    return {
      size: cache.size,
      entries: Array.from(cache.keys())
    };
  }

  return {
    resolve: resolveWithCache,
    validate: validateURN,
    batchResolve: batchResolveURN,
    parse: parseURN,
    clearCache,
    getCacheStats,
    config: {
      manifestDir,
      mode,
      baseUrl,
      enableCache,
      catalog
    }
  };
}

/**
 * Create HTTP server for remote URN resolution
 * @param {Object} config - Server configuration
 * @returns {Object} Server instance
 */
function createURNHTTPServer(config = {}) {
  const {
    port = 3000,
    manifestDir = './manifests',
    catalog = null,
    enableCors = true
  } = config;

  const resolver = createURNResolver({
    manifestDir,
    mode: 'static',
    catalog
  });

  const server = createServer(async (req, res) => {
    // Enable CORS if requested
    if (enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only handle GET requests
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    // Cache stats endpoint
    if (pathname === '/cache/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resolver.getCacheStats()));
      return;
    }

    // Clear cache endpoint
    if (pathname === '/cache/clear') {
      resolver.clearCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Cache cleared' }));
      return;
    }

    // Main resolution endpoint
    if (pathname === '/resolve') {
      const urn = url.searchParams.get('urn');
      const format = url.searchParams.get('format') || 'json';

      if (!urn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'URN parameter required' }));
        return;
      }

      try {
        const result = await resolver.resolve(urn);

        if (format === 'yaml') {
          // For YAML format, we'd need a YAML library, but keeping zero dependencies
          // So we'll return JSON with a note
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...result,
            note: 'YAML format not supported in zero-dependency mode'
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Batch resolution endpoint
    if (pathname === '/resolve/batch') {
      const urnsParam = url.searchParams.get('urns');
      
      if (!urnsParam) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'urns parameter required' }));
        return;
      }

      try {
        const urns = urnsParam.split(',').map(urn => urn.trim());
        const results = await resolver.batchResolve(urns);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return {
    server,
    resolver,
    start: () => new Promise((resolve) => {
      server.listen(port, () => {
        resolve({ port, url: `http://localhost:${port}` });
      });
    }),
    stop: () => new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    })
  };
}

// Export all functions
export {
  parseURN,
  validateURNFormat,
  checkVersionCompatibility,
  parseSemanticVersion,
  loadManifestFromFile,
  resolveURN,
  validateURN,
  batchResolveURN,
  createURNResolver,
  createURNHTTPServer
};