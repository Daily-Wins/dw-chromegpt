/**
 * AI Form Filler - Background Service Worker (Modular Architecture)
 *
 * This is the main entry point for the background service worker.
 * Handles communication with OpenAI Assistant API.
 */

import { CONFIG } from './config.js';
import { OpenAIClient } from './core/OpenAIClient.js';

let openAIClient = null;

/**
 * Initialize OpenAI client with credentials from storage
 */
async function initializeClient() {
  const config = await chrome.storage.local.get(['apiKey', 'assistantId']);

  if (!config.apiKey || !config.assistantId) {
    throw new Error('API key and Assistant ID must be configured in popup');
  }

  if (!openAIClient) {
    openAIClient = new OpenAIClient({
      version: CONFIG.version,
      maxAttempts: CONFIG.openai.maxWaitAttempts
    });
  }

  openAIClient.setCredentials(config.apiKey, config.assistantId);
  return openAIClient;
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`[Background v${CONFIG.version}] Message received:`, request.type);

  if (request.type === 'FILL_SINGLE_FIELD') {
    // Handle async message
    handleFillSingleField(request.fieldData)
      .then(result => {
        console.log('[Background] Success:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Background] Error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Unknown error'
        });
      });
    return true; // Keep channel open for async
  }

  // Legacy support for FILL_FORM (not used in new architecture but kept for compatibility)
  if (request.type === 'FILL_FORM') {
    console.warn('[Background] FILL_FORM is deprecated, use FILL_SINGLE_FIELD instead');
    sendResponse({
      success: false,
      error: 'FILL_FORM is deprecated'
    });
    return false; // Synchronous response, no need to keep channel open
  }

  // Unknown message type - send error response
  console.warn('[Background] Unknown message type:', request.type);
  sendResponse({
    success: false,
    error: `Unknown message type: ${request.type}`
  });
  return false; // Synchronous response
});

/**
 * Handle single field fill request
 */
async function handleFillSingleField(fieldData) {
  console.log(`[Background] 📤 Request for field: "${fieldData.name}" (${fieldData.label})`);

  const client = await initializeClient();
  const result = await client.fillSingleField(fieldData);

  if (result.success && result.value !== null && result.value !== undefined) {
    console.log(`[Background] 📥 Response: "${fieldData.name}" = "${result.value}"`);
  } else if (result.error) {
    console.error(`[Background] 📥 Error for "${fieldData.name}": ${result.error}`);
  } else {
    console.warn(`[Background] 📥 Response: "${fieldData.name}" = null/undefined`, result);
  }

  return result;
}

// Log initialization
console.log(`${CONFIG.logging.prefix} Background v${CONFIG.version} initialized`);
