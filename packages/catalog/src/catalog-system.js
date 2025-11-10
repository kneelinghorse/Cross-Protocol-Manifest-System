/*
 * Catalog System — v1.1.1 (stand‑alone)
 * Cross-entity analysis, URN resolution, cycle detection, and system-wide validation
 *
 * Goals
 * - Unify Data, API, and Event protocols under a single catalog
 * - Provide URN-based linking and resolution
 * - Detect cycles across all entity types
 * - Enable system-wide validation and governance
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
const clone = x => JSON.parse(JSON.stringify(x));

/** Stable 64‑bit FNV‑1a hash (hex) of any JSON‑serializable value */
function hash(value) {
  const str = jsonCanon(value);
  let h = BigInt('0xcbf29ce484222325');
  const p = BigInt('0x100000001b3');
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * p) & BigInt('0xFFFFFFFFFFFFFFFF');
  }
  return 'fnv1a64-' + h.toString(16).padStart(16, '0');
}

// ————————————————————————————————————————————————————————————————
// URN Resolution
// ————————————————————————————————————————————————————————————————

/**
 * URN format: urn:protocol:entity:id:version
 * Examples:
 * - urn:data:dataset:user_events:v1.1.0
 * - urn:api:endpoint:/payments:v1.0.0
 * - urn:event:event:payment.completed:v1.1.0
 */

function parseURN(urn) {
  if (!urn || !urn.startsWith('urn:')) return null;
  const parts = urn.split(':');
  if (parts.length < 4) return null;
  
  return {
    scheme: parts[0],
    protocol: parts[1],
    entity: parts[2],
    id: parts[3],
    version: parts[4] || 'latest'
  };
}

function buildURN(protocol, entity, id, version = 'latest') {
  return `urn:${protocol}:${entity}:${id}:${version}`;
}

function resolveURN(catalog, urn) {
  const parsed = parseURN(urn);
  if (!parsed) return null;
  
  const { protocol, entity, id, version } = parsed;
  
  // Find matching protocol instance
  const items = catalog.items || [];
  for (const item of items) {
    const manifest = item.manifest ? item.manifest() : item;
    
    // Match by protocol type
    if (protocol === 'data' && manifest.dataset?.name === id) {
      return item;
    }
    if (protocol === 'api' && manifest.api?.name === id) {
      return item;
    }
    if (protocol === 'event' && manifest.event?.name === id) {
      return item;
    }
  }
  
  return null;
}

// ————————————————————————————————————————————————————————————————
// Cross-Entity Analysis
// ————————————————————————————————————————————————————————————————

function analyzeCrossEntityRelationships(catalog) {
  const relationships = {
    dataToApi: [],
    dataToEvent: [],
    apiToEvent: [],
    eventToEvent: [],
    apiToApi: []
  };
  
  const items = catalog.items || [];
  const manifests = items.map(item => ({
    protocol: item,
    manifest: item.manifest ? item.manifest() : item,
    urn: generateURN(item)
  }));
  
  // Analyze lineage and references
  for (const { protocol, manifest, urn } of manifests) {
    // Data protocol lineage
    if (manifest.dataset) {
      const consumers = manifest.lineage?.consumers || [];
      for (const consumer of consumers) {
        if (consumer.type === 'model') {
          relationships.dataToEvent.push({
            from: urn,
            to: consumer.id,
            type: 'model_consumer',
            relationship: 'produces'
          });
        } else if (consumer.type === 'external') {
          relationships.dataToApi.push({
            from: urn,
            to: consumer.id,
            type: 'external_consumer',
            relationship: 'serves'
          });
        }
      }
    }
    
    // API protocol endpoints
    if (manifest.api) {
      const paths = manifest.endpoints?.paths || {};
      for (const [path, endpoint] of Object.entries(paths)) {
        // Check request/response schemas for data references
        const body = endpoint.requestBody?.content || {};
        for (const [contentType, schema] of Object.entries(body)) {
          const props = schema.properties || {};
          for (const [fieldName, field] of Object.entries(props)) {
            if (field['x-data-ref']) {
              relationships.apiToData.push({
                from: urn,
                to: field['x-data-ref'],
                type: 'data_reference',
                field: fieldName
              });
            }
          }
        }
      }
    }
    
    // Event protocol workflows
    if (manifest.event) {
      // Check for references to other events in workflows
      // This would be populated by workflow analysis
    }
  }
  
  return relationships;
}

function generateURN(protocol) {
  const manifest = protocol.manifest ? protocol.manifest() : protocol;
  
  if (manifest.dataset) {
    return buildURN('data', 'dataset', manifest.dataset.name, manifest.version || 'v1.1.1');
  }
  if (manifest.api) {
    return buildURN('api', 'api', manifest.api.name, manifest.version || 'v1.1.1');
  }
  if (manifest.event) {
    return buildURN('event', 'event', manifest.event.name, manifest.version || 'v1.1.1');
  }
  
  return null;
}

