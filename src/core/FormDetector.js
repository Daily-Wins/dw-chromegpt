/**
 * FormDetector - Detects forms on web pages including iframes and HubSpot forms
 *
 * Features:
 * - Detects standard HTML forms
 * - Detects HubSpot forms (including iframe-embedded)
 * - Filters out small forms (language selectors, etc.)
 * - Supports cross-frame communication
 * - MutationObserver for dynamically loaded forms
 *
 * @module FormDetector
 */

export class FormDetector {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.isTopFrame = window === window.top;
    this.formsRegistry = [];
    this.observer = null;
    this.onFormsDetected = config.onFormsDetected || (() => {});
    this.formsFound = false; // Track if we've found forms yet
    this.scheduledScans = []; // Store timeout IDs so we can cancel them

    console.log(`🔍 FormDetector v${this.version} initialized in ${this.isTopFrame ? 'top frame' : 'iframe'}`);
  }

  /**
   * Initialize form detection
   * Sets up XHR interception, MutationObserver, and periodic checks
   */
  initialize() {
    // Setup HubSpot XHR interception (only in top frame)
    if (this.isTopFrame) {
      this._setupHubSpotInterception();
    }

    // Setup MutationObserver for dynamic forms
    this._setupMutationObserver();

    // Listen for iframe messages
    if (this.isTopFrame) {
      this._setupIframeListener();
    }

    // Initial scan
    this.findForms();

    // Schedule scans at intervals, but stop after forms are found
    const delays = [2000, 4000, 6000, 8000, 10000, 15000, 20000];
    delays.forEach(delay => {
      const timeoutId = setTimeout(() => {
        if (!this.formsFound) {
          this.findForms();
        } else {
          console.log(`[FormDetector] Skipping scheduled scan at ${delay}ms - forms already found`);
        }
      }, delay);
      this.scheduledScans.push(timeoutId);
    });
  }

  /**
   * Find all forms on current page
   * Includes forms in same-origin iframes
   * @returns {Array} Array of form elements
   */
  findForms() {
    console.log(`[FormDetector] Searching for forms...`);
    let forms = Array.from(document.querySelectorAll('form'));
    console.log(`[FormDetector] Found ${forms.length} form elements`);

    // Check HubSpot iframes (same-origin only)
    if (this.isTopFrame) {
      forms = this._findFormsInHubSpotIframes(forms);
    }

    // Filter out small forms (language selectors, etc.)
    const beforeFilter = forms.length;
    forms = this._filterSmallForms(forms);

    if (beforeFilter !== forms.length) {
      console.log(`[FormDetector] Filtered out ${beforeFilter - forms.length} small forms`);
    }

    console.log(`[FormDetector] ✓ ${forms.length} relevant forms found`);

    this.formsRegistry = forms;

    // Notify parent if in iframe
    if (!this.isTopFrame && forms.length > 0) {
      this._notifyParent(forms.length);
    }

    // Trigger callback
    if (forms.length > 0) {
      // Mark that we've found forms - no need for scheduled scans anymore
      if (!this.formsFound) {
        console.log('[FormDetector] Forms found! Stopping scheduled scans.');
        this.formsFound = true;
        this._cancelScheduledScans();
      }
      this.onFormsDetected(forms);
    }

    return forms;
  }

  /**
   * Cancel all scheduled form scans
   * @private
   */
  _cancelScheduledScans() {
    this.scheduledScans.forEach(timeoutId => clearTimeout(timeoutId));
    this.scheduledScans = [];
    console.log('[FormDetector] Cancelled all scheduled scans');
  }

  /**
   * Get all detected forms
   * @returns {Array} Array of form elements
   */
  getForms() {
    return this.formsRegistry;
  }

  /**
   * Destroy the detector (cleanup observers and scheduled scans)
   */
  destroy() {
    // Cancel any scheduled scans
    this._cancelScheduledScans();

    // Disconnect mutation observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Setup XHR interception to detect HubSpot form loading
   * @private
   */
  _setupHubSpotInterception() {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
      const url = args[1];
      if (url && typeof url === 'string' && url.includes('hsforms.com')) {
        this.addEventListener('load', () => {
          setTimeout(() => this.findForms(), 2000);
          setTimeout(() => this.findForms(), 5000);
        }.bind(this));
      }
      return originalXHROpen.apply(this, args);
    }.bind(this);
  }

  /**
   * Setup MutationObserver to detect dynamically added forms
   * @private
   */
  _setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      let foundNewForms = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'FORM') {
            foundNewForms = true;
          } else if (node.nodeType === 1) {
            // Check for HubSpot containers
            if (node.classList && (
              node.classList.contains('hbspt-form') ||
              node.classList.contains('hs-form') ||
              (node.id && node.id.startsWith('hs'))
            )) {
              foundNewForms = true;
            }
            // Check children
            if (node.querySelectorAll) {
              const forms = node.querySelectorAll('form');
              const hsForms = node.querySelectorAll('[class*="hbspt"], [class*="hs-form"], [id^="hs"]');
              if (forms.length > 0 || hsForms.length > 0) {
                foundNewForms = true;
              }
            }
          }
        });
      });

      if (foundNewForms) {
        setTimeout(() => this.findForms(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Setup listener for iframe messages
   * @private
   */
  _setupIframeListener() {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'AI_FORM_FILLER_FORMS_DETECTED') {
        this.onFormsDetected([]); // Notify that forms exist in iframe
      }
    });
  }

  /**
   * Find forms in HubSpot iframes
   * @private
   * @param {Array} forms - Existing forms array
   * @returns {Array} Updated forms array
   */
  _findFormsInHubSpotIframes(forms) {
    const hsIframes = document.querySelectorAll('iframe[id*="hs-form"], iframe[class*="hs-form"]');
    console.log(`[FormDetector] Checking ${hsIframes.length} HubSpot iframes...`);

    hsIframes.forEach((iframe) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeForms = Array.from(iframeDoc.querySelectorAll('form'));
          if (iframeForms.length > 0) {
            console.log(`[FormDetector] ✓ Found ${iframeForms.length} forms in HubSpot iframe`);
            forms.push(...iframeForms);
          }
        }
      } catch (e) {
        console.log(`[FormDetector] ⚠️ Cannot read iframe (CORS blocked):`, e.message);
      }
    });

    return forms;
  }

  /**
   * Filter out small forms (language selectors, etc.)
   * @private
   * @param {Array} forms - Forms to filter
   * @returns {Array} Filtered forms
   */
  _filterSmallForms(forms) {
    return forms.filter(form => {
      const inputs = form.querySelectorAll('input:not([type="hidden"]), select:not([type="hidden"]), textarea');

      // Keep forms with 3+ fields
      if (inputs.length >= 3) return true;

      // Keep forms with textarea (likely real forms)
      if (inputs.length >= 1 && form.querySelector('textarea')) return true;

      // Keep forms with at least 2 fields
      return inputs.length >= 2;
    });
  }

  /**
   * Notify parent window that forms were detected
   * @private
   * @param {number} count - Number of forms detected
   */
  _notifyParent(count) {
    window.parent.postMessage({
      type: 'AI_FORM_FILLER_FORMS_DETECTED',
      count: count
    }, '*');
  }
}
