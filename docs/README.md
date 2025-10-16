# MVP: Webbformulär-ifyllare med OpenAI Assistant

Perfekt! Här är en minimalistisk MVP som faktiskt kan byggas på några dagar:

## Förenklad Arkitektur

```
Chrome Extension
    ↓
OpenAI Assistant (med uploaded files från SharePoint)
    ↓
Ifylld formulärdata
```

**Fördelar med denna approach:**

* ✅ OpenAI Assistant har inbyggd RAG (ingen vektordatabas behövs)
* ✅ Fil-uppladdning direkt till Assistant
* ✅ Stateful conversations
* ✅ Mycket enklare att bygga och underhålla

## 1. Steg-för-steg Implementation

### **Fas 1: Skapa OpenAI Assistant (5 min)**

```javascript
// setup-assistant.js - Kör en gång för att sätta upp

const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function createFormFillerAssistant() {
  // 1. Ladda upp dokument från SharePoint
  const files = [
    'företagsinfo.pdf',
    'medarbetardata.xlsx',
    'policies.docx'
  ];
  
  const uploadedFiles = [];
  for (const file of files) {
    const uploaded = await openai.files.create({
      file: fs.createReadStream(file),
      purpose: 'assistants'
    });
    uploadedFiles.push(uploaded.id);
    console.log(`✓ Uppladdad: ${file}`);
  }

  // 2. Skapa Assistant med file_search
  const assistant = await openai.beta.assistants.create({
    name: "Form Filler Assistant",
    instructions: `Du är en assistent som hjälper till att fylla i webbformulär baserat på företagets information.

När du får en formulärbeskrivning:
1. Analysera vilka fält som finns
2. Sök i de uppladdade dokumenten efter relevant information
3. Returnera ett JSON-objekt med fältnamn och värden

Format för svar:
\`\`\`json
{
  "firstName": "...",
  "email": "...",
  "company": "..."
}
\`\`\`

Om information saknas, använd null som värde.`,
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: {
        vector_store_ids: [] // Skapas nedan
      }
    }
  });

  // 3. Skapa vector store och lägg till filer
  const vectorStore = await openai.beta.vectorStores.create({
    name: "Company Documents",
    file_ids: uploadedFiles
  });

  // 4. Uppdatera assistant med vector store
  await openai.beta.assistants.update(assistant.id, {
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStore.id]
      }
    }
  });

  console.log('\n✅ Assistant skapad!');
  console.log('Assistant ID:', assistant.id);
  console.log('\nSpara detta ID i din extension!');
  
  return assistant.id;
}

createFormFillerAssistant();
```

### **Fas 2: Minimal Chrome Extension**

#### **manifest.json**

```json
{
  "manifest_version": 3,
  "name": "AI Form Filler MVP",
  "version": "1.0.0",
  "description": "Fyll i formulär automatiskt med AI",
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["styles.css"]
  }],
  "background": {
    "service_worker": "background.js"
  }
}
```

#### **popup.html** (Inställningar)

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      width: 300px;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    input {
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      width: 100%;
      padding: 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #45a049;
    }
    .status {
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      text-align: center;
    }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h3>🤖 AI Form Filler</h3>
  
  <label>OpenAI API Key:</label>
  <input type="password" id="apiKey" placeholder="sk-...">
  
  <label>Assistant ID:</label>
  <input type="text" id="assistantId" placeholder="asst_...">
  
  <button id="save">Spara</button>
  
  <div id="status"></div>
  
  <script src="popup.js"></script>
</body>
</html>
```

#### **popup.js**

```javascript
// Ladda sparade inställningar
chrome.storage.local.get(['apiKey', 'assistantId'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
  if (result.assistantId) {
    document.getElementById('assistantId').value = result.assistantId;
  }
});

// Spara inställningar
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const assistantId = document.getElementById('assistantId').value;
  
  if (!apiKey || !assistantId) {
    showStatus('Vänligen fyll i alla fält', 'error');
    return;
  }
  
  chrome.storage.local.set({ apiKey, assistantId }, () => {
    showStatus('✓ Sparat!', 'success');
  });
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => status.textContent = '', 3000);
}
```

#### **content.js** (Hjärtat i MVP:n)

```javascript
// Hitta alla formulär på sidan
function detectForms() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach((form, index) => {
    // Lägg till AI-knapp vid varje formulär
    if (!form.querySelector('.ai-fill-button')) {
      addAIButton(form, index);
    }
  });
}

function addAIButton(form, index) {
  const button = document.createElement('button');
  button.className = 'ai-fill-button';
  button.type = 'button';
  button.innerHTML = '🤖 Fyll med AI';
  button.style.cssText = `
    margin: 10px 0;
    padding: 10px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: all 0.3s;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  });
  
  button.addEventListener('click', (e) => {
    e.preventDefault();
    fillFormWithAI(form);
  });
  
  // Lägg till knappen överst i formuläret
  form.insertBefore(button, form.firstChild);
}

async function fillFormWithAI(form) {
  const button = form.querySelector('.ai-fill-button');
  const originalText = button.innerHTML;
  
  try {
    // Visa loading state
    button.innerHTML = '⏳ Analyserar...';
    button.disabled = true;
  
    // Extrahera formulärstruktur
    const formData = extractFormStructure(form);
  
    // Skicka till background worker för AI-bearbetning
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'FILL_FORM',
        formData: formData
      }, resolve);
    });
  
    if (response.success) {
      // Fyll i formuläret
      populateForm(form, response.data);
    
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
  Object.keys(data).forEach(fieldName => {
    const value = data[fieldName];
    if (value === null || value === undefined) return;
  
    // Försök hitta fältet
    let field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) {
      field = form.querySelector(`#${fieldName}`);
    }
  
    if (field) {
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
    }
  });
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
```

#### **background.js** (AI-logik)

```javascript
// OpenAI Assistant Integration

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FILL_FORM') {
    handleFormFill(request.formData)
      .then(sendResponse)
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    return true; // Håller kanalen öppen för async
  }
});