// ————————————————————————————————————————————————————————————————
// Cycle Detection
// ————————————————————————————————————————————————————————————————

function detectCrossEntityCycles(catalog) {
  const graph = new Map();
  const items = catalog.items || [];
  
  // Build graph from all entity relationships
  for (const item of items) {
    const manifest = item.manifest ? item.manifest() : item;
    const urn = generateURN(item);
    
    if (!urn) continue;
    
    const edges = [];
    
    // Data protocol lineage
    if (manifest.dataset) {
      const consumers = manifest.lineage?.consumers || [];
      for (const consumer of consumers) {
        edges.push(consumer.id);
      }
    }
    
    // Event protocol workflows (if available)
    if (manifest.workflow) {
      const steps = manifest.workflow.steps || [];
      for (const step of steps) {
        if (step.produces) {
          edges.push(...step.produces);
        }
      }
    }
    
    // API protocol dependencies (simplified)
    if (manifest.api && manifest.metadata?.dependencies) {
      edges.push(...manifest.metadata.dependencies);
    }
    
    graph.set(urn, edges);
  }
  
  // Detect cycles using DFS
  const visited = new Set();
  const stack = new Set();
  const cycles = [];
  
  function dfs(node, path = []) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat([node]));
      return;
    }
    
    if (visited.has(node)) return;
    
    visited.add(node);
    stack.add(node);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      // Try to resolve neighbor to URN
      const neighborURN = neighbor.startsWith('urn:') ? neighbor : findURNByName(catalog, neighbor);
      if (neighborURN) {
        dfs(neighborURN, [...path, node]);
      }
    }
    
    stack.delete(node);
  }
  
  for (const [node] of graph) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }
  
  return cycles;
}

function findURNByName(catalog, name) {
  const items = catalog.items || [];
  for (const item of items) {
    const manifest = item.manifest ? item.manifest() : item;
    if (manifest.dataset?.name === name || 
        manifest.api?.name === name || 
        manifest.event?.name === name) {
      return generateURN(item);
    }
  }
  return null;
}

// ————————————————————————————————————————————————————————————————
// System-Wide Validation
// ————————————————————————————————————————————————————————————————

function validateSystem(catalog, options = {}) {
  const results = {
    valid: true,
    protocolValidations: [],
    crossEntityValidation: [],
    governanceChecks: [],
    performanceChecks: []
  };
  
  const items = catalog.items || [];
  
  // 1. Validate each protocol individually
  for (const item of items) {
    if (item.validate) {
      const validation = item.validate();
      results.protocolValidations.push({
        urn: generateURN(item),
        valid: validation.ok,
        issues: validation.results || []
      });
      if (!validation.ok) results.valid = false;
    }
  }
  
  // 2. Cross-entity validation
  const relationships = analyzeCrossEntityRelationships(catalog);
  const cycles = detectCrossEntityCycles(catalog);
  
  if (cycles.length > 0) {
    results.crossEntityValidation.push({
      type: 'cycles',
      valid: false,
      cycles: cycles
    });
    results.valid = false;
  }
  
  // 3. Governance checks
  const piiAnalysis = analyzePIIGovernance(catalog);
  results.governanceChecks.push(...piiAnalysis);
  
  // 4. Performance analysis
  if (options.checkPerformance) {
    const performance = analyzePerformance(catalog);
    results.performanceChecks.push(...performance);
  }
  
  return results;
}

function analyzePIIGovernance(catalog) {
  const checks = [];
  const items = catalog.items || [];
  
  let totalPIIFields = 0;
  let encryptedDatasets = 0;
  let piiEventsWithoutDLQ = 0;
  
  for (const item of items) {
    const manifest = item.manifest ? item.manifest() : item;
    const urn = generateURN(item);
    
    // Data protocol PII analysis
    if (manifest.dataset) {
      const fields = manifest.schema?.fields || {};
      const piiFields = Object.entries(fields).filter(([_, field]) => field.pii);
      totalPIIFields += piiFields.length;
      
      if (piiFields.length > 0) {
        const encrypted = manifest.governance?.storage_residency?.encrypted_at_rest;
        if (encrypted) encryptedDatasets++;
        
        checks.push({
          type: 'pii_data',
          urn: urn,
          piiFields: piiFields.length,
          encrypted: encrypted,
          valid: encrypted || piiFields.length === 0
        });
      }
    }
    
    // Event protocol PII analysis
    if (manifest.event) {
      const fields = extractEventFields(manifest);
      const piiFields = fields.filter(f => f.pii);
      
      if (piiFields.length > 0) {
        const hasDLQ = manifest.delivery?.contract?.dlq;
        if (!hasDLQ && manifest.delivery?.contract?.guarantees !== 'best-effort') {
          piiEventsWithoutDLQ++;
        }
        
        checks.push({
          type: 'pii_event',
          urn: urn,
          piiFields: piiFields.length,
          hasDLQ: hasDLQ,
          valid: hasDLQ || manifest.delivery?.contract?.guarantees === 'best-effort'
        });
      }
    }
    
    // API protocol PII analysis
    if (manifest.api) {
      const piiFields = findAPIPIIFields(manifest);
      if (piiFields.length > 0) {
        const classification = manifest.governance?.policy?.classification;
        checks.push({
          type: 'pii_api',
          urn: urn,
          piiFields: piiFields.length,
          classification: classification,
          valid: classification === 'pii'
        });
      }
    }
  }
  
  return checks;
}

