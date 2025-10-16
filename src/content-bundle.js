/**
 * AI Form Filler - Content Script Bundle
 * This file bundles all modules into a single file for Chrome Extension compatibility
 */

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  version: '2.0.0',
  formDetection: {
    scanDelays: [2000, 4000, 6000, 8000, 10000, 15000, 20000],
    minFieldsForRealForm: 2,
    minFieldsWithTextarea: 1,
    minFieldsDefinitelyReal: 3
  },
  formFilling: {
    batchSize: 5,
    batchDelay: 200,
    successFlashDuration: 3000
  },
  openai: {
    maxWaitAttempts: 90,
    pollInterval: 1000,
    singleFieldTimeout: 30
  },
  ui: {
    buttonClass: 'ai-fill-button',
    buttonText: '🤖 Fyll formulär med AI',
    successResetDelay: 3000,
    errorResetDelay: 5000,
    position: { bottom: '20px', right: '20px' },
    zIndex: 2147483647
  },
  chrome: {
    messageTimeout: 60000
  },
  logging: {
    verbose: true,
    prefix: '🚀 AI Form Filler'
  }
};

// ============================================
// CHROME API BRIDGE
// ============================================
class ChromeAPIBridge {
  constructor() {
    this.version = '1.0.0';
  }

  async sendMessage(message, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          // Check for errors
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message;
            console.error('[ChromeAPIBridge] Runtime error:', error);

            // Suppress the specific "message channel closed" error from being thrown
            if (error.includes('message channel closed') ||
                error.includes('message port closed')) {
              console.warn('[ChromeAPIBridge] Message channel closed - this is usually harmless');
              // Resolve with error response instead of rejecting
              resolve({
                success: false,
                error: 'Message channel closed'
              });
            } else {
              reject(new Error(error));
            }
            return;
          }

          // Successful response
          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('[ChromeAPIBridge] Send error:', error);
        reject(error);
      }
    });
  }

  isContextInvalidated(error) {
    return error.message && error.message.includes('Extension context invalidated');
  }
}

// ============================================
// FORM DETECTOR
// ============================================
class FormDetector {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.isTopFrame = window === window.top;
    this.formsRegistry = [];
    console.log(`🔍 FormDetector v${this.version} initialized`);
  }

  initialize() {
    // No automatic scanning - we only search when user clicks the button
    console.log('[FormDetector] Initialized - will search on demand only');
  }

  findForms() {
    console.log('[FormDetector] Searching for forms...');
    let forms = Array.from(document.querySelectorAll('form'));

    if (this.isTopFrame) {
      forms = this._findFormsInHubSpotIframes(forms);
    }

    const beforeFilter = forms.length;
    forms = this._filterSmallForms(forms);

    if (beforeFilter !== forms.length) {
      console.log(`[FormDetector] Filtered out ${beforeFilter - forms.length} small forms`);
    }

    console.log(`[FormDetector] Found ${forms.length} relevant forms`);
    this.formsRegistry = forms;

    return forms;
  }

  getForms() {
    return this.formsRegistry;
  }

  _findFormsInHubSpotIframes(forms) {
    const hsIframes = document.querySelectorAll('iframe[id*="hs-form"], iframe[class*="hs-form"]');
    hsIframes.forEach((iframe) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeForms = Array.from(iframeDoc.querySelectorAll('form'));
          if (iframeForms.length > 0) {
            forms.push(...iframeForms);
          }
        }
      } catch (e) {
        // CORS blocked
      }
    });
    return forms;
  }

  _filterSmallForms(forms) {
    return forms.filter(form => {
      const inputs = form.querySelectorAll('input:not([type="hidden"]), select:not([type="hidden"]), textarea');
      if (inputs.length >= 3) return true;
      if (inputs.length >= 1 && form.querySelector('textarea')) return true;
      return inputs.length >= 2;
    });
  }

  _notifyParent(count) {
    window.parent.postMessage({
      type: 'AI_FORM_FILLER_FORMS_DETECTED',
      count: count
    }, '*');
  }
}

