/*
 * API Protocol — v1.1.1 (stand‑alone)
 * Minimal, self‑describing API manifest + helpers
 *
 * Goals
 * - Mirror Data/Event protocol ergonomics (manifest + validate + query + diff + generate)
 * - OpenAPI compatibility and SDK generation
 * - Zero dependencies; no external wiring
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————

/** Canonicalize JSON for stable hashing */
function jsonCanon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => jsonCanon(v)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jsonCanon(value[k])).join(',') + '}';
}

/** Deep get via dot‑path (supports [index]) */
function dget(obj, path) {
  if (!path) return obj;
  const p = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const k of p) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/** Deep set via dot‑path */
function dset(obj, path, val) {
  const parts = String(path).split('.');
  let cur = obj;
  while (parts.length > 1) {
    const k = parts.shift();
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[0]] = val;
}

/** Tiny clone */
const clone = x => {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch (e) {
    // Handle circular references by creating a shallow copy
    if (e.message.includes('circular')) {
      return { ...x };
    }
    throw e;
  }
};

/** Stable 64‑bit FNV‑1a hash (hex) of any JSON‑serializable value */
function hash(value) {
  // Fast path for primitives - use simple string conversion
  if (value === null || typeof value !== 'object') {
    const str = String(value);
    // Use a faster hashing approach for short strings
    let h = 2166136261;
    const p = 16777619;
    const len = str.length;
    // Process in chunks of 8 characters for better performance
    let i = 0;
    for (; i + 8 <= len; i += 8) {
      h ^= str.charCodeAt(i);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 1);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 2);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 3);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 4);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 5);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 6);
      h = (h * p) >>> 0;
      h ^= str.charCodeAt(i + 7);
      h = (h * p) >>> 0;
    }
    // Process remaining characters
    for (; i < len; i++) {
      h ^= str.charCodeAt(i);
      h = (h * p) >>> 0;
    }
    return 'fnv1a64-' + h.toString(16).padStart(16, '0');
  }
  
  // For arrays, use a simple approach
  if (Array.isArray(value)) {
    let h = 2166136261;
    const p = 16777619;
    h ^= 91; // '['
    h = (h * p) >>> 0;
    for (let i = 0; i < value.length; i++) {
      const itemHash = hash(value[i]);
      // Only use first 8 chars of hash for performance
      for (let j = 0; j < Math.min(8, itemHash.length); j++) {
        h ^= itemHash.charCodeAt(j);
        h = (h * p) >>> 0;
      }
      if (i < value.length - 1) {
        h ^= 44; // ','
        h = (h * p) >>> 0;
      }
    }
    h ^= 93; // ']'
    h = (h * p) >>> 0;
    return 'fnv1a64-' + h.toString(16).padStart(16, '0');
  }
  
  // For objects, use the original jsonCanon approach for correctness
  const str = jsonCanon(value);
  let h = 2166136261;
  const p = 16777619;
  
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * p) >>> 0;
  }
  
  return 'fnv1a64-' + h.toString(16).padStart(16, '0');
}

/**
 * @typedef {Object} SignatureEnvelope
 * @property {'identity-access.signing.v1'} spec
 * @property {string} protected
 * @property {string} payload
 * @property {{alg:'sha-256', value:string}} hash
 * @property {string} signature
 * @property {{alg:'EdDSA'|'ES256', kid:string, typ:string, canonical:string, digest:string, iat:string, exp?:string, [key:string]:any}} [header]
 */

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} ApiManifest
 * @property {string} [version]             Protocol version (e.g., "v1.1", "v2.0")
 * @property {Object} api
 * @property {string} api.name              // e.g., 'payments-api'
 * @property {string} [api.version]         // e.g., '1.1.0'
 * @property {{status:'active'|'deprecated', sunset_at?:string}} [api.lifecycle]
 * @property {Object} [info]                // OpenAPI-style metadata
 * @property {string} [info.title]
 * @property {string} [info.description]
 * @property {string} [info.termsOfService]
 * @property {Object} [info.contact]
 * @property {string} [info.contact.name]
 * @property {string} [info.contact.email]
 * @property {string} [info.contact.url]
 * @property {Object} [info.license]
 * @property {string} [info.license.name]
 * @property {string} [info.license.url]
 * @property {Object} [servers]             // Server configurations
 * @property {Array<{url:string, description?:string, variables?:Object}>} [servers.list]
 * @property {Object} [security]            // Security schemes
 * @property {Object<string,Object>} [security.schemes] // e.g., { bearerAuth: { type: 'http', scheme: 'bearer' } }
 * @property {Array<string>} [security.global] // Global security requirements
 * @property {Object} [endpoints]           // API endpoints
 * @property {Object<string,Endpoint>} [endpoints.paths] // path -> endpoint definition
 * @property {Object} [governance]
 * @property {{classification?: 'internal'|'confidential'|'pii', legal_basis?: 'gdpr'|'ccpa'|'hipaa'|'other'}} [governance.policy]
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 * @property {SignatureEnvelope} [sig]
 */