function extractEventFields(manifest) {
  if (Array.isArray(manifest.schema?.fields)) {
    return manifest.schema.fields.map(f => ({ name: f.name, pii: !!f.pii }));
  }
  const props = manifest.schema?.payload?.properties || {};
  const req = new Set(manifest.schema?.payload?.required || []);
  return Object.keys(props).map(name => ({ 
    name, 
    pii: !!props[name]['x-pii'], 
    required: req.has(name) 
  }));
}

function findAPIPIIFields(manifest) {
  const piiFields = [];
  const paths = manifest.endpoints?.paths || {};
  
  for (const [path, endpoint] of Object.entries(paths)) {
    const body = endpoint.requestBody?.content || {};
    for (const [contentType, schema] of Object.entries(body)) {
      const props = schema.properties || {};
      for (const [fieldName, field] of Object.entries(props)) {
        if (field['x-pii'] === true) {
          piiFields.push({ path, field: fieldName });
        }
      }
    }
  }
  
  return piiFields;
}

function analyzePerformance(catalog) {
  const checks = [];
  const items = catalog.items || [];
  
  let totalEntities = items.length;
  let totalEndpoints = 0;
  let totalEvents = 0;
  let totalDatasets = 0;
  
  for (const item of items) {
    const manifest = item.manifest ? item.manifest() : item;
    
    if (manifest.api) {
      const paths = manifest.endpoints?.paths || {};
      totalEndpoints += Object.keys(paths).length;
    } else if (manifest.event) {
      totalEvents++;
    } else if (manifest.dataset) {
      totalDatasets++;
    }
  }
  
  checks.push({
    type: 'scale',
    totalEntities,
    totalEndpoints,
    totalEvents,
    totalDatasets,
    valid: totalEntities < 10000 // Arbitrary threshold
  });
  
  return checks;
}

// ————————————————————————————————————————————————————————————————
// Catalog Factory
// ————————————————————————————————————————————————————————————————

function createCatalogSystem(protocols = []) {
  // Create a copy to ensure immutability
  const items = [...protocols];
  
  function asManifests() {
    return items.map(p => p.manifest ? p.manifest() : p);
  }
  
  function find(expr) {
    const searchStr = String(expr).toLowerCase();
    return items.filter(p => {
      const manifest = p.manifest ? p.manifest() : p;
      const name = String(manifest.dataset?.name || manifest.api?.name || manifest.event?.name || '').toLowerCase();
      return name.includes(searchStr);
    });
  }
  
  function findByURN(urn) {
    return resolveURN({ items }, urn);
  }
  
  function getRelationships() {
    return analyzeCrossEntityRelationships({ items });
  }
  
  function detectCycles() {
    return detectCrossEntityCycles({ items });
  }
  
  function validate(options = {}) {
    return validateSystem({ items }, options);
  }
  
  function generateSystemReport() {
    const validation = validate({ checkPerformance: true });
    const relationships = getRelationships();
    const cycles = detectCycles();
    
    return {
      summary: {
        totalEntities: items.length,
        valid: validation.valid,
        cyclesDetected: cycles.length,
        relationshipsFound: Object.values(relationships).flat().length
      },
      validation,
      relationships,
      cycles,
      urns: items.map(item => generateURN(item)).filter(Boolean)
    };
  }
  
  // Return a frozen object with a getter for items that returns a copy
  return Object.freeze({
    get items() { return [...items]; },
    find,
    findByURN,
    getRelationships,
    detectCycles,
    validate,
    generateSystemReport,
    asManifests
  });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————

export {
  createCatalogSystem,
  parseURN,
  buildURN,
  resolveURN,
  generateURN,
  analyzeCrossEntityRelationships,
  detectCrossEntityCycles,
  validateSystem
};