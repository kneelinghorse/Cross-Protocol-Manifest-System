/**
 * Cross-Protocol Manifest System - Foundation Utilities
 * Zero-dependency utility library for deterministic operations across protocols
 * @version 1.0.0
 */

/**
 * Deterministic JSON canonicalization for stable hashing
 * Produces consistent output regardless of key order
 * @param {*} obj - Object to canonicalize
 * @returns {string} Deterministic JSON string
 */
function jsonCanon(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  const type = typeof obj;
  
  if (type === 'string') return JSON.stringify(obj);
  if (type === 'number' || type === 'boolean') return String(obj);
  
  if (type === 'object') {
    // Handle arrays
    if (Array.isArray(obj)) {
      const items = obj.map(item => jsonCanon(item));
      return '[' + items.join(',') + ']';
    }
    
    // Handle plain objects
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${jsonCanon(obj[key])}`);
    return '{' + pairs.join(',') + '}';
  }
  
  // Fallback for other types (symbols, functions, etc.)
  return JSON.stringify(String(obj));
}

/**
 * Hash function supporting FNV-1a and SHA-256 algorithms
 * @param {string|Buffer} data - Input data to hash
 * @param {string} algorithm - Hash algorithm ('fnv1a' or 'sha256')
 * @returns {string} Hex-encoded hash string
 */
function hash(data, algorithm = 'fnv1a') {
  // Convert input to string if needed
  const input = typeof data === 'string' ? data : String(data);
  
  if (algorithm === 'fnv1a') {
    return fnv1aHash(input);
  } else if (algorithm === 'sha256') {
    return sha256Hash(input);
  } else {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

/**
 * FNV-1a hash implementation (fast, non-cryptographic)
 * @param {string} str - Input string
 * @returns {string} Hex-encoded hash
 */
function fnv1aHash(str) {
  const FNV_OFFSET = 2166136261;
  const FNV_PRIME = 16777619;
  
  let hash = FNV_OFFSET;
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0; // Use >>> 0 to ensure 32-bit unsigned
  }
  
  // Convert to hex and pad to 8 characters
  return hash.toString(16).padStart(8, '0');
}

/**
 * SHA-256 hash implementation (cryptographic)
 * @param {string} str - Input string
 * @returns {string} Hex-encoded hash
 */
function sha256Hash(str) {
  // Convert string to bytes
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  
  // Initial hash values
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  
  // Pre-processing: padding
  const bitLength = bytes.length * 8;
  bytes.push(0x80); // Add '1' bit
  
  // Pad with zeros until length is congruent to 56 mod 64
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }
  
  // Append length in bits as 64-bit big-endian
  for (let i = 7; i >= 0; i--) {
    bytes.push((bitLength >>> (i * 8)) & 0xff);
  }
  
  // Process blocks
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64);
    
    // Prepare message schedule
    for (let j = 0; j < 16; j++) {
      w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) |
             (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
    }
    
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    
    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3;
    let e = h4, f = h5, g = h6, h = h7;
    
    // Main loop
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    
    // Add to hash
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  
  // Convert to hex string
  const hashArray = [h0, h1, h2, h3, h4, h5, h6, h7];
  return hashArray.map(h => h.toString(16).padStart(8, '0')).join('');
}

/**
 * Rotate right operation for SHA-256
 * @param {number} n - Number to rotate
 * @param {number} bits - Bits to rotate by
 * @returns {number} Rotated number
 */
function rotr(n, bits) {
  return (n >>> bits) | (n << (32 - bits));
}

/**
 * Get value at dot-path from object
 * @param {Object} obj - Object to navigate
 * @param {string} path - Dot-path (e.g., 'schema.fields.email' or 'fields[0].name')
 * @returns {*} Value at path or undefined
 */
function dget(obj, path) {
  if (!obj || !path) return undefined;
  
  // Handle array notation and dot notation
  const parts = path.split(/[\.\[]/).map(part => part.replace(/\]$/, ''));
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Functional object update with value at dot-path
 * Returns new object without mutating input
 * @param {Object} obj - Object to update
 * @param {string} path - Dot-path
 * @param {*} value - Value to set
 * @returns {Object} New object with updated value
 */
function dset(obj, path, value) {
  if (!path) return obj;
  
  const parts = path.split(/[\.\[]/).map(part => part.replace(/\]$/, ''));
  
  // Deep clone the object to avoid mutation
  const clone = deepClone(obj);
  
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  return clone;
}

/**
 * Deep clone utility to prevent mutation
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Validator registry system
 */
const validatorRegistry = new Map();

/**
 * Register a validator function
 * @param {string} name - Validator name
 * @param {Function} fn - Validation function (manifest) => {valid: boolean, errors: string[]}
 */
function registerValidator(name, fn) {
  if (typeof name !== 'string' || !name) {
    throw new Error('Validator name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new Error('Validator must be a function');
  }
  validatorRegistry.set(name, fn);
}

/**
 * Run validators on a manifest
 * @param {Object} manifest - Manifest to validate
 * @param {string[]} validatorNames - Names of validators to run
 * @returns {Promise<Object>} Validation results
 */
async function runValidators(manifest, validatorNames) {
  const results = {
    valid: true,
    errors: [],
    validatorResults: {}
  };
  
  for (const validatorName of validatorNames) {
    const validator = validatorRegistry.get(validatorName);
    if (!validator) {
      results.valid = false;
      results.errors.push(`Validator not found: ${validatorName}`);
      continue;
    }
    
    try {
      const result = await validator(manifest);
      results.validatorResults[validatorName] = result;
      
      if (!result.valid) {
        results.valid = false;
        if (result.errors && Array.isArray(result.errors)) {
          results.errors.push(...result.errors);
        } else {
          results.errors.push(`${validatorName} validation failed`);
        }
      }
    } catch (error) {
      results.valid = false;
      results.errors.push(`Validator ${validatorName} threw error: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Query DSL parser
 * Supports operators: :=: (equals), contains, >, <, >=, <=
 * @param {string} expr - Query expression (e.g., 'governance.policy.classification:=:pii')
 * @returns {Function} Function that evaluates the query against an object
 */
function parseQuery(expr) {
  if (!expr || typeof expr !== 'string') {
    throw new Error('Query expression must be a non-empty string');
  }
  
  // Parse expression: path:operator:value
  // Split by colon to separate path, operator, and value
  const parts = expr.split(':');
  if (parts.length < 3) {
    throw new Error(`Invalid query expression format: ${expr}. Expected format: path:operator:value`);
  }
  
  const path = parts[0].trim();
  const operator = parts[1].trim();
  const value = parts.slice(2).join(':').trim(); // Rejoin in case value contains colons
  const cleanValue = value.replace(/^["']|["']$/g, '');
  
  // Validate operator
  const validOperators = ['=', ':=:', 'contains', '>', '<', '>=', '<='];
  if (!validOperators.includes(operator)) {
    throw new Error(`Invalid operator: ${operator}. Valid operators: ${validOperators.join(', ')}`);
  }
  
  return function evaluate(obj) {
    const actualValue = dget(obj, path);
    
    switch (operator) {
      case '=':
      case ':=:':
        return actualValue == cleanValue; // Use == for type coercion
      case 'contains':
        if (typeof actualValue === 'string' && typeof cleanValue === 'string') {
          return actualValue.includes(cleanValue);
        }
        if (Array.isArray(actualValue)) {
          return actualValue.includes(cleanValue);
        }
        return false;
      case '>':
        return Number(actualValue) > Number(cleanValue);
      case '<':
        return Number(actualValue) < Number(cleanValue);
      case '>=':
        return Number(actualValue) >= Number(cleanValue);
      case '<=':
        return Number(actualValue) <= Number(cleanValue);
      default:
        return false;
    }
  };
}

// Export all utilities
export {
  jsonCanon,
  hash,
  dget,
  dset,
  registerValidator,
  runValidators,
  parseQuery,
  // Export internal functions for testing
  fnv1aHash,
  sha256Hash,
  deepClone
};