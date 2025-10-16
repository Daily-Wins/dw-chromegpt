// Hitta alla formulär på sidan och lägg till EN knapp
function detectForms() {
  const forms = document.querySelectorAll('form');
  console.log(`AI Form Filler: Hittade ${forms.length} formulär på sidan`);

  // Ta bort gamla knappar
  document.querySelectorAll('.ai-fill-button').forEach(btn => btn.remove());

  // Lägg endast till EN knapp om det finns formulär
  if (forms.length > 0) {
    addGlobalAIButton(forms);
    console.log('AI Form Filler: Knapp tillagd');
  } else {
    console.log('AI Form Filler: Inga formulär hittades');
  }
}

function addGlobalAIButton(forms) {
  // Kolla om knappen redan finns
  if (document.querySelector('.ai-fill-button')) {
    return;
  }

  const button = document.createElement('button');
  button.className = 'ai-fill-button';
  button.type = 'button';
  button.innerHTML = `🤖 Fyll ${forms.length > 1 ? `alla ${forms.length} formulär` : 'formulär'} med AI`;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 15px 25px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: bold;
    font-size: 16px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    transition: all 0.3s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-4px)';
    button.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('AI Form Filler: Knappen klickad!');
    await fillAllFormsWithAI(forms, button);
  });

  // Lägg till knappen i body
  document.body.appendChild(button);
  console.log('AI Form Filler: Knapp tillagd i DOM');
}

async function fillAllFormsWithAI(forms, button) {
  const originalText = button.innerHTML;

  try {
    // Visa loading state
    button.innerHTML = '⏳ Analyserar formulär...';
    button.disabled = true;

    // Samla alla formulär i en struktur
    const allFormsData = [];
    forms.forEach((form, index) => {
      const formData = extractFormStructure(form);
      allFormsData.push({ form, formData, index });
    });

    console.log(`Hittade ${forms.length} formulär på sidan`);

    // Fyll varje formulär
    let successCount = 0;
    for (const { form, formData, index } of allFormsData) {
      button.innerHTML = `⏳ Fyller formulär ${index + 1}/${forms.length}...`;

      try {
        console.log(`\n=== Formulär ${index + 1} ===`);
        console.log('Formulärstruktur skickad till API:', formData);

        // Skicka till background worker för AI-bearbetning med timeout
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout: Inget svar från background script efter 60s'));
          }, 60000);

          chrome.runtime.sendMessage({
            type: 'FILL_FORM',
            formData: formData
          }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        console.log('Svar från API:', response);

        if (response.success) {
          console.log('Försöker fylla formulär med data:', response.data);
          const filledCount = populateForm(form, response.data);
          console.log(`Fyllde ${filledCount} fält i formulär ${index + 1}`);

          if (filledCount > 0) {
            successCount++;
          }
        }
      } catch (error) {
        console.error(`Fel vid ifyllning av formulär ${index + 1}:`, error);
      }
    }

    // Visa success
    button.innerHTML = `✓ Fyllde ${successCount}/${forms.length} formulär!`;
    button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';

    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);

  } catch (error) {
    console.error('Error:', error);
    button.innerHTML = '❌ Fel';
    button.style.background = '#f44336';

    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);
  } finally {
    button.disabled = false;
  }
}

async function fillFormWithAI(form, button) {
  const originalText = button.innerHTML;

  try {
    // Visa loading state
    button.innerHTML = '⏳ Analyserar...';
    button.disabled = true;

    // Extrahera formulärstruktur
    const formData = extractFormStructure(form);
    console.log('Formulärstruktur skickad till API:', formData);

    // Skicka till background worker för AI-bearbetning
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'FILL_FORM',
        formData: formData
      }, resolve);
    });

    console.log('Svar från API:', response);

    if (response.success) {
      // Fyll i formuläret
      console.log('Försöker fylla formulär med data:', response.data);
      const filledCount = populateForm(form, response.data);
      console.log(`Fyllde ${filledCount} fält`);

      // Visa success
      button.innerHTML = '✓ Ifyllt!';
      button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';

      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 3000);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Error:', error);
    button.innerHTML = '❌ Fel';
    button.style.background = '#f44336';

    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 3000);
  } finally {
    button.disabled = false;
  }
}

function extractFormStructure(form) {
  const fields = [];
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    // Skippa hidden, submit, button
    if (['hidden', 'submit', 'button'].includes(input.type)) {
      return;
    }

    const label = findLabel(input);

    fields.push({
      name: input.name || input.id,
      type: input.type,
      label: label,
      placeholder: input.placeholder,
      required: input.required,
      options: input.type === 'select' ? getSelectOptions(input) : null
    });
  });

  return {
    url: window.location.href,
    title: document.title,
    fields: fields
  };
}

function findLabel(input) {
  // Försök hitta label på olika sätt
  let label = '';

  // 1. Via for-attribut
  if (input.id) {
    const labelElement = document.querySelector(`label[for="${input.id}"]`);
    if (labelElement) {
      label = labelElement.textContent.trim();
    }
  }

  // 2. Parent label
  if (!label) {
    const parentLabel = input.closest('label');
    if (parentLabel) {
      label = parentLabel.textContent.trim();
    }
  }

  // 3. Previous sibling
  if (!label && input.previousElementSibling) {
    const prev = input.previousElementSibling;
    if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN') {
      label = prev.textContent.trim();
    }
  }

  return label;
}

function getSelectOptions(select) {
  return Array.from(select.options).map(opt => ({
    value: opt.value,
    text: opt.textContent
  }));
}

function populateForm(form, data) {
  let filledCount = 0;

  Object.keys(data).forEach(fieldName => {
    const value = data[fieldName];
    console.log(`Försöker sätta fält "${fieldName}" till:`, value);

    if (value === null || value === undefined) {
      console.log(`  → Skippar ${fieldName} (null/undefined)`);
      return;
    }

    // Försök hitta fältet på flera sätt
    let field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) {
      field = form.querySelector(`#${fieldName}`);
    }

    // Försök även case-insensitive matching
    if (!field) {
      const inputs = form.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if (input.name && input.name.toLowerCase() === fieldName.toLowerCase()) {
          field = input;
          break;
        }
        if (input.id && input.id.toLowerCase() === fieldName.toLowerCase()) {
          field = input;
          break;
        }
      }
    }

    // Försök matcha mot label-text
    if (!field) {
      const inputs = form.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        const label = findLabel(input);
        if (label && label.toLowerCase().includes(fieldName.toLowerCase())) {
          field = input;
          console.log(`  → Matchade via label: "${label}"`);
          break;
        }
      }
    }

    if (field) {
      console.log(`  → Hittade fält:`, field.name || field.id, `(type: ${field.type})`);

      // Fyll i värdet
      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else if (field.type === 'radio') {
        const radio = form.querySelector(`[name="${fieldName}"][value="${value}"]`);
        if (radio) radio.checked = true;
      } else {
        field.value = value;
      }

      // Trigga events för att webbappen ska reagera
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));

      // Visuell feedback
      field.style.transition = 'all 0.3s';
      field.style.background = '#e8f5e9';
      setTimeout(() => {
        field.style.background = '';
      }, 2000);

      filledCount++;
    } else {
      console.log(`  → Hittade INTE fält för "${fieldName}"`);
    }
  });

  return filledCount;
}

// Starta detection
detectForms();

// Re-detect om nya formulär läggs till (SPA)
const observer = new MutationObserver(() => {
  detectForms();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
