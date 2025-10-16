/**
 * FormFieldExtractor - Extracts field information from HTML forms
 *
 * Features:
 * - 7 different label detection methods
 * - Support for HubSpot forms, fieldsets, aria-labels
 * - Returns structured field data (name, type, label, element)
 *
 * @module FormFieldExtractor
 */

export class FormFieldExtractor {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
  }

  /**
   * Extract all fields from a form
   * @param {HTMLFormElement} form - The form to extract fields from
   * @returns {Array} Array of field objects with {element, name, type, label}
   */
  extractFields(form) {
    const fields = [];
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      // Skip hidden, submit, and button fields
      if (['hidden', 'submit', 'button'].includes(input.type)) {
        return;
      }

      const label = this._findLabel(input, form);
      const cleanLabel = this._cleanLabel(label);

      fields.push({
        element: input,
        name: input.name || input.id,
        type: input.type,
        label: cleanLabel
      });
    });

    return fields;
  }

  // ========================================
  // PRIVATE METHODS - Label Detection
  // ========================================

  /**
   * Find label for an input using 7 different methods
   * @private
   * @param {HTMLElement} input - The input element
   * @param {HTMLFormElement} form - The parent form
   * @returns {string} The label text
   */
  _findLabel(input, form) {
    let label = '';

    // Method 1: Find label by 'for' attribute
    label = label || this._findLabelByForAttribute(input, form);

    // Method 2: Check aria-labelledby
    label = label || this._findLabelByAriaLabelledBy(input);

    // Method 3: Check if input is inside a label
    label = label || this._findLabelAsParent(input);

    // Method 4: Look for nearby label (sibling)
    label = label || this._findLabelAsSibling(input);

    // Method 5: Look for legend (for fieldsets)
    label = label || this._findLabelInFieldset(input);

    // Method 6: HubSpot specific wrappers
    label = label || this._findLabelInHubSpotWrapper(input);

    // Method 7: Look in parent containers
    label = label || this._findLabelInParentContainers(input);

    // Fallback to placeholder, aria-label, name, or id
    label = label || input.placeholder || input.getAttribute('aria-label') || input.name || input.id;

    return label;
  }

  /**
   * Method 1: Find label by 'for' attribute
   * @private
   */
  _findLabelByForAttribute(input, form) {
    if (input.id) {
      const labelElement = form.querySelector(`label[for="${input.id}"]`);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }
    return '';
  }

  /**
   * Method 2: Check aria-labelledby
   * @private
   */
  _findLabelByAriaLabelledBy(input) {
    const labelId = input.getAttribute('aria-labelledby');
    if (labelId) {
      const labelElement = document.getElementById(labelId);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }
    return '';
  }

  /**
   * Method 3: Check if input is inside a label
   * @private
   */
  _findLabelAsParent(input) {
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      // Remove inputs from clone to get clean text
      const inputsInClone = clone.querySelectorAll('input, select, textarea');
      inputsInClone.forEach(inp => inp.remove());
      return clone.textContent.trim();
    }
    return '';
  }

  /**
   * Method 4: Look for nearby label (sibling)
   * @private
   */
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

  /**
   * Method 5: Look for legend (for fieldsets)
   * @private
   */
  _findLabelInFieldset(input) {
    const fieldset = input.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        return legend.textContent.trim();
      }
    }
    return '';
  }

  /**
   * Method 6: HubSpot specific wrappers
   * @private
   */
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

  /**
   * Method 7: Look in parent containers (up to 3 levels)
   * @private
   */
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

          if (text.length > label.length) {
            label = text;
          }
        }
      }

      parent = parent.parentElement;
      depth++;
    }

    return label;
  }

  /**
   * Clean up label text
   * @private
   * @param {string} label - The raw label text
   * @returns {string} Cleaned label
   */
  _cleanLabel(label) {
    return label.replace(/\s+/g, ' ').trim();
  }
}
