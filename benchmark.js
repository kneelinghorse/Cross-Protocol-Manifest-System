/**
 * Performance benchmarks for foundation utilities
 * Tests performance targets: 1M hashes/sec for FNV-1a, 100K for SHA-256
 */

const {
  jsonCanon,
  hash,
  dget,
  dset,
  parseQuery
} = require('./utils.js');

// Benchmark configuration
const ITERATIONS = {
  FNV1A: 1000000,  // 1M iterations for FNV-1a
  SHA256: 100000,  // 100K iterations for SHA-256
  JSON_CANON: 10000, // 10K iterations for JSON canonicalization
  DGET: 100000,     // 100K iterations for dget
  DSET: 100000,     // 100K iterations for dset
  QUERY: 100000     // 100K iterations for query parsing
};

// Test data
const testData = {
  simple: { name: 'test', value: 42 },
  nested: {
    user: {
      profile: {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['admin', 'user', 'developer']
      },
      settings: {
        theme: 'dark',
        notifications: true
      }
    },
    metadata: {
      created: '2023-01-01',
      updated: '2023-12-01'
    }
  },
  large: {}
};

// Create large test object
for (let i = 0; i < 1000; i++) {
  testData.large[`field${i}`] = `value${i}`;
}

// Benchmark helper
function benchmark(name, fn, iterations) {
  console.log(`\nBenchmarking: ${name}`);
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  
  const start = process.hrtime.bigint();
  
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000; // Convert to milliseconds
  const opsPerSec = Math.round((iterations / duration) * 1000);
  
  console.log(`Duration: ${duration.toFixed(2)}ms`);
  console.log(`Ops/sec: ${opsPerSec.toLocaleString()}`);
  
  return {
    name,
    iterations,
    duration,
    opsPerSec
  };
}

// Run benchmarks
console.log('=== Foundation Utilities Performance Benchmarks ===');

const results = [];

// FNV-1a hash benchmark
results.push(benchmark('FNV-1a Hash', () => {
  hash('test string for hashing', 'fnv1a');
}, ITERATIONS.FNV1A));

// SHA-256 hash benchmark
results.push(benchmark('SHA-256 Hash', () => {
  hash('test string for hashing', 'sha256');
}, ITERATIONS.SHA256));

// JSON canonicalization benchmarks
results.push(benchmark('JSON Canon (simple)', () => {
  jsonCanon(testData.simple);
}, ITERATIONS.JSON_CANON));

results.push(benchmark('JSON Canon (nested)', () => {
  jsonCanon(testData.nested);
}, ITERATIONS.JSON_CANON));

results.push(benchmark('JSON Canon (large)', () => {
  jsonCanon(testData.large);
}, ITERATIONS.JSON_CANON / 10)); // Reduce iterations for large object

// dget benchmarks
results.push(benchmark('dget (simple path)', () => {
  dget(testData.nested, 'user.profile.name');
}, ITERATIONS.DGET));

results.push(benchmark('dget (nested path)', () => {
  dget(testData.nested, 'user.profile.tags[0]');
}, ITERATIONS.DGET));

// dset benchmarks
results.push(benchmark('dset (simple)', () => {
  dset(testData.simple, 'newField', 'value');
}, ITERATIONS.DSET));

results.push(benchmark('dset (nested)', () => {
  dset(testData.nested, 'user.profile.newField', 'value');
}, ITERATIONS.DSET / 10)); // Reduce iterations for nested dset

// Query parsing benchmarks
const query1 = parseQuery('user.profile.age:>:25');
const query2 = parseQuery('user.profile.name:=:John');
const query3 = parseQuery('user.profile.tags:contains:admin');

results.push(benchmark('Query parse & eval (>)', () => {
  query1(testData.nested);
}, ITERATIONS.QUERY));

results.push(benchmark('Query parse & eval (:=:)', () => {
  query2(testData.nested);
}, ITERATIONS.QUERY));

results.push(benchmark('Query parse & eval (contains)', () => {
  query3(testData.nested);
}, ITERATIONS.QUERY));

// Summary
console.log('\n=== Benchmark Summary ===');
console.log('Target: FNV-1a >= 1M ops/sec, SHA-256 >= 100K ops/sec, JSON canon < 1ms for 1000-field objects');

results.forEach(result => {
  const status = 
    (result.name.includes('FNV-1a') && result.opsPerSec >= 1000000) ? '✓' :
    (result.name.includes('SHA-256') && result.opsPerSec >= 100000) ? '✓' :
    (result.name.includes('JSON Canon') && result.duration < 100) ? '✓' : // < 1ms per operation
    (result.name.includes('dget') && result.opsPerSec > 100000) ? '✓' :
    (result.name.includes('dset') && result.opsPerSec > 100000) ? '✓' :
    (result.name.includes('Query') && result.opsPerSec > 100000) ? '✓' :
    '✗';
  
  console.log(`${status} ${result.name}: ${result.opsPerSec.toLocaleString()} ops/sec (${result.duration.toFixed(2)}ms)`);
});

// Save results to JSON file
const fs = require('fs');
const benchmarkResults = {
  timestamp: new Date().toISOString(),
  results: results.map(r => ({
    name: r.name,
    iterations: r.iterations,
    duration: r.duration,
    opsPerSec: r.opsPerSec
  }))
};

fs.writeFileSync('benchmark-results.json', JSON.stringify(benchmarkResults, null, 2));
console.log('\nResults saved to benchmark-results.json');