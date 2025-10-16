/**
 * UIManager - Manages the AI fill button and UI updates
 *
 * Features:
 * - Create and position floating button
 * - Real-time button text and style updates
 * - Button state management (idle, working, success, error)
 * - Auto-reset after completion
 *
 * @module UIManager
 */

export class UIManager {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.buttonClass = config.buttonClass || 'ai-fill-button';
    this.onClick = config.onClick || (() => {});
    this.button = null;
    this.originalText = '🤖 Fyll formulär med AI';
  }

  /**
   * Create and inject button into page
   * @param {number} formCount - Number of forms detected
   */
  createButton(formCount = 1) {
    console.log(`[UIManager] Creating button for ${formCount} forms`);

    // Remove old button
    this.removeButton();

    if (formCount === 0) {
      console.log('[UIManager] No forms - not creating button');
      return;
    }

    // Create button
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

    console.log('[UIManager] ✓ Button created and added to page');
  }

  /**
   * Remove button from page
   */
  removeButton() {
    const oldButton = document.querySelector(`.${this.buttonClass}`);
    if (oldButton) {
      console.log('[UIManager] Removing old button');
      oldButton.remove();
    }
    this.button = null;
  }

  /**
   * Update button text and optionally background
   * @param {string} text - New button text
   * @param {string} background - Optional background CSS value
   */
  updateButton(text, background = null) {
    const btn = document.querySelector(`.${this.buttonClass}`);
    if (btn) {
      btn.textContent = text;
      if (background) {
        btn.style.background = background;
      }
    }
  }

  /**
   * Set button to working state
   */
  setWorking() {
    this.updateButton('⏳ Arbetar...');
    this._setDisabled(true);
  }

  /**
   * Set button to analyzing state
   */
  setAnalyzing() {
    this.updateButton('⏳ Analyserar formulär...');
  }

  /**
   * Set button to progress state with percentage
   * @param {number} percentage - Progress percentage (0-100)
   * @param {number} completed - Number of completed fields
   * @param {number} total - Total number of fields
   */
  setProgress(percentage, completed, total) {
    this.updateButton(`⏳ ${percentage}% (${completed}/${total} fält)`);
  }

  /**
   * Set button to success state
   * @param {number} filled - Number of successfully filled fields
   * @param {number} failed - Number of failed fields
   * @param {number} autoResetDelay - Delay before auto-reset (ms), default 3000
   */
  setSuccess(filled, failed, autoResetDelay = 3000) {
    this.updateButton(`✓ Klart! ${filled} fyllda, ${failed} misslyckades`, '#4CAF50');
    this._setDisabled(false);

    // Auto-reset after delay
    setTimeout(() => {
      this.reset();
    }, autoResetDelay);
  }

  /**
   * Set button to error state
   * @param {string} message - Error message
   * @param {number} autoResetDelay - Delay before auto-reset (ms), default 5000
   */
  setError(message = '❌ Fel', autoResetDelay = 5000) {
    this.updateButton(message, '#f44336');
    this._setDisabled(false);

    // Auto-reset after delay
    setTimeout(() => {
      this.reset();
    }, autoResetDelay);
  }

  /**
   * Set button to reload state (for extension context errors)
   */
  setReload() {
    this.updateButton('🔄 Ladda om sidan', '#FF9800');
  }

  /**
   * Reset button to original state
   */
  reset() {
    this.updateButton(this.originalText, 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
    this._setDisabled(false);
  }

  /**
   * Get button element
   * @returns {HTMLElement|null} The button element or null
   */
  getButton() {
    return document.querySelector(`.${this.buttonClass}`);
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Set button disabled state
   * @private
   */
  _setDisabled(disabled) {
    const btn = this.getButton();
    if (btn) {
      btn.disabled = disabled;
    }
  }
}