// ============================================
// FORM FIELD EXTRACTOR
// ============================================
class FormFieldExtractor {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
  }

  extractFields(form) {
    const fields = [];
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      // Skip hidden, submit, button inputs
      if (['hidden', 'submit', 'button'].includes(input.type)) return;

      // Skip reCAPTCHA and other CAPTCHA fields
      const fieldName = input.name || input.id || '';
      if (fieldName.includes('recaptcha') ||
          fieldName.includes('captcha') ||
          fieldName.includes('g-recaptcha')) {
        console.log(`[FormFieldExtractor] Skipping CAPTCHA field: ${fieldName}`);
        return;
      }

      const label = this._findLabel(input, form);
      const cleanLabel = this._cleanLabel(label);
      fields.push({
        element: input,
        name: fieldName,
        type: input.type,
        label: cleanLabel
      });
    });
    return fields;
  }

  _findLabel(input, form) {
    let label = '';
    label = label || this._findLabelByForAttribute(input, form);
    label = label || this._findLabelByAriaLabelledBy(input);
    label = label || this._findLabelAsParent(input);
    label = label || this._findLabelAsSibling(input);
    label = label || this._findLabelInFieldset(input);
    label = label || this._findLabelInHubSpotWrapper(input);
    label = label || this._findLabelInParentContainers(input);
    label = label || input.placeholder || input.getAttribute('aria-label') || input.name || input.id;
    return label;
  }

  _findLabelByForAttribute(input, form) {
    if (input.id) {
      const labelElement = form.querySelector(`label[for="${input.id}"]`);
      if (labelElement) return labelElement.textContent.trim();
    }
    return '';
  }

  _findLabelByAriaLabelledBy(input) {
    const labelId = input.getAttribute('aria-labelledby');
    if (labelId) {
      const labelElement = document.getElementById(labelId);
      if (labelElement) return labelElement.textContent.trim();
    }
    return '';
  }

  _findLabelAsParent(input) {
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      const inputsInClone = clone.querySelectorAll('input, select, textarea');
      inputsInClone.forEach(inp => inp.remove());
      return clone.textContent.trim();
    }
    return '';
  }

  _findLabelAsSibling(input) {
    const previousElement = input.previousElementSibling;
    if (previousElement && previousElement.tagName === 'LABEL') {
      return previousElement.textContent.trim();
    }
    if (input.parentElement) {
      const parentPrevious = input.parentElement.previousElementSibling;
      if (parentPrevious && parentPrevious.tagName === 'LABEL') {
        return parentPrevious.textContent.trim();
      }
    }
    return '';
  }

  _findLabelInFieldset(input) {
    const fieldset = input.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) return legend.textContent.trim();
    }
    return '';
  }

  _findLabelInHubSpotWrapper(input) {
    const wrapper = input.closest('.hs-form-field, .field, .form-group');
    if (wrapper) {
      const wrapperLabel = wrapper.querySelector('label, .hs-form-field-label, .field-label');
      if (wrapperLabel) {
        const clone = wrapperLabel.cloneNode(true);
        const inputsInClone = clone.querySelectorAll('input, select, textarea');
        inputsInClone.forEach(inp => inp.remove());
        return clone.textContent.trim();
      }
    }
    return '';
  }

  _findLabelInParentContainers(input) {
    let label = '';
    let parent = input.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      const textElements = parent.querySelectorAll(':scope > label, :scope > span, :scope > div');
      for (const elem of textElements) {
        if (elem !== input && elem.textContent && elem.textContent.length > 5) {
          const clone = elem.cloneNode(true);
          const inputsInClone = clone.querySelectorAll('input, select, textarea');
          inputsInClone.forEach(inp => inp.remove());
          const text = clone.textContent.trim();
          if (text.length > label.length) label = text;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    return label;
  }

  _cleanLabel(label) {
    return label.replace(/\s+/g, ' ').trim();
  }
}

// ============================================
// FORM FILLER
// ============================================
class FormFiller {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.batchSize = config.batchSize || 5;
    this.onProgress = config.onProgress || (() => {});
    this.onComplete = config.onComplete || (() => {});
    this.onError = config.onError || (() => {});
    this.apiClient = config.apiClient;
  }

  async fillFields(forms, fields) {
    let filled = 0;
    let failed = 0;
    const totalFields = fields.length;

    for (let batchStart = 0; batchStart < totalFields; batchStart += this.batchSize) {
      const batch = fields.slice(batchStart, batchStart + this.batchSize);
      const batchPromises = batch.map(async (field, idx) => {
        const globalIdx = batchStart + idx;
        try {
          const response = await this.apiClient.fillSingleField({
            name: field.name,
            type: field.type,
            label: field.label,
            url: window.location.href
          });

          if (response && response.success && response.value !== null && response.value !== undefined) {
            console.log(`[FormFiller] ✅ [${globalIdx+1}/${totalFields}] Success: ${field.name} = "${response.value}"`);
            await this._fillField(field, response.value, globalIdx, totalFields);
            return { success: true, field };
          } else {
            console.warn(`[FormFiller] ⚠️ [${globalIdx+1}/${totalFields}] No value: ${field.name} (${field.label})`, {
              response: response,
              hasResponse: !!response,
              hasSuccess: response?.success,
              value: response?.value
            });
            return { success: false, field, reason: 'no_value' };
          }
        } catch (error) {
          console.error(`[FormFiller] ❌ [${globalIdx+1}/${totalFields}] Error: ${field.name}`, error);
          return { success: false, field, error, reason: 'exception' };
        }
      });

      const results = await Promise.all(batchPromises);

      // Update counters and progress after each field completes
      results.forEach(result => {
        if (result.success) {
          filled++;
        } else {
          failed++;
        }

        // Update progress after each field
        const completed = filled + failed;
        const percentage = Math.round((completed / totalFields) * 100);
        this.onProgress({
          percentage,
          completed,
          filled,
          failed,
          total: totalFields,
          field: result.field.name
        });
      });

      if (batchStart + this.batchSize < totalFields) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const result = { filled, failed, total: totalFields };
    this.onComplete(result);
    return result;
  }

  async _fillField(field, value, idx, total) {
    let valueToFill = value;
    if (field.element.type === 'checkbox') {
      field.element.checked = value === true || value === 'true';
    } else if (field.element.type === 'number') {
      const numberMatch = String(valueToFill).match(/\d+/);
      if (numberMatch) {
        valueToFill = numberMatch[0];
      }
      field.element.value = valueToFill;
    } else {
      field.element.value = valueToFill;
    }
    field.element.dispatchEvent(new Event('input', { bubbles: true }));
    field.element.dispatchEvent(new Event('change', { bubbles: true }));
    field.element.style.background = '#e8f5e9';
    setTimeout(() => { field.element.style.background = ''; }, 3000);
  }
}

// ============================================
// UI MANAGER
// ============================================
class UIManager {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.buttonClass = config.buttonClass || 'ai-fill-button';
    this.onClick = config.onClick || (() => {});
    this.button = null;
    this.originalText = '🤖 Fyll formulär med AI';
  }

  createButton() {
    // Check if button already exists
    const existingButton = document.querySelector(`.${this.buttonClass}`);
    if (existingButton) {
      console.log('[UIManager] Button already exists - skipping creation');
      return;
    }

    console.log('[UIManager] Creating button');
    this.button = document.createElement('button');
    this.button.className = this.buttonClass;
    this.button.textContent = this.originalText;
    this.button.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      padding: 15px 25px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      border: none !important;
      border-radius: 12px !important;
      cursor: pointer !important;
      font-weight: bold !important;
      font-size: 16px !important;
      font-family: Arial, sans-serif !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
    `;
    this.button.onclick = () => this.onClick();
    document.body.appendChild(this.button);
    console.log('[UIManager] Button created and added to DOM');
  }

  removeButton() {
    const oldButton = document.querySelector(`.${this.buttonClass}`);
    if (oldButton) {
      console.log('[UIManager] Removing old button');
      oldButton.remove();
    }
    this.button = null;
  }

  updateButton(text, background = null) {
    const btn = document.querySelector(`.${this.buttonClass}`);
    if (btn) {
      console.log(`[UIManager] Button update: "${text}"${background ? ` (bg: ${background})` : ''}`);
      btn.textContent = text;
      if (background) btn.style.background = background;
    } else {
      console.warn('[UIManager] Button not found when trying to update');
    }
  }

  setWorking() {
    this.updateButton('⏳ Arbetar...');
    this._setDisabled(true);
  }

  setAnalyzing() {
    this.updateButton('⏳ Analyserar formulär...');
    this._setDisabled(true);
  }

  setProgress(percentage, completed, total, filled, failed) {
    // Show "X fyllda av Y fält" instead of just completed/total
    this.updateButton(`⏳ ${filled} fyllda av ${total} fält (${percentage}%)`);
    this._setDisabled(true);
  }

  setSuccess(filled, failed, autoResetDelay = 3000) {
    this.updateButton(`✓ Klart! ${filled} fyllda, ${failed} misslyckades`, '#4CAF50');
    this._setDisabled(false);
    setTimeout(() => this.reset(), autoResetDelay);
  }

  setError(message = '❌ Fel', autoResetDelay = 5000) {
    this.updateButton(message, '#f44336');
    this._setDisabled(false);
    setTimeout(() => this.reset(), autoResetDelay);
  }

  setReload() {
    this.updateButton('🔄 Ladda om sidan', '#FF9800');
  }

  reset() {
    this.updateButton(this.originalText, 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
    this._setDisabled(false);
  }

  getButton() {
    return document.querySelector(`.${this.buttonClass}`);
  }

  _setDisabled(disabled) {
    const btn = this.getButton();
    if (btn) btn.disabled = disabled;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================
const chromeBridge = new ChromeAPIBridge();

class ContentScriptAPIClient {
  async fillSingleField(fieldData) {
    return await chromeBridge.sendMessage({
      type: 'FILL_SINGLE_FIELD',
      fieldData: fieldData
    }, CONFIG.chrome.messageTimeout);
  }
}

const apiClient = new ContentScriptAPIClient();
const detector = new FormDetector({ version: CONFIG.version });
const extractor = new FormFieldExtractor({ version: CONFIG.version });
const uiManager = new UIManager({
  version: CONFIG.version,
  buttonClass: CONFIG.ui.buttonClass,
  onClick: handleButtonClick
});

const filler = new FormFiller({
  version: CONFIG.version,
  batchSize: CONFIG.formFilling.batchSize,
  apiClient: apiClient,
  onProgress: (progress) => {
    uiManager.setProgress(progress.percentage, progress.completed, progress.total, progress.filled, progress.failed);
  },
  onComplete: (result) => {
    uiManager.setSuccess(result.filled, result.failed);
  }
});

async function handleButtonClick() {
  try {
    uiManager.setWorking();

    // Search for forms when button is clicked
    const forms = detector.findForms();

    if (forms.length === 0) {
      console.log('[Content] No forms found');
      uiManager.setError('❌ Inga formulär hittades');
      return;
    }

    uiManager.setAnalyzing();
    const allFields = [];
    forms.forEach(form => {
      const formFields = extractor.extractFields(form);
      formFields.forEach(field => {
        field.formElement = form;
        allFields.push(field);
      });
    });
    await filler.fillFields(forms, allFields);
  } catch (error) {
    console.error('[Content] Error:', error);
    if (chromeBridge.isContextInvalidated(error)) {
      uiManager.setReload();
    } else {
      uiManager.setError('❌ Fel');
    }
  }
}

// Initialize
console.log(`${CONFIG.logging.prefix} v${CONFIG.version} loaded`);
console.log(`  URL: ${window.location.href}`);
console.log(`  Frame: ${window === window.top ? 'top' : 'iframe'}`);

// Only create button in top frame (not in iframes like reCAPTCHA)
detector.initialize();
if (window === window.top) {
  uiManager.createButton();
} else {
  console.log('[Content] Skipping button creation in iframe');
}
