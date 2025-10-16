/**
 * FormFiller - Fills form fields with AI-generated values
 *
 * Features:
 * - Parallel batch processing (5 concurrent fields)
 * - Real-time progress updates
 * - Type-specific field handling (checkbox, number, text, etc.)
 * - Visual feedback (green flash on success)
 * - Event dispatching for SPA compatibility
 *
 * @module FormFiller
 */

export class FormFiller {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.batchSize = config.batchSize || 5;
    this.onProgress = config.onProgress || (() => {});
    this.onComplete = config.onComplete || (() => {});
    this.onError = config.onError || (() => {});
    this.apiClient = config.apiClient; // Must be provided
  }

  /**
   * Fill all fields in provided forms
   * @param {Array} forms - Array of form elements
   * @param {Array} fields - Array of field objects from FormFieldExtractor
   * @returns {Promise<Object>} Result with {filled, failed, total}
   */
  async fillFields(forms, fields) {
    console.log(`📊 FormFiller: Processing ${fields.length} fields in ${this.batchSize} parallel batches`);

    let filled = 0;
    let failed = 0;
    const totalFields = fields.length;

    // Process fields in batches
    for (let batchStart = 0; batchStart < totalFields; batchStart += this.batchSize) {
      const batch = fields.slice(batchStart, batchStart + this.batchSize);
      const batchNum = Math.floor(batchStart / this.batchSize) + 1;
      const totalBatches = Math.ceil(totalFields / this.batchSize);

      console.log(`\n🔄 Batch ${batchNum}/${totalBatches}: ${batch.map(f => f.label).join(', ')}`);

      // Process all fields in batch concurrently
      const batchPromises = batch.map(async (field, idx) => {
        const globalIdx = batchStart + idx;

        try {
          console.log(`[${globalIdx + 1}/${totalFields}] Starting: ${field.name} (${field.label})`);

          // Call API to get value for this field
          const response = await this.apiClient.fillSingleField({
            name: field.name,
            type: field.type,
            label: field.label,
            url: window.location.href
          });

          // Fill the field with response
          if (response && response.success && response.value !== null && response.value !== undefined) {
            await this._fillField(field, response.value, globalIdx, totalFields);

            // Notify progress
            const completed = filled + failed + 1;
            const percentage = Math.round((completed / totalFields) * 100);
            this.onProgress({
              percentage,
              completed,
              total: totalFields,
              field: field.name
            });

            return { success: true, field };
          } else {
            console.log(`  ⚠️ [${globalIdx + 1}/${totalFields}] No value for ${field.name}`);

            // Notify progress even on skip
            const completed = filled + failed + 1;
            const percentage = Math.round((completed / totalFields) * 100);
            this.onProgress({
              percentage,
              completed,
              total: totalFields,
              field: field.name
            });

            return { success: false, field };
          }
        } catch (error) {
          console.error(`  ❌ [${globalIdx + 1}/${totalFields}] Failed ${field.name}:`, error.message);

          // Notify progress even on error
          const completed = filled + failed + 1;
          const percentage = Math.round((completed / totalFields) * 100);
          this.onProgress({
            percentage,
            completed,
            total: totalFields,
            field: field.name
          });

          return { success: false, field, error };
        }
      });

      // Wait for batch to complete
      const results = await Promise.all(batchPromises);

      // Count successes and failures
      results.forEach(result => {
        if (result.success) {
          filled++;
        } else {
          failed++;
        }
      });

      console.log(`✓ Batch ${batchNum} complete: ${results.filter(r => r.success).length}/${batch.length} succeeded`);

      // Small delay between batches
      if (batchStart + this.batchSize < totalFields) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const result = { filled, failed, total: totalFields };
    this.onComplete(result);
    return result;
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Fill a single field with type-specific handling
   * @private
   * @param {Object} field - Field object with element, name, type, label
   * @param {*} value - Value to fill
   * @param {number} idx - Field index (for logging)
   * @param {number} total - Total fields (for logging)
   */
  async _fillField(field, value, idx, total) {
    let valueToFill = value;

    // Type-specific handling
    if (field.element.type === 'checkbox') {
      field.element.checked = value === true || value === 'true';
    } else if (field.element.type === 'number') {
      // Extract first number from strings like "1–4" -> "1"
      const numberMatch = String(valueToFill).match(/\d+/);
      if (numberMatch) {
        valueToFill = numberMatch[0];
        console.log(`  🔢 [${idx + 1}] Converted "${value}" -> "${valueToFill}" for number field`);
      }
      field.element.value = valueToFill;
    } else {
      field.element.value = valueToFill;
    }

    // Dispatch events for SPA compatibility
    field.element.dispatchEvent(new Event('input', { bubbles: true }));
    field.element.dispatchEvent(new Event('change', { bubbles: true }));

    // Visual feedback (green flash)
    field.element.style.background = '#e8f5e9';
    setTimeout(() => {
      field.element.style.background = '';
    }, 3000);

    console.log(`  ✅ [${idx + 1}/${total}] Filled ${field.name} with: ${valueToFill}`);
  }
}
