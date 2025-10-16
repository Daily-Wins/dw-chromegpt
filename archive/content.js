// AI Form Filler - Content Script with Iframe Support
const VERSION = '1.3.2';
const isTopFrame = window === window.top;

console.log(`🚀 AI Form Filler v${VERSION} startad i ${isTopFrame ? 'top frame' : 'iframe'}`);
console.log(`   URL: ${window.location.href}`);

// Watch for HubSpot form loading via XHR (must be early!)
if (isTopFrame) {
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(...args) {
    const url = args[1];
    if (url && typeof url === 'string' && url.includes('hsforms.com')) {
      this.addEventListener('load', function() {
        setTimeout(() => findForms(), 2000);
        setTimeout(() => findForms(), 5000);
      });
    }
    return originalXHROpen.apply(this, args);
  };
}

// Global forms registry
let formsInFrame = [];

function findForms() {
  console.log(`[findForms v${VERSION}] Söker efter formulär...`);
  let forms = Array.from(document.querySelectorAll('form'));
  console.log(`[findForms] Hittade ${forms.length} form-element i main frame`);

  // Also check for forms inside HubSpot iframes (same-origin)
  if (isTopFrame) {
    const hsIframes = document.querySelectorAll('iframe[id*="hs-form"], iframe[class*="hs-form"]');
    console.log(`[findForms] Kollar ${hsIframes.length} HubSpot iframes för formulär...`);
    hsIframes.forEach((iframe) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeForms = Array.from(iframeDoc.querySelectorAll('form'));
          if (iframeForms.length > 0) {
            console.log(`[findForms] ✓ Hittade ${iframeForms.length} formulär i HubSpot iframe`);
            forms.push(...iframeForms);
          }
        }
      } catch (e) {
        console.log(`[findForms] ⚠️ Kunde inte läsa iframe (CORS blockerad):`, e.message);
      }
    });
  }

  // Filter out very small forms (language selector = 1 field, but keep everything else)
  const beforeFilter = forms.length;
  forms = forms.filter(form => {
    const inputs = form.querySelectorAll('input:not([type="hidden"]), select:not([type="hidden"]), textarea');
    // Keep forms with 3+ fields (definitely real forms) OR forms with checkboxes/textareas (likely real forms)
    if (inputs.length >= 3) return true;
    if (inputs.length >= 1 && form.querySelector('textarea')) return true;
    return inputs.length >= 2; // At least 2 fields
  });

  if (beforeFilter !== forms.length) {
    console.log(`[findForms] Filtrerade bort ${beforeFilter - forms.length} små formulär (språkväljare etc)`);
  }
  console.log(`[findForms] ✓ ${forms.length} relevanta formulär hittade`);

  formsInFrame = forms;

  // If iframe with forms, notify parent
  if (!isTopFrame && forms.length > 0) {
    window.parent.postMessage({
      type: 'AI_FORM_FILLER_FORMS_DETECTED',
      count: forms.length
    }, '*');
  }

  // If top frame, create button
  if (isTopFrame) {
    createButton();
  }
}

// Listen for messages from iframes
if (isTopFrame) {
  window.addEventListener('message', (event) => {
    if (event.data.type === 'AI_FORM_FILLER_FORMS_DETECTED') {
      createButton();
    }
  });
}

