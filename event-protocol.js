/**
 * Event Protocol - Runtime Event Handling v1.1.1
 * Provides publish/subscribe event handling with validation and security
 * Zero dependencies, immutable patterns
 */

// ==================== Configuration & State Management ====================

/**
 * @typedef {Object} EventProtocolConfig
 * @property {number} [maxListeners=100] - Maximum listeners per event type
 * @property {boolean} [validateEvents=false] - Enable event validation
 * @property {Object} [eventSchema=null] - JSON schema for event validation
 * @property {boolean} [enableStats=true] - Enable statistics tracking
 */

/**
 * Creates a new Event Protocol instance
 * @param {EventProtocolConfig} config - Configuration options
 * @returns {EventProtocol} Frozen protocol instance
 */
function createEventProtocol(config = {}) {
  const {
    maxListeners = 100,
    validateEvents = false,
    eventSchema = null,
    enableStats = true
  } = config;

  // Internal state (not exposed directly)
  const state = {
    subscribers: new Map(), // eventType -> Map(subscriptionId -> callback)
    stats: {
      totalEventsPublished: 0,
      totalSubscribers: 0,
      eventTypes: new Map() // eventType -> subscriberCount
    }
  };

  // ==================== Event Publishing ====================

  /**
   * Publish an event to all subscribers
   * @param {string} eventType - Type of event to publish
   * @param {Object} event - Event data to publish
   * @throws {Error} If event validation fails
   */
  function publish(eventType, event) {
    if (typeof eventType !== 'string' || !eventType) {
      throw new Error('Event type must be a non-empty string');
    }

    // Validate event if enabled
    if (validateEvents && eventSchema) {
      const validationResult = validateEvent(event);
      if (!validationResult.valid) {
        throw new Error(`Event validation failed: ${validationResult.errors.join(', ')}`);
      }
    }

    // Get subscribers for this event type
    const subscribers = state.subscribers.get(eventType);
    if (subscribers) {
      // Call each subscriber
      for (const [subId, callback] of subscribers.entries()) {
        try {
          callback(event);
        } catch (error) {
          // Subscriber error should not break other subscribers
          console.error(`Error in subscriber ${subId}:`, error);
        }
      }
    }

    // Update statistics
    if (enableStats) {
      state.stats.totalEventsPublished++;
    }
  }

  // ==================== Event Subscription ====================

  /**
   * Subscribe to events of a specific type
   * @param {string} eventType - Type of events to subscribe to
   * @param {Function} callback - Callback function to handle events
   * @returns {string} Subscription ID for unsubscribe
   * @throws {Error} If max listeners exceeded
   */
  function subscribe(eventType, callback) {
    if (typeof eventType !== 'string' || !eventType) {
      throw new Error('Event type must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Initialize subscribers map for this event type if needed
    if (!state.subscribers.has(eventType)) {
      state.subscribers.set(eventType, new Map());
    }

    const subscribers = state.subscribers.get(eventType);

    // Check max listeners limit
    if (subscribers.size >= maxListeners) {
      throw new Error(`max listeners (${maxListeners}) exceeded for event type: ${eventType}`);
    }

    // Generate unique subscription ID
    const subId = `${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add subscriber
    subscribers.set(subId, callback);

    // Update statistics
    if (enableStats) {
      state.stats.totalSubscribers++;
      state.stats.eventTypes.set(eventType, (state.stats.eventTypes.get(eventType) || 0) + 1);
    }

    return subId;
  }

  // ==================== Event Unsubscription ====================

  /**
   * Unsubscribe from events
   * @param {string} subscriptionId - Subscription ID to remove
   */
  function unsubscribe(subscriptionId) {
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return; // Silently ignore invalid subscription IDs
    }

    // Find and remove the subscription
    for (const [eventType, subscribers] of state.subscribers.entries()) {
      if (subscribers.has(subscriptionId)) {
        subscribers.delete(subscriptionId);
        
        // Update statistics
        if (enableStats) {
          state.stats.totalSubscribers--;
          const count = state.stats.eventTypes.get(eventType) || 0;
          if (count > 0) {
            state.stats.eventTypes.set(eventType, count - 1);
          }
        }

        // Clean up empty subscriber maps
        if (subscribers.size === 0) {
          state.subscribers.delete(eventType);
        }
        
        return;
      }
    }
  }

  // ==================== Event Validation ====================

  /**
   * Validate an event against the schema
   * @param {Object} event - Event to validate
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  function validateEvent(event) {
    if (!validateEvents || !eventSchema) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    // Reject null or undefined events
    if (event === null || event === undefined) {
      errors.push('Event cannot be null or undefined');
      return { valid: false, errors };
    }

    // Check required fields from schema.required array (JSON Schema format)
    if (eventSchema.required && Array.isArray(eventSchema.required)) {
      for (const fieldName of eventSchema.required) {
        if (event[fieldName] === undefined || event[fieldName] === null) {
          errors.push(`Missing required field: ${fieldName}`);
        }
      }
    }

    // Check field types and property-level required flags
    if (eventSchema.properties) {
      for (const [fieldName, fieldDef] of Object.entries(eventSchema.properties)) {
        // Check property-level required flag (for backward compatibility with test schema)
        if (fieldDef.required && (event[fieldName] === undefined || event[fieldName] === null)) {
          errors.push(`Missing required field: ${fieldName}`);
        }
        
        // Check field types
        if (event[fieldName] !== undefined && event[fieldName] !== null) {
          const actualType = typeof event[fieldName];
          const expectedType = fieldDef.type;
          
          if (expectedType && actualType !== expectedType) {
            // Special case for arrays
            if (expectedType === 'array' && Array.isArray(event[fieldName])) {
              continue;
            }
            errors.push(`Field ${fieldName} has wrong type: expected ${expectedType}, got ${actualType}`);
          }
        }
      }
    }

    // Check for prototype pollution attempts (only for direct property access)
    if (event && typeof event === 'object' && !Array.isArray(event)) {
      const dangerousKeys = ['__proto__', 'constructor.prototype'];
      for (const key of dangerousKeys) {
        if (Object.prototype.hasOwnProperty.call(event, key)) {
          errors.push(`Security: Event contains dangerous key: ${key}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Schema Validation ====================

  /**
   * Validate the event schema
   * @param {Object} schema - Schema to validate
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  function validateSchema(schema) {
    const errors = [];

    if (!schema || typeof schema !== 'object') {
      errors.push('Schema must be an object');
      return { valid: false, errors };
    }

    if (schema.type && schema.type !== 'object') {
      errors.push('Schema type must be "object"');
    }

    if (schema.properties && typeof schema.properties !== 'object') {
      errors.push('Schema properties must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ==================== Statistics ====================

  /**
   * Get protocol statistics
   * @returns {Object} Statistics object
   */
  function getStats() {
    if (!enableStats) {
      return { statsEnabled: false };
    }

    return {
      totalEventsPublished: state.stats.totalEventsPublished,
      totalSubscribers: state.stats.totalSubscribers,
      eventTypes: Object.fromEntries(state.stats.eventTypes.entries()),
      maxListeners,
      validateEvents,
      statsEnabled: true
    };
  }

  // ==================== Return Frozen Protocol Instance ====================

  return Object.freeze({
    publish,
    subscribe,
    unsubscribe,
    validateEvent,
    validateSchema,
    getStats
  });
}

// ==================== Exports ====================

export {
  createEventProtocol
};