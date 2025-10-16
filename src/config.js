/**
 * Configuration file for AI Form Filler
 *
 * Centralized configuration for all components
 * Modify these values to customize the extension behavior
 */

export const CONFIG = {
  // Version
  version: '2.0.0',

  // Form Detection
  formDetection: {
    // Delays for periodic form scanning (ms)
    scanDelays: [2000, 4000, 6000, 8000, 10000, 15000, 20000],

    // Minimum fields required to consider a form valid
    minFieldsForRealForm: 2,
    minFieldsWithTextarea: 1,
    minFieldsDefinitelyReal: 3
  },

  // Form Filling
  formFilling: {
    // Number of fields to fill concurrently
    batchSize: 5,

    // Delay between batches (ms)
    batchDelay: 200,

    // Visual feedback duration (green flash) in ms
    successFlashDuration: 3000
  },

  // OpenAI API
  openai: {
    // Maximum attempts to wait for completion
    maxWaitAttempts: 90,

    // Poll interval for checking run status (ms)
    pollInterval: 1000,

    // Timeout for single field requests (attempts)
    singleFieldTimeout: 30
  },

  // UI
  ui: {
    // Button class name
    buttonClass: 'ai-fill-button',

    // Button text
    buttonText: '🤖 Fyll formulär med AI',

    // Auto-reset delays (ms)
    successResetDelay: 3000,
    errorResetDelay: 5000,

    // Button position
    position: {
      bottom: '20px',
      right: '20px'
    },

    // Button z-index (should be very high to appear on top)
    zIndex: 2147483647
  },

  // Chrome Extension
  chrome: {
    // Message timeout (ms)
    messageTimeout: 60000
  },

  // Logging
  logging: {
    // Enable verbose logging
    verbose: true,

    // Log prefix
    prefix: '🚀 AI Form Filler'
  }
};

/**
 * Get configuration value by path
 * @param {string} path - Dot-separated path (e.g., 'formFilling.batchSize')
 * @returns {*} Configuration value
 */
export function getConfig(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], CONFIG);
}

/**
 * Override configuration values
 * Useful for testing or customization
 * @param {Object} overrides - Configuration overrides
 */
export function setConfig(overrides) {
  Object.keys(overrides).forEach(key => {
    if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      CONFIG[key] = { ...CONFIG[key], ...overrides[key] };
    } else {
      CONFIG[key] = overrides[key];
    }
  });
}