function createButton() {
  // Check if we have forms in this frame or received message from iframe
  const totalForms = formsInFrame.length || 1; // Assume at least 1 if we got iframe message

  console.log(`[createButton v${VERSION}] Skapar knapp för ${totalForms} formulär`);

  // Remove old button
  const oldButton = document.querySelector('.ai-fill-button');
  if (oldButton) {
    console.log('[createButton] Tar bort gammal knapp');
    oldButton.remove();
  }

  if (totalForms === 0) {
    console.log('[createButton] Inga formulär - skapar ingen knapp');
    return;
  }

  const button = document.createElement('button');
  button.className = 'ai-fill-button';
  button.textContent = `🤖 Fyll formulär med AI`;
  button.style.cssText = `
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

  button.onclick = handleClick;
  document.body.appendChild(button);
  console.log('[createButton] ✓ Knapp skapad och tillagd till sidan');
}

async function handleClick() {
  const button = document.querySelector('.ai-fill-button');
  const originalText = button.textContent;

  // Helper function to update button from anywhere
  const updateButton = (text, background = null) => {
    const btn = document.querySelector('.ai-fill-button');
    if (btn) {
      btn.textContent = text;
      if (background) btn.style.background = background;
    }
  };

  try {
    button.disabled = true;
    button.textContent = '⏳ Arbetar...';

    // Get forms from this frame
    let allForms = formsInFrame;

    // Process forms - PROGRESSIVE APPROACH: One API call per field
    if (allForms.length > 0) {
      console.log(`📋 Processing ${allForms.length} forms with PROGRESSIVE filling...`);
      updateButton('⏳ Analyserar formulär...');

      // Extract all fields from all forms
      const allFields = [];

      allForms.forEach((form) => {
        const formFields = extractFormFields(form);
        formFields.forEach(field => {
          // Store the actual DOM element for later filling
          field.formElement = form;
          allFields.push(field);
        });
      });

      console.log(`📊 Total fields to fill: ${allFields.length}`);

      // Fill fields in parallel batches (5 concurrent for speed)
      let filled = 0;
      let failed = 0;
      const BATCH_SIZE = 5;

      console.log(`🚀 Using parallel processing: ${BATCH_SIZE} fields at a time`);

      for (let batchStart = 0; batchStart < allFields.length; batchStart += BATCH_SIZE) {
        const batch = allFields.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allFields.length / BATCH_SIZE);

        console.log(`\n🔄 Processing batch ${batchNum}/${totalBatches}: ${batch.map(f => f.label).join(', ')}`);

        // Process all fields in batch concurrently
        const batchPromises = batch.map(async (field, idx) => {
          const globalIdx = batchStart + idx;
          try {
            console.log(`[${globalIdx+1}/${allFields.length}] Starting: ${field.name} (${field.label})`);

            const response = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Timeout')), 60000);

              chrome.runtime.sendMessage({
                type: 'FILL_SINGLE_FIELD',
                fieldName: field.name,
                fieldData: {
                  name: field.name,
                  type: field.type,
                  label: field.label,
                  url: window.location.href
                }
              }, (resp) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(resp);
                }
              });
            });

            // Fill the field immediately with the response
            if (response && response.success && response.value !== null && response.value !== undefined) {
              let valueToFill = response.value;

              // Handle different field types
              if (field.element.type === 'checkbox') {
                field.element.checked = response.value === true || response.value === 'true';
              } else if (field.element.type === 'number') {
                // Extract first number from string (handles "1–4" -> "1", "2-5" -> "2", etc.)
                const numberMatch = String(valueToFill).match(/\d+/);
                if (numberMatch) {
                  valueToFill = numberMatch[0];
                  console.log(`  🔢 [${globalIdx+1}] Converted "${response.value}" -> "${valueToFill}" for number field`);
                }
                field.element.value = valueToFill;
              } else {
                field.element.value = valueToFill;
              }

              field.element.dispatchEvent(new Event('input', { bubbles: true }));
              field.element.dispatchEvent(new Event('change', { bubbles: true }));
              field.element.style.background = '#e8f5e9';
              setTimeout(() => field.element.style.background = '', 3000);
              console.log(`  ✅ [${globalIdx+1}/${allFields.length}] Filled ${field.name} with: ${valueToFill}`);

              // Update button with percentage after each field completes
              const completed = filled + failed + 1; // +1 for this field
              const percentage = Math.round((completed / allFields.length) * 100);
              updateButton(`⏳ ${percentage}% (${completed}/${allFields.length} fält)`);

              return { success: true, field };
            } else {
              console.log(`  ⚠️ [${globalIdx+1}/${allFields.length}] No value for ${field.name}`);

              // Update button with percentage after each field completes
              const completed = filled + failed + 1; // +1 for this field
              const percentage = Math.round((completed / allFields.length) * 100);
              updateButton(`⏳ ${percentage}% (${completed}/${allFields.length} fält)`);

              return { success: false, field };
            }
          } catch (error) {
            console.error(`  ❌ [${globalIdx+1}/${allFields.length}] Failed ${field.name}:`, error.message);

            // Update button with percentage after each field completes
            const completed = filled + failed + 1; // +1 for this field
            const percentage = Math.round((completed / allFields.length) * 100);
            updateButton(`⏳ ${percentage}% (${completed}/${allFields.length} fält)`);

            return { success: false, field, error };
          }
        });

        // Wait for all fields in batch to complete
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
        if (batchStart + BATCH_SIZE < allFields.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      updateButton(`✓ Klart! ${filled} fyllda, ${failed} misslyckades`, '#4CAF50');

      console.log(`✅ SUMMARY: ${filled} filled, ${failed} failed out of ${allFields.length} total`);

      // Reset button after 3 seconds
      setTimeout(() => {
        updateButton(originalText, 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      }, 3000);
    } else {
      // Try to fill forms in iframes by sending message
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage({type: 'AI_FORM_FILLER_FILL_FORMS'}, '*');
        } catch (e) {
          // Ignore CORS errors
        }
      });

      updateButton('✓ Skickat till iframes', '#4CAF50');

      // Reset button after 3 seconds
      setTimeout(() => {
        updateButton(originalText, 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      }, 3000);
    }

  } catch (error) {
    console.error('Fel:', error);

    // Check if it's an extension reload error
    if (error.message && error.message.includes('Extension context invalidated')) {
      button.textContent = '🔄 Ladda om sidan';
      button.style.background = '#FF9800';
    } else {
      button.textContent = '❌ Fel';
      button.style.background = '#f44336';
    }

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 5000);
  } finally {
    button.disabled = false;
  }
}

// Helper function to extract fields from a form
function extractFormFields(form) {
  const fields = [];
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    if (!['hidden', 'submit', 'button'].includes(input.type)) {
      let label = '';

      // Method 1: Find label by 'for' attribute
      if (input.id) {
        const labelElement = form.querySelector(`label[for="${input.id}"]`);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }

      // Method 2: Check aria-labelledby
      if (!label && input.getAttribute('aria-labelledby')) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelElement = document.getElementById(labelId);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }

      // Method 3: Check if input is inside a label
      if (!label) {
        const parentLabel = input.closest('label');
        if (parentLabel) {
          const clone = parentLabel.cloneNode(true);
          const inputsInClone = clone.querySelectorAll('input, select, textarea');
          inputsInClone.forEach(inp => inp.remove());
          label = clone.textContent.trim();
        }
      }

      // Method 4: Look for nearby label
      if (!label) {
        const previousElement = input.previousElementSibling;
        if (previousElement && previousElement.tagName === 'LABEL') {
          label = previousElement.textContent.trim();
        } else if (input.parentElement) {
          const parentPrevious = input.parentElement.previousElementSibling;
          if (parentPrevious && parentPrevious.tagName === 'LABEL') {
            label = parentPrevious.textContent.trim();
          }
        }
      }

      // Method 5: Look for legend (for fieldsets)
      if (!label) {
        const fieldset = input.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) {
            label = legend.textContent.trim();
          }
        }
      }

      // Method 6: HubSpot specific
      if (!label) {
        const wrapper = input.closest('.hs-form-field, .field, .form-group');
        if (wrapper) {
          const wrapperLabel = wrapper.querySelector('label, .hs-form-field-label, .field-label');
          if (wrapperLabel) {
            const clone = wrapperLabel.cloneNode(true);
            const inputsInClone = clone.querySelectorAll('input, select, textarea');
            inputsInClone.forEach(inp => inp.remove());
            label = clone.textContent.trim();
          }
        }
      }

      // Method 7: Look in parent containers
      if (!label) {
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
      }

      // Fallback
      if (!label) {
        label = input.placeholder || input.getAttribute('aria-label') || input.name || input.id;
      }

      // Clean up label
      label = label.replace(/\s+/g, ' ').trim();

      fields.push({
        element: input,
        name: input.name || input.id,
        type: input.type,
        label: label
      });
    }
  });

  return fields;
}

// Helper function to fill all forms with data
function fillAllFormsWithData(forms, data) {
  let filled = 0;
  let total = Object.keys(data).length;
  const notFound = [];

  Object.keys(data).forEach(fieldName => {
    const value = data[fieldName];
    if (!value && value !== false) return; // Skip null/undefined but allow false for checkboxes

    // Try to find the field in any of the forms
    let field = null;
    for (const form of forms) {
      field = form.querySelector(`[name="${fieldName}"]`) ||
              form.querySelector(`#${fieldName}`) ||
              form.querySelector(`[name="${fieldName.replace(/\//g, '\\/')}"]]`);
      if (field) break;
    }

    if (field) {
      if (field.type === 'checkbox') {
        field.checked = value === true || value === 'true';
      } else {
        field.value = value;
      }
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.style.background = '#e8f5e9';
      setTimeout(() => field.style.background = '', 2000);
      filled++;
    } else {
      notFound.push(fieldName);
    }
  });

  if (notFound.length > 0) {
    console.log('⚠️ Kunde inte hitta fält för:', notFound);
  }

  return { filled, total };
}

