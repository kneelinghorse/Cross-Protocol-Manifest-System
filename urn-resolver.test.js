/**
 * URN Resolver Test Suite
 * Comprehensive tests for URN parsing, resolution, and validation
 */

import { 
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
} from './urn-resolver.js';

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
let testChain = Promise.resolve();

function test(name, fn) {
  testsRun++;
  const task = async () => {
    try {
      await fn();
      testsPassed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      testsFailed++;
      console.error(`✗ ${name}: ${error.message}`);
    }
  };
  testChain = testChain.then(task);
}

function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  fn();
}

function beforeAll(fn) {
  testChain = testChain.then(() => fn());
}

function afterAll(fn) {
  testChain = testChain.then(() => fn());
}

// Test data directory
const TEST_MANIFEST_DIR = './test-manifests';

// Helper to create test manifests
function createTestManifest(type, id, version, content = {}) {
  const manifest = {
    type,
    id,
    version,
    ...content
  };
  
  const dir = join(TEST_MANIFEST_DIR, type);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const filename = version === 'latest' ? `${id}.json` : `${id}@${version}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(manifest, null, 2));
  
  return manifest;
}

// Setup test environment
function setupTestEnvironment() {
  // Clean up any existing test directory
  if (existsSync(TEST_MANIFEST_DIR)) {
    rmSync(TEST_MANIFEST_DIR, { recursive: true, force: true });
  }
  
  // Create test manifests
  mkdirSync(TEST_MANIFEST_DIR, { recursive: true });
  
  // Data protocol manifests
  createTestManifest('data', 'user_events', 'v1.1.1', {
    dataset: { name: 'user_events' },
    schema: {
      fields: {
        email: { type: 'string', pii: true },
        timestamp: { type: 'datetime' }
      }
    }
  });
  
  createTestManifest('data', 'user_events', 'v1.2.0', {
    dataset: { name: 'user_events' },
    schema: {
      fields: {
        email: { type: 'string', pii: true },
        timestamp: { type: 'datetime' },
        user_id: { type: 'string' }
      }
    }
  });
  
  createTestManifest('data', 'transactions', 'v2.0.0', {
    dataset: { name: 'transactions' },
    schema: {
      fields: {
        amount: { type: 'decimal' },
        currency: { type: 'string' }
      }
    }
  });
  
  // API protocol manifests
  createTestManifest('api', 'billing', 'v2.0.0', {
    api: { name: 'billing' },
    endpoints: {
      paths: {
        '/v1/charge': {
          method: 'POST',
          requestBody: {
            content: {
              'application/json': {
                properties: {
                  amount: { type: 'number' },
                  currency: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  });
  
  // Event protocol manifests
  createTestManifest('event', 'payment.received', 'v1.0.0', {
    event: { name: 'payment.received' },
    schema: {
      payload: {
        properties: {
          payment_id: { type: 'string' },
          amount: { type: 'number' }
        }
      }
    }
  });
  
  // Agent protocol manifests
  createTestManifest('agent', 'support', 'v1.0.0', {
    agent: { name: 'support' },
    capabilities: {
      refund: { enabled: true },
      escalate: { enabled: true }
    }
  });
  
  // Semantic protocol manifests
  createTestManifest('semantic', 'customer', 'v1.0.0', {
    semantic: { name: 'customer' },
    concepts: {
      customer: {
        properties: ['email', 'name', 'account_status']
      }
    }
  });
}

// Cleanup test environment
function cleanupTestEnvironment() {
  if (existsSync(TEST_MANIFEST_DIR)) {
    rmSync(TEST_MANIFEST_DIR, { recursive: true, force: true });
  }
}

// Run tests
setupTestEnvironment();

describe('URN Resolver', () => {
  describe('parseURN', () => {
    test('should parse valid URN with all components', () => {
      const result = parseURN('urn:proto:data:user_events@v1.1.1#schema.fields.email');
      
      assertDeepEqual(result, {
        type: 'data',
        id: 'user_events',
        version: 'v1.1.1',
        fragment: 'schema.fields.email',
        original: 'urn:proto:data:user_events@v1.1.1#schema.fields.email'
      }, 'should parse URN with all components');
    });
    
    test('should parse URN without version', () => {
      const result = parseURN('urn:proto:api:billing#endpoints./v1/charge');
      
      assertDeepEqual(result, {
        type: 'api',
        id: 'billing',
        version: 'latest',
        fragment: 'endpoints./v1/charge',
        original: 'urn:proto:api:billing#endpoints./v1/charge'
      }, 'should parse URN without version');
    });
    
    test('should parse URN without fragment', () => {
      const result = parseURN('urn:proto:event:payment.received@v1.0.0');
      
      assertDeepEqual(result, {
        type: 'event',
        id: 'payment.received',
        version: 'v1.0.0',
        fragment: null,
        original: 'urn:proto:event:payment.received@v1.0.0'
      }, 'should parse URN without fragment');
    });
    
    test('should parse minimal URN', () => {
      const result = parseURN('urn:proto:agent:support');
      
      assertDeepEqual(result, {
        type: 'agent',
        id: 'support',
        version: 'latest',
        fragment: null,
        original: 'urn:proto:agent:support'
      }, 'should parse minimal URN');
    });
    
    test('should support all protocol types', () => {
      const types = ['data', 'event', 'api', 'agent', 'semantic'];
      
      types.forEach(type => {
        const result = parseURN(`urn:proto:${type}:test@v1.0.0`);
        assert(result !== null, `should parse ${type} protocol`);
        assertEqual(result.type, type, `should have correct type ${type}`);
      });
    });
    
    test('should return null for invalid URN format', () => {
      assertEqual(parseURN('invalid:urn'), null, 'should reject invalid URN');
      assertEqual(parseURN('urn:proto:invalid'), null, 'should reject incomplete URN');
      assertEqual(parseURN('urn:proto:wrong:type:test@v1.0.0'), null, 'should reject wrong format');
      assertEqual(parseURN(''), null, 'should reject empty string');
      assertEqual(parseURN(null), null, 'should reject null');
    });
    
    test('should handle special characters in ID', () => {
      const result = parseURN('urn:proto:data:user-events@v1.0.0');
      assert(result !== null, 'should parse URN with dashes');
      assertEqual(result.id, 'user-events', 'should preserve dashes in ID');
    });
  });

  describe('validateURNFormat', () => {
    test('should validate correct URN format', () => {
      const result = validateURNFormat('urn:proto:data:test@v1.0.0');
      
      assertEqual(result.valid, true, 'should be valid');
      assert(result.parsed !== undefined, 'should have parsed result');
    });
    
    test('should reject invalid URN format', () => {
      const result = validateURNFormat('invalid:urn');
      
      assertEqual(result.valid, false, 'should be invalid');
      assertEqual(result.error, 'Invalid URN format', 'should have error message');
    });
  });

  describe('parseSemanticVersion', () => {
    test('should parse valid semantic version', () => {
      const result = parseSemanticVersion('1.2.3');
      
      assertDeepEqual(result, {
        major: 1,
        minor: 2,
        patch: 3
      }, 'should parse version components');
    });
    
    test('should return null for invalid version', () => {
      assertEqual(parseSemanticVersion('1.2'), null, 'should reject incomplete version');
      assertEqual(parseSemanticVersion('v1.2.3'), null, 'should reject version with v prefix');
      assertEqual(parseSemanticVersion('1.2.3.4'), null, 'should reject version with 4 parts');
      assertEqual(parseSemanticVersion('invalid'), null, 'should reject invalid string');
    });
  });

  describe('checkVersionCompatibility', () => {
    test('should consider latest version always compatible', () => {
      const result = checkVersionCompatibility('latest', '2.0.0');
      
      assertEqual(result.compatible, true, 'latest should be compatible');
    });
    
    test('should reject major version mismatch', () => {
      const result = checkVersionCompatibility('2.0.0', '1.5.0');
      
      assertEqual(result.compatible, false, 'should reject major version mismatch');
      assert(result.reason.includes('Major version mismatch'), 'should have correct reason');
    });
    
    test('should allow minor version upgrade', () => {
      const result = checkVersionCompatibility('1.1.0', '1.2.0');
      
      assertEqual(result.compatible, true, 'should allow minor upgrade');
    });
    
    test('should reject minor version downgrade', () => {
      const result = checkVersionCompatibility('1.2.0', '1.1.0');
      
      assertEqual(result.compatible, false, 'should reject minor downgrade');
      assert(result.reason.includes('minor version'), 'should have correct reason');
    });
    
    test('should allow patch version upgrade', () => {
      const result = checkVersionCompatibility('1.1.0', '1.1.5');
      
      assertEqual(result.compatible, true, 'should allow patch upgrade');
    });
    
    test('should reject patch version downgrade', () => {
      const result = checkVersionCompatibility('1.1.5', '1.1.0');
      
      assertEqual(result.compatible, false, 'should reject patch downgrade');
      assert(result.reason.includes('patch version'), 'should have correct reason');
    });
    
    test('should handle exact version match', () => {
      const result = checkVersionCompatibility('1.2.3', '1.2.3');
      
      assertEqual(result.compatible, true, 'should handle exact match');
    });
  });

  describe('loadManifestFromFile', () => {
    test('should load existing manifest', () => {
      const result = loadManifestFromFile('data', 'user_events', 'v1.1.1', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assert(result !== null, 'should load manifest');
      assertEqual(result.id, 'user_events', 'should have correct ID');
      assertEqual(result.version, 'v1.1.1', 'should have correct version');
    });
    
    test('should load latest version when specified', () => {
      const result = loadManifestFromFile('data', 'user_events', 'latest', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assert(result !== null, 'should load manifest');
      assertEqual(result.id, 'user_events', 'should have correct ID');
    });
    
    test('should return null for non-existent manifest', () => {
      const result = loadManifestFromFile('data', 'nonexistent', 'v1.0.0', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result, null, 'should return null for non-existent manifest');
    });
  });

  describe('resolveURN', () => {
    test('should resolve URN to manifest', async () => {
      const result = await resolveURN('urn:proto:data:user_events@v1.1.1', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.success, true, 'should resolve successfully');
      assert(result.manifest !== undefined, 'should have manifest');
      assertEqual(result.manifest.id, 'user_events', 'should have correct ID');
    });
    
    test('should resolve URN with fragment', async () => {
      const result = await resolveURN('urn:proto:data:user_events@v1.1.1#schema.fields.email', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.success, true, 'should resolve with fragment');
      assert(result.resolvedData !== undefined, 'should have resolved data');
      assertEqual(result.resolvedData.type, 'string', 'should have correct type');
      assertEqual(result.resolvedData.pii, true, 'should have correct pii flag');
    });
    
    test('should handle non-existent fragment', async () => {
      const result = await resolveURN('urn:proto:data:user_events@v1.1.1#nonexistent.path', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.success, false, 'should fail for non-existent fragment');
      assert(result.error.includes('Fragment not found'), 'should have fragment error');
    });
    
    test('should reject incompatible version', async () => {
      const result = await resolveURN('urn:proto:data:user_events@v2.0.0', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.success, false, 'should reject incompatible version');
      assert(result.error.includes('Version incompatible'), 'should have version error');
    });
    
    test('should resolve all protocol types', async () => {
      const testCases = [
        'urn:proto:data:user_events@v1.1.1',
        'urn:proto:api:billing@v2.0.0',
        'urn:proto:event:payment.received@v1.0.0',
        'urn:proto:agent:support@v1.0.0',
        'urn:proto:semantic:customer@v1.0.0'
      ];
      
      for (const urn of testCases) {
        const result = await resolveURN(urn, {
          manifestDir: TEST_MANIFEST_DIR
        });
        assertEqual(result.success, true, `should resolve ${urn}`);
      }
    });
  });

  describe('validateURN', () => {
    test('should validate existing URN', async () => {
      const result = await validateURN('urn:proto:data:user_events@v1.1.1', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.valid, true, 'should be valid');
      assertEqual(result.exists, true, 'should exist');
      assertEqual(result.compatible, true, 'should be compatible');
    });
    
    test('should reject non-existent URN', async () => {
      const result = await validateURN('urn:proto:data:nonexistent@v1.0.0', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.valid, false, 'should be invalid');
      assertEqual(result.exists, false, 'should not exist');
    });
    
    test('should handle version incompatibility', async () => {
      const result = await validateURN('urn:proto:data:user_events@v2.0.0', {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(result.valid, false, 'should be invalid');
      assertEqual(result.exists, true, 'should exist but be incompatible');
      assertEqual(result.compatible, false, 'should not be compatible');
    });
  });

  describe('batchResolveURN', () => {
    test('should resolve multiple URNs', async () => {
      const urns = [
        'urn:proto:data:user_events@v1.1.1',
        'urn:proto:api:billing@v2.0.0',
        'urn:proto:event:payment.received@v1.0.0'
      ];
      
      const results = await batchResolveURN(urns, {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(results.length, 3, 'should have 3 results');
      assert(results.every(r => r.success), 'all should succeed');
    });
    
    test('should handle mixed valid and invalid URNs', async () => {
      const urns = [
        'urn:proto:data:user_events@v1.1.1',
        'urn:proto:data:nonexistent@v1.0.0',
        'urn:proto:api:billing@v2.0.0'
      ];
      
      const results = await batchResolveURN(urns, {
        manifestDir: TEST_MANIFEST_DIR
      });
      
      assertEqual(results.length, 3, 'should have 3 results');
      assertEqual(results[0].success, true, 'first should succeed');
      assertEqual(results[1].success, false, 'second should fail');
      assertEqual(results[2].success, true, 'third should succeed');
    });
  });

  describe('createURNResolver', () => {
    test('should create resolver with default config', () => {
      const resolver = createURNResolver();
      
      assert(resolver.resolve !== undefined, 'should have resolve method');
      assert(resolver.validate !== undefined, 'should have validate method');
      assert(resolver.parse !== undefined, 'should have parse method');
      assertEqual(resolver.config.enableCache, true, 'should have cache enabled by default');
    });
    
    test('should create resolver with custom config', () => {
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        enableCache: false
      });
      
      assertEqual(resolver.config.manifestDir, TEST_MANIFEST_DIR, 'should have custom manifest dir');
      assertEqual(resolver.config.enableCache, false, 'should have cache disabled');
    });
    
    test('should cache successful resolutions', async () => {
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        enableCache: true
      });
      
      // First call
      const result1 = await resolver.resolve('urn:proto:data:user_events@v1.1.1');
      assertEqual(result1.success, true, 'first call should succeed');
      
      // Check cache stats
      const stats = resolver.getCacheStats();
      assertEqual(stats.size, 1, 'should have 1 cache entry');
      
      // Second call should use cache
      const result2 = await resolver.resolve('urn:proto:data:user_events@v1.1.1');
      assertEqual(result2.success, true, 'second call should succeed');
      
      // Cache should still have one entry
      const stats2 = resolver.getCacheStats();
      assertEqual(stats2.size, 1, 'should still have 1 cache entry');
    });
    
    test('should clear cache', async () => {
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        enableCache: true
      });
      
      // Resolve something to populate cache
      await resolver.resolve('urn:proto:data:user_events@v1.1.1');
      
      // Clear cache
      resolver.clearCache();
      
      const stats = resolver.getCacheStats();
      assertEqual(stats.size, 0, 'cache should be empty');
    });
  });

  describe('createURNHTTPServer', () => {
    let server;
    let serverInstance;
    let baseUrl;
    
    beforeAll(async () => {
      server = createURNHTTPServer({
        port: 0,
        manifestDir: TEST_MANIFEST_DIR
      });
      serverInstance = await server.start();
      baseUrl = serverInstance.url;
    });

    test('should start HTTP server', () => {
      assert(serverInstance.port > 0, 'should have assigned port');
      assert(baseUrl.startsWith('http://localhost'), 'should have localhost URL');
    });
    
    test('should handle health check', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();
      
      assertEqual(response.status, 200, 'should return 200');
      assertEqual(data.status, 'healthy', 'should be healthy');
    });
    
    test('should resolve URN via HTTP', async () => {
      const response = await fetch(`${baseUrl}/resolve?urn=urn:proto:data:user_events@v1.1.1`);
      const data = await response.json();
      
      assertEqual(response.status, 200, 'should return 200');
      assertEqual(data.success, true, 'should succeed');
      assert(data.manifest !== undefined, 'should have manifest');
    });
    
    test('should handle invalid URN parameter', async () => {
      const response = await fetch(`${baseUrl}/resolve`);
      const data = await response.json();
      
      assertEqual(response.status, 400, 'should return 400');
      assert(data.error.includes('URN parameter required'), 'should have error');
    });
    
    test('should handle cache stats endpoint', async () => {
      const response = await fetch(`${baseUrl}/cache/stats`);
      const data = await response.json();
      
      assertEqual(response.status, 200, 'should return 200');
      assert(data.size !== undefined, 'should have size');
    });
    
    test('should handle cache clear endpoint', async () => {
      const response = await fetch(`${baseUrl}/cache/clear`);
      const data = await response.json();
      
      assertEqual(response.status, 200, 'should return 200');
      assertEqual(data.message, 'Cache cleared', 'should clear cache');
    });
    
    test('should handle batch resolution', async () => {
      const urns = [
        'urn:proto:data:user_events@v1.1.1',
        'urn:proto:api:billing@v2.0.0'
      ].join(',');
      
      const response = await fetch(`http://localhost:3333/resolve/batch?urns=${encodeURIComponent(urns)}`);
      const data = await response.json();
      
      assertEqual(response.status, 200, 'should return 200');
      assert(Array.isArray(data), 'should return array');
      assertEqual(data.length, 2, 'should have 2 results');
    });
    
    test('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      
      assertEqual(response.status, 404, 'should return 404');
    });
    
    afterAll(async () => {
      if (server) {
        await server.stop();
      }
    });
  });

  describe('Integration with catalog system', () => {
    test('should work with catalog system integration', async () => {
      // Create a simple catalog
      const mockCatalog = {
        items: [{
          manifest: () => ({
            type: 'data',
            id: 'catalog_test',
            version: 'v1.0.0',
            dataset: { name: 'catalog_test' }
          })
        }]
      };
      
      // Add test manifest to file system
      createTestManifest('data', 'catalog_test', 'v1.0.0', {
        dataset: { name: 'catalog_test' }
      });
      
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        catalog: mockCatalog,
        mode: 'catalog'
      });
      
      const result = await resolver.resolve('urn:proto:data:catalog_test@v1.0.0');
      assertEqual(result.success, true, 'should work with catalog');
    });
  });

  describe('Performance tests', () => {
    test('should resolve URNs within performance target', async () => {
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        enableCache: false
      });
      
      const urn = 'urn:proto:data:user_events@v1.1.1';
      const iterations = 100;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await resolver.resolve(urn);
        const end = Date.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Target: ≤10ms per resolution
      assert(avgTime < 10, `average time ${avgTime}ms should be less than 10ms`);
    });
    
    test('should handle batch resolution efficiently', async () => {
      const resolver = createURNResolver({
        manifestDir: TEST_MANIFEST_DIR,
        enableCache: false
      });
      
      const urns = [
        'urn:proto:data:user_events@v1.1.1',
        'urn:proto:api:billing@v2.0.0',
        'urn:proto:event:payment.received@v1.0.0',
        'urn:proto:agent:support@v1.0.0',
        'urn:proto:semantic:customer@v1.0.0'
      ];
      
      const start = Date.now();
      const results = await resolver.batchResolve(urns);
      const end = Date.now();
      
      assertEqual(results.length, 5, 'should have 5 results');
      assert(results.every(r => r.success), 'all should succeed');
      
      // Target: ≤20ms for batch of 5 URNs
      assert(end - start < 20, `batch time ${end - start}ms should be less than 20ms`);
    });
  });
});

testChain
  .then(() => cleanupTestEnvironment())
  .then(() => {
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${testsRun}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    if (testsFailed > 0) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
