/**
 * AI Form Filler - Content Script (Modular Architecture)
 *
 * This is the main entry point for the content script.
 * All functionality is componentized for easy reuse and testing.
 */

import { CONFIG } from './config.js';
import { FormDetector } from './core/FormDetector.js';
import { FormFieldExtractor } from './core/FormFieldExtractor.js';
import { FormFiller } from './core/FormFiller.js';
import { UIManager } from './ui/UIManager.js';
import { ChromeAPIBridge } from './utils/ChromeAPIBridge.js';

// Initialize components
const detector = new FormDetector({
  version: CONFIG.version,
  onFormsDetected: (forms) => {
    uiManager.createButton(forms.length);
  }
});

const extractor = new FormFieldExtractor({ version: CONFIG.version });
const uiManager = new UIManager({
  version: CONFIG.version,
  buttonClass: CONFIG.ui.buttonClass,
  onClick: handleButtonClick
});
const chromeBridge = new ChromeAPIBridge();

// API Client wrapper for content script
class ContentScriptAPIClient {
  async fillSingleField(fieldData) {
    return await chromeBridge.sendMessage({
      type: 'FILL_SINGLE_FIELD',
      fieldData: fieldData
    }, CONFIG.chrome.messageTimeout);
  }
}

const apiClient = new ContentScriptAPIClient();
const filler = new FormFiller({
  version: CONFIG.version,
  batchSize: CONFIG.formFilling.batchSize,
  apiClient: apiClient,
  onProgress: (progress) => {
    uiManager.setProgress(progress.percentage, progress.completed, progress.total);
  },
  onComplete: (result) => {
    uiManager.setSuccess(result.filled, result.failed);
  },
  onError: (error) => {
    console.error('FormFiller error:', error);
  }
});

/**
 * Handle button click - main entry point for form filling
 */
async function handleButtonClick() {
  console.log(`[Content v${CONFIG.version}] Button clicked`);

  try {
    uiManager.setWorking();

    // Get detected forms
    const forms = detector.getForms();

    if (forms.length === 0) {
      console.log('[Content] No forms in current frame, trying iframes...');
      sendToIframes();
      uiManager.setSuccess(0, 0);
      return;
    }

    uiManager.setAnalyzing();

    // Extract all fields from all forms
    const allFields = [];
    forms.forEach(form => {
      const formFields = extractor.extractFields(form);
      formFields.forEach(field => {
        field.formElement = form;
        allFields.push(field);
      });
    });

    console.log(`[Content] Extracted ${allFields.length} fields from ${forms.length} forms`);

    // Fill all fields using FormFiller
    await filler.fillFields(forms, allFields);

  } catch (error) {
    console.error('[Content] Error:', error);

    // Check if extension was reloaded
    if (chromeBridge.isContextInvalidated(error)) {
      uiManager.setReload();
    } else {
      uiManager.setError('❌ Fel');
    }
  }
}

/**
 * Send fill command to iframes
 */
function sendToIframes() {
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      iframe.contentWindow.postMessage({ type: 'AI_FORM_FILLER_FILL_FORMS' }, '*');
    } catch (e) {
      // Ignore CORS errors
    }
  });
}

// Listen for messages from iframes
window.addEventListener('message', async (event) => {
  if (event.data.type === 'AI_FORM_FILLER_FILL_FORMS') {
    const forms = detector.getForms();
    if (forms.length > 0) {
      handleButtonClick();
    }
  }
});

// Initialize
console.log(`${CONFIG.logging.prefix} v${CONFIG.version} loaded`);
console.log(`  URL: ${window.location.href}`);
console.log(`  Frame: ${window === window.top ? 'top' : 'iframe'}`);

detector.initialize();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  detector.destroy();
});