// Listen for fill command from parent
window.addEventListener('message', async (event) => {
  if (event.data.type === 'AI_FORM_FILLER_FILL_FORMS' && formsInFrame.length > 0) {
    for (const form of formsInFrame) {
      await fillForm(form);
    }
  }
});

async function fillForm(form) {

  // Extract form structure
  const fields = [];
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    if (!['hidden', 'submit', 'button'].includes(input.type)) {
      // Try to find the label for this input
      let label = '';

      // Method 1: Find label by 'for' attribute
      if (input.id) {
        const labelElement = form.querySelector(`label[for="${input.id}"]`);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }

      // Method 2: Check aria-labelledby
      if (!label && input.getAttribute('aria-labelledby')) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelElement = document.getElementById(labelId);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }

      // Method 3: Check if input is inside a label
      if (!label) {
        const parentLabel = input.closest('label');
        if (parentLabel) {
          // Clone the label and remove the input to get clean text
          const clone = parentLabel.cloneNode(true);
          const inputsInClone = clone.querySelectorAll('input, select, textarea');
          inputsInClone.forEach(inp => inp.remove());
          label = clone.textContent.trim();
        }
      }

      // Method 4: Look for nearby label (previous sibling or parent's previous sibling)
      if (!label) {
        const previousElement = input.previousElementSibling;
        if (previousElement && previousElement.tagName === 'LABEL') {
          label = previousElement.textContent.trim();
        } else if (input.parentElement) {
          const parentPrevious = input.parentElement.previousElementSibling;
          if (parentPrevious && parentPrevious.tagName === 'LABEL') {
            label = parentPrevious.textContent.trim();
          }
        }
      }

      // Method 5: Look for legend (for fieldsets)
      if (!label) {
        const fieldset = input.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) {
            label = legend.textContent.trim();
          }
        }
      }

      // Method 6: HubSpot specific - look for label/span in parent wrapper
      if (!label) {
        const wrapper = input.closest('.hs-form-field, .field, .form-group');
        if (wrapper) {
          const wrapperLabel = wrapper.querySelector('label, .hs-form-field-label, .field-label');
          if (wrapperLabel) {
            // Clone and remove inputs to get clean text
            const clone = wrapperLabel.cloneNode(true);
            const inputsInClone = clone.querySelectorAll('input, select, textarea');
            inputsInClone.forEach(inp => inp.remove());
            label = clone.textContent.trim();
          }
        }
      }

      // Method 7: Look in parent containers for any text that looks like a question
      if (!label) {
        let parent = input.parentElement;
        let depth = 0;
        while (parent && depth < 3) {
          // Look for any direct text or label-like elements
          const textElements = parent.querySelectorAll(':scope > label, :scope > span, :scope > div');
          for (const elem of textElements) {
            if (elem !== input && elem.textContent && elem.textContent.length > 5) {
              // Clone and remove inputs to avoid circular text
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
      }

      // Fallback to placeholder, aria-label, or name
      if (!label) {
        label = input.placeholder || input.getAttribute('aria-label') || input.name || input.id;
      }

      // Clean up label - remove extra whitespace, asterisks
      label = label.replace(/\s+/g, ' ').trim();

      fields.push({
        name: input.name || input.id,
        type: input.type,
        label: label
      });
    }
  });

  const formData = {
    url: window.location.href,
    title: document.title,
    fields
  };

  console.log('📋 Form data being sent to AI:');
  console.log('  URL:', formData.url);
  console.log('  Title:', formData.title);
  console.log('  Fields:', formData.fields.length);
  console.log('  ALL fields with labels:');
  formData.fields.forEach((f, idx) => {
    console.log(`    ${idx + 1}. "${f.name}" (${f.type})`);
    console.log(`       Label: "${f.label}"`);
  });

  // Send to background
  try {
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

      chrome.runtime.sendMessage({
        type: 'FILL_FORM',
        formData
      }, (resp) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp);
        }
      });
    });

    if (response && response.success && response.data) {
      console.log('✅ AI svar mottaget:', response.data);

      // Fill fields
      let filled = 0;
      let notFound = [];

      Object.keys(response.data).forEach(fieldName => {
        const value = response.data[fieldName];
        if (!value && value !== false) return; // Skip null/undefined but allow false for checkboxes

        // Try multiple ways to find the field
        let field = form.querySelector(`[name="${fieldName}"]`) ||
                   form.querySelector(`#${fieldName}`) ||
                   form.querySelector(`[name="${fieldName.replace(/\//g, '\\/')}"]]`);

        if (field) {
          if (field.type === 'checkbox') {
            field.checked = value === true || value === 'true';
          } else {
            field.value = value;
          }
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.style.background = '#e8f5e9';
          setTimeout(() => field.style.background = '', 2000);
          filled++;
        } else {
          notFound.push(fieldName);
        }
      });

      console.log(`✅ Fyllde ${filled} av ${Object.keys(response.data).length} fält`);
      if (notFound.length > 0) {
        console.log('⚠️ Kunde inte hitta fält för:', notFound);
      }

      // Ge tid för användaren att se fälten bli ifyllda
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('Fel vid fillForm:', error);
    throw error; // Re-throw så knappen visar fel-status
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findForms);
} else {
  findForms();
}

// Re-check after delay for dynamic forms (HubSpot forms load slowly)
setTimeout(findForms, 2000);
setTimeout(findForms, 4000);
setTimeout(findForms, 6000);
setTimeout(findForms, 8000);
setTimeout(findForms, 10000);
setTimeout(findForms, 15000);
setTimeout(findForms, 20000);

// Removed verbose HubSpot checking - forms are detected via findForms()

// Watch for dynamically added forms (especially HubSpot forms)
const formObserver = new MutationObserver((mutations) => {
  let foundNewForms = false;

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      // Check for forms
      if (node.nodeName === 'FORM') {
        foundNewForms = true;
      }
      // Check for HubSpot form containers
      else if (node.nodeType === 1) { // Element node
        if (node.classList && (
          node.classList.contains('hbspt-form') ||
          node.classList.contains('hs-form') ||
          node.id && node.id.startsWith('hs')
        )) {
          foundNewForms = true;
        }
        // Check children for forms or HubSpot elements
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
    setTimeout(findForms, 1000);
  }
});

formObserver.observe(document.body, {
  childList: true,
  subtree: true
});
