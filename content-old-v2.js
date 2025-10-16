// AI Form Filler - Content Script
const isTopFrame = window === window.top;
console.log("🚀 AI Form Filler laddad - version 2", isTopFrame ? "(Top frame)" : "(Iframe)");

try {
  console.log('Document ready state:', document.readyState);
  console.log("Is top frame:", isTopFrame);
  console.log('Body exists:', !!document.body);

  // Wait for body to exist
  function addButton() {
    console.log('addButton kallad');

    if (!document.body) {
      console.log('Body finns inte än, väntar...');
      setTimeout(addButton, 100);
      return;
    }

    let forms = document.querySelectorAll('form');
    console.log(`Hittade ${forms.length} formulär totalt`);

    // Filtrera bort små formulär (språkväljare, sökfält etc)
    forms = Array.from(forms).filter(form => {
      const inputs = form.querySelectorAll('input:not([type="hidden"]), select:not([type="hidden"]), textarea');
      const hasMultipleFields = inputs.length >= 3;
      console.log(`  Formulär har ${inputs.length} fält → ${hasMultipleFields ? 'INKLUDERAT' : 'SKIPPAD'}`);
      return hasMultipleFields;
    });

    console.log(`Hittade ${forms.length} relevanta formulär (efter filtrering)`);

    // Endast visa knapp i top frame (inte i iframes)
    if (!isTopFrame) {
      console.log("Är i iframe - skapar inte knapp här");
      return;
    }

    // Remove old buttons
    document.querySelectorAll('.ai-fill-button').forEach(btn => {
      console.log('Tar bort gammal knapp');
      btn.remove();
    });

    if (forms.length === 0) {
      console.log('Inga formulär - ingen knapp skapas');
      return;
    }

    console.log('Skapar knapp...');
    const button = document.createElement('button');
    button.className = 'ai-fill-button';
    button.textContent = `🤖 Fyll ${forms.length} formulär`;
    button.style.cssText = `
      all: initial !important;
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      transform: none !important;
      z-index: 2147483647 !important;
      padding: 15px 25px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      border: none !important;
      border-radius: 20px !important;
      cursor: pointer !important;
      font-weight: bold !important;
      font-size: 16px !important;
      font-family: Arial, sans-serif !important;
      box-shadow: 0 0 50px rgba(255,20,147,0.9) !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      text-align: center !important;
    `;

    button.onclick = async function() {
      console.log('🎯 Knappen klickad!');
      button.textContent = '⏳ Arbetar...';

      try {
        // Extract all form data
        const allFormsData = [];
        forms.forEach((form, index) => {
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

          allFormsData.push({
            form,
            formData: {
              url: window.location.href,
              title: document.title,
              fields
            }
          });
        });

        console.log('Form data:', allFormsData);

        // Process each form
        let successCount = 0;
        for (let i = 0; i < allFormsData.length; i++) {
          button.textContent = `⏳ Formulär ${i+1}/${allFormsData.length}`;

          try {
            console.log(`Skickar formulär ${i+1} till background...`);

            const response = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

              chrome.runtime.sendMessage({
                type: 'FILL_FORM',
                formData: allFormsData[i].formData
              }, (resp) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(resp);
                }
              });
            });

            console.log(`Svar från formulär ${i+1}:`, response);

            if (response && response.success && response.data) {
              // Fill form
              const form = allFormsData[i].form;
              let filled = 0;

              console.log('=== DATA FRÅN ASSISTANT ===');
              console.log('response.data:', response.data);
              console.log('Nycklar i data:', Object.keys(response.data));

              // Log alla fält i formuläret
              const formInputs = form.querySelectorAll('input, select, textarea');
              console.log('=== FÄLT I FORMULÄRET ===');
              formInputs.forEach(input => {
                console.log(`- name="${input.name}" id="${input.id}" type="${input.type}"`);
              });

              Object.keys(response.data).forEach(fieldName => {
                const value = response.data[fieldName];
                console.log(`\nFörsöker fylla: ${fieldName} = ${value}`);

                if (!value) {
                  console.log(`  → Skippar (null/empty)`);
                  return;
                }

                let field = form.querySelector(`[name="${fieldName}"]`);
                console.log(`  → name="${fieldName}": ${field ? 'HITTAD' : 'INTE HITTAD'}`);

                if (!field) {
                  field = form.querySelector(`#${fieldName}`);
                  console.log(`  → id="${fieldName}": ${field ? 'HITTAD' : 'INTE HITTAD'}`);
                }

                if (field) {
                  field.value = value;
                  field.dispatchEvent(new Event('input', { bubbles: true }));
                  field.dispatchEvent(new Event('change', { bubbles: true }));
                  field.style.background = '#e8f5e9';
                  setTimeout(() => field.style.background = '', 2000);
                  filled++;
                  console.log(`  ✓ IFYLLD!`);
                } else {
                  console.log(`  ✗ HITTADE INTE FÄLTET "${fieldName}"`);
                }
              });

              console.log(`\n=== RESULTAT: Fyllde ${filled} av ${Object.keys(response.data).length} fält ===`);
              if (filled > 0) successCount++;
            }

          } catch (error) {
            console.error(`Fel vid formulär ${i+1}:`, error);
          }
        }

        button.textContent = `✓ Klar! ${successCount}/${allFormsData.length}`;
        button.style.background = '#4CAF50';

        setTimeout(() => {
          button.textContent = `🤖 Fyll ${forms.length} formulär`;
          button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 3000);

      } catch (error) {
        console.error('Fel:', error);
        button.textContent = '❌ Fel!';
        button.style.background = '#f44336';

        setTimeout(() => {
          button.textContent = `🤖 Fyll ${forms.length} formulär`;
          button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 3000);
      }
    };

    document.body.appendChild(button);
    console.log('✅ Knapp tillagd i DOM');
    console.log('Button style:', button.style.cssText);
    console.log('Button position:', button.getBoundingClientRect());
  }

  // Start
  if (document.readyState === 'loading') {
    console.log('Väntar på DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    console.log('DOM redan laddad, kör direkt');
    addButton();
  }

  // Also try after a delay
  setTimeout(() => {
    console.log('Timeout - försöker lägga till knapp igen');
    addButton();
  }, 1000);

} catch (error) {
  console.error('💥 Kritiskt fel:', error);
}
