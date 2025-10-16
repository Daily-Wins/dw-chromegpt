// AI Form Filler - Content Script with Iframe Support
const isTopFrame = window === window.top;
console.log('🚀 AI Form Filler', isTopFrame ? '(Top)' : '(Iframe)');

// Global forms registry
let formsInFrame = [];

function findForms() {
  let forms = Array.from(document.querySelectorAll('form'));
  
  // Filter out small forms (language selector, search)
  forms = forms.filter(form => {
    const inputs = form.querySelectorAll('input:not([type="hidden"]), select:not([type="hidden"]), textarea');
    return inputs.length >= 3;
  });

  console.log(`Hittade ${forms.length} relevanta formulär i denna frame`);
  formsInFrame = forms;

  // If iframe with forms, notify parent
  if (!isTopFrame && forms.length > 0) {
    console.log('→ Meddelar parent frame om formulär');
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
      console.log('✓ Iframe har', event.data.count, 'formulär');
      createButton();
    }
  });
}

function createButton() {
  // Check if we have forms in this frame or received message from iframe
  const totalForms = formsInFrame.length || 1; // Assume at least 1 if we got iframe message

  // Remove old button
  const oldButton = document.querySelector('.ai-fill-button');
  if (oldButton) oldButton.remove();

  if (totalForms === 0) {
    console.log('Inga formulär - ingen knapp');
    return;
  }

  console.log(`Skapar knapp för ${totalForms} formulär`);

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
  console.log('✓ Knapp skapad');
}

async function handleClick() {
  const button = document.querySelector('.ai-fill-button');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = '⏳ Arbetar...';

    console.log('🎯 Söker formulär i alla frames...');

    // Get forms from this frame
    let allForms = formsInFrame;

    // Ask all iframes for their forms via message passing
    const iframes = document.querySelectorAll('iframe');
    console.log(`Kollar ${iframes.length} iframes...`);

    // Process forms
    if (allForms.length > 0) {
      console.log(`Bearbetar ${allForms.length} formulär`);

      for (let i = 0; i < allForms.length; i++) {
        button.textContent = `⏳ ${i + 1}/${allForms.length}`;
        await fillForm(allForms[i]);
      }

      button.textContent = '✓ Klart!';
      button.style.background = '#4CAF50';
    } else {
      // Try to fill forms in iframes by sending message
      console.log('Skickar meddelande till iframes att fylla formulär...');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow.postMessage({type: 'AI_FORM_FILLER_FILL_FORMS'}, '*');
        } catch (e) {
          console.log('Kan inte nå iframe (CORS):', e.message);
        }
      });

      button.textContent = '✓ Skickat till iframes';
      button.style.background = '#4CAF50';
    }

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);

  } catch (error) {
    console.error('Fel:', error);
    button.textContent = '❌ Fel';
    button.style.background = '#f44336';

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);
  } finally {
    button.disabled = false;
  }
}

// Listen for fill command from parent
window.addEventListener('message', async (event) => {
  if (event.data.type === 'AI_FORM_FILLER_FILL_FORMS' && formsInFrame.length > 0) {
    console.log('📨 Mottog fill-kommando från parent, fyller formulär...');
    for (const form of formsInFrame) {
      await fillForm(form);
    }
  }
});

async function fillForm(form) {
  console.log('Fyller formulär...');

  // Extract form structure
  const fields = [];
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    if (!['hidden', 'submit', 'button'].includes(input.type)) {
      fields.push({
        name: input.name || input.id,
        type: input.type,
        label: input.placeholder || input.name || input.id
      });
    }
  });

  const formData = {
    url: window.location.href,
    title: document.title,
    fields
  };

  console.log('Form data:', formData);

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

    console.log('Svar:', response);

    if (response && response.success && response.data) {
      console.log('Data att fylla:', response.data);

      // Fill fields
      let filled = 0;
      Object.keys(response.data).forEach(fieldName => {
        const value = response.data[fieldName];
        if (!value) return;

        let field = form.querySelector(`[name="${fieldName}"]`) ||
                   form.querySelector(`#${fieldName}`);

        if (field) {
          field.value = value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.style.background = '#e8f5e9';
          setTimeout(() => field.style.background = '', 2000);
          filled++;
          console.log(`✓ ${fieldName} = ${value}`);
        }
      });

      console.log(`Fyllde ${filled} fält`);
    }
  } catch (error) {
    console.error('Fel vid fillForm:', error);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findForms);
} else {
  findForms();
}

// Re-check after delay for dynamic forms
setTimeout(findForms, 2000);
