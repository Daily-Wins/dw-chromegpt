/**
 * ChromeAPIBridge - Abstracts Chrome Extension API for easier testing and portability
 *
 * Features:
 * - Message passing wrapper
 * - Storage API wrapper
 * - Runtime error handling
 *
 * @module ChromeAPIBridge
 */

export class ChromeAPIBridge {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * Send message to background script
   * @param {Object} message - Message object
   * @param {number} timeout - Timeout in ms (default 60000)
   * @returns {Promise<Object>} Response from background
   */
  async sendMessage(message, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Get data from chrome.storage.local
   * @param {Array|string} keys - Keys to retrieve
   * @returns {Promise<Object>} Storage data
   */
  async getStorage(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Set data in chrome.storage.local
   * @param {Object} data - Data to store
   * @returns {Promise<void>}
   */
  async setStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if context is invalidated (extension reloaded)
   * @param {Error} error - Error to check
   * @returns {boolean} True if context invalidated
   */
  isContextInvalidated(error) {
    return error.message && error.message.includes('Extension context invalidated');
  }
}