/**
 * @typedef {Object} Endpoint
 * @property {string} summary
 * @property {string} [description]
 * @property {Array<string>} [tags]
 * @property {Object} [parameters]          // path/query/header parameters
 * @property {Object<string,Parameter>} [parameters.path]
 * @property {Object<string,Parameter>} [parameters.query]
 * @property {Object<string,Parameter>} [parameters.header]
 * @property {Object} requestBody           // Request body schema
 * @property {string} requestBody.description
 * @property {boolean} requestBody.required
 * @property {Object} requestBody.content   // content-type -> schema
 * @property {Object} responses             // status code -> response
 * @property {Object<string,Response>} responses
 * @property {Array<string>} [security]     // Endpoint-specific security
 * @property {Object} [rateLimit]           // Rate limiting
 * @property {number} [rateLimit.requests]
 * @property {string} [rateLimit.period]    // e.g., '1m', '1h', '1d'
 */

/**
 * @typedef {Object} Parameter
 * @property {string} description
 * @property {string} type                  // string, number, integer, boolean, array
 * @property {boolean} [required]
 * @property {any} [default]
 * @property {Object} [schema]              // JSON Schema for validation
 */

/**
 * @typedef {Object} Response
 * @property {string} description
 * @property {Object} content               // content-type -> schema
 * @property {Object} headers               // response headers
 */

// ————————————————————————————————————————————————————————————————
// Validator registry
// ————————————————————————————————————————————————————————————————

const Validators = new Map();
function registerValidator(name, fn) { Validators.set(name, fn); }
function runValidators(manifest, selected = []) {
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = [];
  for (const n of names) results.push({ name: n, ...(Validators.get(n)?.(manifest) || { ok: true }) });
  return { ok: results.every(r => r.ok), results };
}