async function handleFormFill(formData) {
  // Hämta API-inställningar
  const config = await chrome.storage.local.get(['apiKey', 'assistantId']);
  
  if (!config.apiKey || !config.assistantId) {
    throw new Error('Konfigurera API-nyckel och Assistant ID i popup');
  }
  
  // 1. Skapa en thread
  const thread = await createThread(config.apiKey);
  
  // 2. Skicka meddelande med formulärbeskrivning
  await addMessage(config.apiKey, thread.id, formData);
  
  // 3. Kör assistant
  const run = await runAssistant(config.apiKey, thread.id, config.assistantId);
  
  // 4. Vänta på completion
  const result = await waitForCompletion(config.apiKey, thread.id, run.id);
  
  // 5. Hämta svar
  const messages = await getMessages(config.apiKey, thread.id);
  const assistantMessage = messages.data[0].content[0].text.value;
  
  // 6. Extrahera JSON
  const jsonMatch = assistantMessage.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    const fillData = JSON.parse(jsonMatch[1]);
    return { success: true, data: fillData };
  }
  
  throw new Error('Kunde inte extrahera formulärdata från svar');
}

async function createThread(apiKey) {
  const response = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  return await response.json();
}

async function addMessage(apiKey, threadId, formData) {
  const message = `Jag behöver fylla i ett formulär. Här är informationen:

Webbplats: ${formData.url}
Sida: ${formData.title}

Formulärfält:
${formData.fields.map(f => 
  `- ${f.label || f.name} (${f.type})${f.required ? ' *obligatorisk*' : ''}`
).join('\n')}

Sök i dokumenten och ge mig ett JSON-objekt med värden för dessa fält.
Använd exakta fältnamn som nycklar: ${formData.fields.map(f => f.name).join(', ')}`;

  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: 'user',
      content: message
    })
  });
  return await response.json();
}

async function runAssistant(apiKey, threadId, assistantId) {
  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: assistantId
    })
  });
  return await response.json();
}

async function waitForCompletion(apiKey, threadId, runId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    const run = await response.json();
  
    if (run.status === 'completed') {
      return run;
    }
  
    if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Run ${run.status}: ${run.last_error?.message}`);
    }
  
    // Vänta 1 sekund innan nästa check
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Timeout: Assistant svarade inte i tid');
}

async function getMessages(apiKey, threadId) {
  const response = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    }
  );
  return await response.json();
}
```

## 2. Hur man testar MVP:n

### **Steg 1: Förbered dokument**

Skapa 1-3 testdokument med företagsinfo:

```
företagsinfo.txt:
---
Företagsnamn: Acme AB
Organisationsnummer: 556123-4567
Adress: Storgatan 1, 123 45 Stockholm
Kontaktperson: Anna Andersson
E-post: anna@acme.se
Telefon: 08-123 45 67
```

### **Steg 2: Sätt upp Assistant**

```bash
npm install openai
node setup-assistant.js
# Spara Assistant ID som visas!
```

### **Steg 3: Installera Extension**

1. Öppna Chrome → `chrome://extensions/`
2. Aktivera "Developer mode"
3. "Load unpacked" → välj projektmappen
4. Klicka på extension-ikonen → fyll i API-key och Assistant ID

### **Steg 4: Testa på ett formulär**

Öppna t.ex. https://www.w3schools.com/html/html_forms.asp eller något eget formulär

Klicka på "🤖 Fyll med AI" och se magin!

## 3. Kostnad för MVP

**Per formulärfyllning:**

* Thread creation: $0
* Message + Run: ~$0.01-0.05
* File search: $0.20/GB/dag (engångskostnad för dina dokument)

**Total månadskostnad för 100 formulär:** ~$1-5

## 4. Nästa steg efter MVP

När MVP:n fungerar kan du enkelt lägga till:

1. **SharePoint-sync** (lägg till ett node.js-script som syncar filer)
2. **n8n-integration** (webhook för att trigga workflows vid formulärfyllning)
3. **Förbättrad UI** (chat-widget, historik, etc.)
4. **Multi-formulär templates** (spara vanliga formulär)

## 5. Snabb SharePoint-sync (bonus)

```javascript
// sync-sharepoint.js
const { Client } = require('@microsoft/microsoft-graph-client');
const OpenAI = require('openai');

async function syncSharePointToAssistant() {
  // 1. Hämta filer från SharePoint
  const graphClient = Client.init({
    authProvider: // ... din auth
  });
  
  const files = await graphClient
    .api('/sites/{site-id}/drive/root/children')
    .get();
  
  // 2. Ladda upp till OpenAI
  const openai = new OpenAI();
  
  for (const file of files.value) {
    const content = await graphClient
      .api(file['@microsoft.graph.downloadUrl'])
      .get();
  
    // Upload till assistant...
  }
  
  console.log('✓ Sync klar!');
}

// Kör varje dag via cron
syncSharePointToAssistant();
```

Vill du att jag förklarar någon specifik del mer i detalj eller hjälper dig komma igång med koden?