// Built-ins
registerValidator('core.shape', (m) => {
  const issues = [];
  if (!m?.api?.name) issues.push({ path: 'api.name', msg: 'api.name is required', level: 'error' });
  if (!m?.endpoints?.paths || typeof m.endpoints.paths !== 'object' || !Object.keys(m.endpoints.paths).length) {
    issues.push({ path: 'endpoints.paths', msg: 'at least one endpoint path required', level: 'error' });
  }
  const lc = m?.api?.lifecycle; if (lc && !['active','deprecated'].includes(lc.status)) {
    issues.push({ path: 'api.lifecycle.status', msg: 'status must be active|deprecated', level: 'error' });
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('endpoints.valid', (m) => {
  const issues = [];
  const paths = m?.endpoints?.paths || {};
  for (const [path, endpoint] of Object.entries(paths)) {
    if (!endpoint.summary) issues.push({ path: `endpoints.paths.${path}.summary`, msg: 'summary required', level: 'error' });
    if (!endpoint.responses || !Object.keys(endpoint.responses).length) {
      issues.push({ path: `endpoints.paths.${path}.responses`, msg: 'at least one response required', level: 'error' });
    }
    // Validate parameter schemas if present
    const params = endpoint.parameters || {};
    for (const [loc, paramMap] of Object.entries(params)) {
      if (!['path','query','header'].includes(loc)) {
        issues.push({ path: `endpoints.paths.${path}.parameters.${loc}`, msg: 'invalid parameter location', level: 'error' });
      }
    }
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('security.schemes', (m) => {
  const issues = [];
  const schemes = m?.security?.schemes || {};
  for (const [name, scheme] of Object.entries(schemes)) {
    if (!scheme.type) issues.push({ path: `security.schemes.${name}.type`, msg: 'security scheme type required', level: 'error' });
    if (scheme.type === 'http' && !scheme.scheme) {
      issues.push({ path: `security.schemes.${name}.scheme`, msg: 'http scheme required (bearer, basic)', level: 'error' });
    }
    // Validate allowed security scheme types
    const validTypes = ['http', 'apiKey', 'oauth2', 'openIdConnect'];
    if (scheme.type && !validTypes.includes(scheme.type)) {
      issues.push({ path: `security.schemes.${name}.type`, msg: `invalid security scheme type: ${scheme.type}`, level: 'error' });
    }
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('governance.pii_policy', (m) => {
  const issues = [];
  // Check request bodies for PII fields
  const paths = m?.endpoints?.paths || {};
  for (const [path, endpoint] of Object.entries(paths)) {
    const body = endpoint.requestBody?.content || {};
    for (const [contentType, schema] of Object.entries(body)) {
      const props = schema.properties || {};
      const hasPII = Object.values(props).some(p => p['x-pii'] === true);
      if (hasPII && m?.governance?.policy?.classification !== 'pii') {
        issues.push({ path: `governance.policy.classification`, msg: 'PII fields in request bodies → classification should be "pii"', level: 'warn' });
      }
    }
  }
  return { ok: issues.length === 0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————

function query(manifest, expr) {
  // Parse expression with proper operator handling
  const exprStr = String(expr);
  
  // Check for :=: operator first (most specific)
  const eqMatch = exprStr.match(/^(.+?):=:([^:]+)$/);
  if (eqMatch) {
    const [, rawPath, rhs] = eqMatch;
    const lhs = dget(manifest, rawPath);
    return lhs !== undefined && String(lhs) === rhs;
  }
  
  // Check for contains operator
  const containsMatch = exprStr.match(/^(.+?):contains:(.+)$/);
  if (containsMatch) {
    const [, rawPath, rhs] = containsMatch;
    // Convenience: endpoints contains <path>
    if (rawPath === 'endpoints') {
      return Object.keys(manifest?.endpoints?.paths || {}).some(p => p.includes(rhs));
    }
    // Convenience: security contains <scheme>
    if (rawPath === 'security') {
      return Object.keys(manifest?.security?.schemes || {}).some(s => s.includes(rhs));
    }
    const lhs = dget(manifest, rawPath);
    return lhs !== undefined && String(lhs ?? '').includes(rhs);
  }
  
  // Check for comparison operators
  const compMatch = exprStr.match(/^(.+?)([><]=?|<>)(.+)$/);
  if (compMatch) {
    const [, rawPath, op, rhs] = compMatch;
    const lhs = dget(manifest, rawPath);
    if (lhs === undefined) return false;
    
    const numLhs = Number(lhs);
    const numRhs = Number(rhs);
    
    switch (op) {
      case '>': return numLhs > numRhs;
      case '<': return numLhs < numRhs;
      case '>=': return numLhs >= numRhs;
      case '<=': return numLhs <= numRhs;
      case '<>': return numLhs !== numRhs;
      default: return false;
    }
  }
  
  return false;
}

// ————————————————————————————————————————————————————————————————
// Normalize (auto-hash endpoints and schemas)
// ————————————————————————————————————————————————————————————————

function normalize(manifest) {
  const m = clone(manifest || {});
  // Ensure required structure exists
  if (!m.endpoints) m.endpoints = {};
  if (!m.endpoints.paths) m.endpoints.paths = {};
  
  // Compute hashes for endpoints and schemas
  const endpoints = m.endpoints.paths;
  m.endpoint_hashes = {};
  for (const [path, endpoint] of Object.entries(endpoints)) {
    m.endpoint_hashes[path] = hash(endpoint);
  }
  m.schema_hash = hash(m.endpoints);
  return m;
}

// ————————————————————————————————————————————————————————————————
// Diff (structural + semantic hints)
// ————————————————————————————————————————————————————————————————

function diff(a, b) {
  const A = normalize(a); const B = normalize(b);
  const changes = [];

  function walk(pa, va, vb) {
    if (JSON.stringify(va) === JSON.stringify(vb)) return;
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(va) || !isObj(vb)) {
      changes.push({ path: pa, from: va, to: vb });
      return;
    }
    const keys = new Set([...Object.keys(va||{}), ...Object.keys(vb||{})]);
    for (const k of keys) {
      const hasInA = k in (va || {});
      const hasInB = k in (vb || {});
      
      if (!hasInA && hasInB) {
        changes.push({ path: pa ? pa + '.' + k : k, from: undefined, to: vb[k] });
      } else if (hasInA && !hasInB) {
        changes.push({ path: pa ? pa + '.' + k : k, from: va[k], to: undefined });
      } else {
        walk(pa ? pa + '.' + k : k, va[k], vb[k]);
      }
    }
  }
  walk('', A, B);

  const breaking = [];
  for (const c of changes) {
    // Schema hash change - treat as breaking for endpoint removals only (not additions)
    if (c.path === 'schema_hash' && c.to !== undefined && c.from !== undefined) {
      // Check if this is due to endpoint removal by looking for endpoint path changes
      const hasEndpointRemoval = changes.some(ch =>
        ch.path.startsWith('endpoints.paths.') && ch.to === undefined && ch.from !== undefined &&
        !ch.path.includes('.', ch.path.indexOf('endpoints.paths.') + 'endpoints.paths.'.length)
      );
      
      if (hasEndpointRemoval) {
        breaking.push({ ...c, reason: 'endpoints changed' });
      }
    }
    
    // Endpoint removal detection
    if (c.path.startsWith('endpoints.paths.') && c.to === undefined && c.from !== undefined) {
      // Check if this is an endpoint path being removed (not just a property)
      if (!c.path.includes('.', c.path.indexOf('endpoints.paths.') + 'endpoints.paths.'.length)) {
        breaking.push({ ...c, reason: 'endpoint removed' });
      }
    }
    
    // Request body requirement changes - only breaking when it becomes MORE restrictive (false -> true)
    if (c.path.includes('requestBody.required') && c.to === true && c.from === false) {
      breaking.push({ ...c, reason: 'request body now required' });
    }
    
    // Security changes - breaking when security requirements are ADDED or made MORE restrictive
    if (c.path.includes('security.global') && c.to !== undefined && c.to.length > 0) {
      // Check if security was added (from empty/undefined to having values)
      // OR if new security requirements were added to existing ones
      if (c.from === undefined || (Array.isArray(c.from) && c.from.length === 0) ||
          (Array.isArray(c.from) && Array.isArray(c.to) && c.to.length > c.from.length)) {
        breaking.push({ ...c, reason: 'global security added' });
      }
    }
    
    // Lifecycle changes (active -> deprecated)
    if (c.path === 'api.lifecycle.status' && c.from === 'active' && c.to === 'deprecated') {
      breaking.push({ ...c, reason: 'lifecycle downgrade' });
    }
    
    // Required parameter addition - only breaking when required is added/changed to true
    if (c.path.includes('parameters') && c.path.includes('required') && c.to === true && c.from === false) {
      breaking.push({ ...c, reason: 'required parameter added' });
    }
  }
  
  const significant = changes.filter(c =>
    c.path.startsWith('metadata.') ||
    c.path.startsWith('info.') ||
    c.path.startsWith('servers.') ||
    (c.path.includes('description') && !c.path.includes('responses'))
  );
  
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// OpenAPI spec generation
// ————————————————————————————————————————————————————————————————

function generateOpenApi(manifest) {
  const m = manifest || {};
  const spec = {
    openapi: '3.0.3',
    info: {
      title: m.info?.title || m.api?.name || 'API',
      version: m.api?.version || '1.0.0',
      description: m.info?.description,
      termsOfService: m.info?.termsOfService,
      contact: m.info?.contact,
      license: m.info?.license
    },
    servers: m.servers?.list || [],
    paths: {},
    components: {
      securitySchemes: m.security?.schemes || {},
      schemas: {}
    },
    security: m.security?.global ? m.security.global.map(s => ({ [s]: [] })) : []
  };

  // Build paths and schemas
  const paths = m.endpoints?.paths || {};
  for (const [path, endpoint] of Object.entries(paths)) {
    // Create a proper path item with HTTP method (default to POST for endpoints with requestBody, GET otherwise)
    const method = endpoint.requestBody ? 'post' : 'get';
    
    // Initialize path if not exists
    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }
    
    spec.paths[path][method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      parameters: [],
      responses: {}
    };
    
    const operation = spec.paths[path][method];
    
    // Add parameters
    if (endpoint.parameters) {
      for (const [loc, paramMap] of Object.entries(endpoint.parameters)) {
        for (const [name, param] of Object.entries(paramMap)) {
          operation.parameters.push({
            name,
            in: loc,
            description: param.description,
            required: param.required || false,
            schema: param.schema || { type: param.type }
          });
        }
      }
    }
    
    // Add request body
    if (endpoint.requestBody) {
      operation.requestBody = {
        description: endpoint.requestBody.description,
        required: endpoint.requestBody.required,
        content: endpoint.requestBody.content
      };
    }
    
    // Add responses (required for valid OpenAPI)
    if (endpoint.responses) {
      for (const [status, response] of Object.entries(endpoint.responses)) {
        operation.responses[status] = {
          description: response.description,
          content: response.content || {},
          headers: response.headers || {}
        };
      }
    }
    
    // Add security
    if (endpoint.security) {
      operation.security = endpoint.security.map(s => ({ [s]: [] }));
    }
    
    // Add rate limiting as extension
    if (endpoint.rateLimit) {
      operation['x-rate-limit'] = endpoint.rateLimit;
    }
  }

  return JSON.stringify(spec, null, 2);
}

// ————————————————————————————————————————————————————————————————
// Client SDK generation
// ————————————————————————————————————————————————————————————————

function generateClientSdk(manifest, language = 'javascript') {
  const m = manifest || {};
  const apiName = m.api?.name || 'api';
  const safeName = apiName.replace(/[^a-zA-Z0-9]/g, '_');
  
  if (language === 'javascript') {
    let sdk = '/**\n * Auto-generated JavaScript SDK for: ' + apiName + '\n * Version: ' + (m.api?.version || '1.0.0') + '\n */\n\n';
    sdk += 'class ' + safeName + 'Client {\n';
    sdk += '  constructor(baseUrl, options = {}) {\n';
    sdk += '    this.baseUrl = baseUrl || \'' + (m.servers?.list?.[0]?.url || '') + '\';\n';
    sdk += '    this.headers = {\n';
    sdk += '      \'Content-Type\': \'application/json\',\n';
    sdk += '      ...options.headers\n';
    sdk += '    };\n';
    sdk += '  }\n\n';
    sdk += '  async request(method, path, options = {}) {\n';
    sdk += '    const url = this.baseUrl + path;\n';
    sdk += '    const config = {\n';
    sdk += '      method,\n';
    sdk += '      headers: { ...this.headers, ...options.headers },\n';
    sdk += '      ...options\n';
    sdk += '    };\n';
    sdk += '    \n';
    sdk += '    if (options.body) {\n';
    sdk += '      config.body = JSON.stringify(options.body);\n';
    sdk += '    }\n';
    sdk += '    \n';
    sdk += '    const response = await fetch(url, config);\n';
    sdk += '    if (!response.ok) {\n';
    sdk += '      throw new Error(`HTTP ${response.status}: ${response.statusText}`);\n';
    sdk += '    }\n';
    sdk += '    return response.json();\n';
    sdk += '  }\n\n';
    
    // Generate methods for each endpoint
    const paths = m.endpoints?.paths || {};
    for (const [path, endpoint] of Object.entries(paths)) {
      const method = Object.keys(endpoint.responses).includes('200') ? 'GET' : 'POST';
      const methodName = path.replace(/[/{}\/]/g, '_').replace(/^_/, '');
      
      sdk += '  // ' + endpoint.summary + '\n';
      sdk += '  async ' + methodName + '(params = {}) {\n';
      sdk += '    return this.request(\'' + method + '\', \'' + path + '\', { body: params });\n';
      sdk += '  }\n\n';
    }
    
    sdk += '}\n\nexport default ' + safeName + 'Client;';
    return sdk;
  }
  
  return '// SDK generation for ' + language + ' not yet implemented';
}

// ————————————————————————————————————————————————————————————————
// Protocol factory
// ————————————————————————————————————————————————————————————————

function createApiProtocol(manifestInput = {}) {
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: () => clone(manifest),
    validate: (names=[]) => runValidators(manifest, names),
    match: (expr) => query(manifest, expr),
    diff: (other) => diff(manifest, other),
    generateOpenApi: () => generateOpenApi(manifest),
    generateClientSdk: (language) => generateClientSdk(manifest, language),
    set: (path, value) => { const m = clone(manifest); dset(m, path, value); return createApiProtocol(m); },
  });
}

// ————————————————————————————————————————————————————————————————
// Catalog factory
// ————————————————————————————————————————————————————————————————

function createApiCatalog(protocols = []) {
  const items = protocols;
  const asManifests = () => items.map(p => p.manifest());
  function find(expr) { return items.filter(p => p.match(expr)); }

  // Analyze API dependencies and security coverage
  function analyzeDependencies() {
    const analysis = {
      totalEndpoints: 0,
      securityCoverage: 0,
      piiEndpoints: 0,
      deprecatedEndpoints: 0
    };
    
    for (const m of asManifests()) {
      const paths = m.endpoints?.paths || {};
      analysis.totalEndpoints += Object.keys(paths).length;
      
      for (const [path, endpoint] of Object.entries(paths)) {
        // Count security coverage once per endpoint
        if (endpoint.security || m.security?.global) {
          analysis.securityCoverage++;
        }
        
        // Check for PII in request/response
        const body = endpoint.requestBody?.content || {};
        for (const [contentType, schema] of Object.entries(body)) {
          const props = schema.properties || {};
          const hasPII = Object.values(props).some(p => p['x-pii'] === true);
          if (hasPII) analysis.piiEndpoints++;
        }
      }
      
      if (m.api?.lifecycle?.status === 'deprecated') {
        analysis.deprecatedEndpoints += Object.keys(paths).length;
      }
    }
    
    return analysis;
  }

  return Object.freeze({
    items,
    find,
    analyzeDependencies,
    validateAll: (names=[]) => asManifests().map(m => ({ name: m.api?.name, ...runValidators(m, names) }))
  });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————

export {
  createApiProtocol,
  createApiCatalog,
  registerValidator,
  Validators,
};

// ————————————————————————————————————————————————————————————————
// Example (commented)
// ————————————————————————————————————————————————————————————————
/*
const paymentsApi = createApiProtocol({
  api: { name: 'payments-api', version: '1.1.0', lifecycle: { status: 'active' } },
  info: {
    title: 'Payments API',
    description: 'Process payments and manage transactions',
    contact: { name: 'Billing Team', email: 'billing@example.com' }
  },
  servers: {
    list: [
      { url: 'https://api.example.com/v1', description: 'Production' },
      { url: 'https://staging-api.example.com/v1', description: 'Staging' }
    ]
  },
  security: {
    schemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' }
    },
    global: ['bearerAuth']
  },
  endpoints: {
    paths: {
      '/payments': {
        summary: 'Create a new payment',
        parameters: {
          header: {
            'X-Request-ID': { description: 'Request ID for idempotency', type: 'string', required: true }
          }
        },
        requestBody: {
          description: 'Payment details',
          required: true,
          content: {
            'application/json': {
              properties: {
                amount: { type: 'number', required: true },
                currency: { type: 'string', required: true },
                email: { type: 'string', 'x-pii': true }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Payment created successfully',
            content: {
              'application/json': {
                properties: {
                  payment_id: { type: 'string' },
                  status: { type: 'string' }
                }
              }
            }
          },
          '400': { description: 'Invalid request' }
        },
        rateLimit: { requests: 100, period: '1m' }
      },
      '/payments/{id}': {
        summary: 'Get payment status',
        parameters: {
          path: {
            id: { description: 'Payment ID', type: 'string', required: true }
          }
        },
        responses: {
          '200': {
            description: 'Payment details',
            content: {
              'application/json': {
                properties: {
                  payment_id: { type: 'string' },
                  status: { type: 'string' },
                  amount: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' } },
  metadata: { owner: 'billing-team', tags: ['payments', 'billing'] }
});

console.log(paymentsApi.validate());
console.log(paymentsApi.match('endpoints:contains:/payments'));
console.log(paymentsApi.generateOpenApi());
console.log(paymentsApi.generateClientSdk('javascript'));
*/
