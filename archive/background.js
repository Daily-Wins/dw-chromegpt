// OpenAI Assistant Integration
const VERSION = '1.3.2';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`[Background v${VERSION}] Meddelande mottaget:`, request.type);

  if (request.type === 'FILL_FORM') {
    console.log('[Background] Startar handleFormFill...');
    handleFormFill(request.formData)
      .then(result => {
        console.log('[Background] handleFormFill lyckades:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Background] handleFormFill fel:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // Håller kanalen öppen för async
  }

  if (request.type === 'FILL_SINGLE_FIELD') {
    console.log('[Background] Startar fillSingleField för:', request.fieldName);
    fillSingleField(request.fieldData)
      .then(result => {
        console.log('[Background] fillSingleField lyckades:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Background] fillSingleField fel:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true;
  }
});

async function handleFormFill(formData) {
  console.log('[Background] handleFormFill startad');

  // Hämta API-inställningar
  const config = await chrome.storage.local.get(['apiKey', 'assistantId']);
  console.log('[Background] Config hämtad:', { hasApiKey: !!config.apiKey, hasAssistantId: !!config.assistantId });

  if (!config.apiKey || !config.assistantId) {
    throw new Error('Konfigurera API-nyckel och Assistant ID i popup');
  }

  // 1. Create a new thread with vector store access
  console.log('[Background] Creating new thread with vector stores...');
  const thread = await createThreadWithFiles(config.apiKey, config.assistantId);
  const threadId = thread.id;
  console.log('[Background] Thread created:', threadId);

  // 2. Skicka meddelande med formulärbeskrivning
  await addMessage(config.apiKey, threadId, formData);

  // 3. Kör assistant
  const run = await runAssistant(config.apiKey, threadId, config.assistantId);

  // 4. Vänta på completion
  const result = await waitForCompletion(config.apiKey, threadId, run.id);

  // 5. Hämta svar
  const messages = await getMessages(config.apiKey, threadId);
  let assistantMessage = messages.data[0].content[0].text.value;

  console.log('Assistant svar (original):', assistantMessage);

  // Robust JSON cleanup function
  function cleanJsonString(str) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Cleanup v1.1.0] Starting JSON cleanup...');
    console.log('[Cleanup] Original length:', str.length);
    console.log('[Cleanup] First 200 chars:', str.substring(0, 200));

    // 0. Remove markdown code blocks (```json and ```)
    const beforeMarkdown = str;
    str = str.replace(/```json\s*/g, '');
    str = str.replace(/```\s*/g, '');
    if (beforeMarkdown !== str) {
      console.log('[Cleanup] ✓ Removed markdown blocks');
    }

    // 1. Replace smart quotes with regular quotes FIRST (before other processing)
    const beforeQuotes = str;
    str = str.replace(/[""]/g, '"');
    str = str.replace(/['']/g, "'");
    if (beforeQuotes !== str) {
      console.log('[Cleanup] ✓ Replaced smart quotes');
    }

    // 2. Remove citation markers like 【4:7†source】
    const beforeCitations = str;
    str = str.replace(/【[^】]*】/g, '');
    if (beforeCitations !== str) {
      console.log('[Cleanup] ✓ Removed citation markers');
    }

    // 3. Remove JavaScript comments (// comments)
    const beforeComments = str;
    str = str.replace(/\/\/[^\n]*/g, '');
    if (beforeComments !== str) {
      console.log('[Cleanup] ✓ Removed JS comments');
    }

    // 4. CRITICAL FIX: Replace ALL literal newlines and tabs with spaces
    const beforeNewlines = str;
    const newlineCount = (str.match(/[\r\n]/g) || []).length;
    str = str.replace(/[\r\n\t]+/g, ' ');
    if (beforeNewlines !== str) {
      console.log(`[Cleanup] ✓ Removed ${newlineCount} newlines/tabs`);
    }

    // 5. Remove excessive whitespace
    const beforeWhitespace = str;
    str = str.replace(/\s+/g, ' ');
    if (beforeWhitespace !== str) {
      console.log('[Cleanup] ✓ Compressed whitespace');
    }

    // 6. Trim leading/trailing whitespace
    str = str.trim();

    console.log('[Cleanup] Cleaned length:', str.length);
    console.log('[Cleanup] First 200 chars after cleanup:', str.substring(0, 200));
    console.log('[Cleanup] Last 100 chars after cleanup:', str.substring(str.length - 100));
    console.log('[Cleanup] JSON cleanup complete ✓');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return str;
  }

  console.log('[Background] About to clean assistant message...');
  assistantMessage = cleanJsonString(assistantMessage);
  console.log('[Background] Cleaned message ready for parsing');
  console.log('Assistant svar (cleaned):', assistantMessage);

  // 6. Parse JSON
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Parser v1.1.0] Attempting to parse JSON...');
  console.log('[Parser] String starts with:', assistantMessage.substring(0, 50));
  console.log('[Parser] String ends with:', assistantMessage.substring(assistantMessage.length - 50));

  let fillData = null;
  try {
    console.log('[Parser] Calling JSON.parse()...');
    fillData = JSON.parse(assistantMessage);
    console.log('[Parser] ✅ JSON parsed successfully!');
    console.log('[Parser] Parsed object has', Object.keys(fillData).length, 'keys');
    console.log('[Parser] First 5 keys:', Object.keys(fillData).slice(0, 5));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (e) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[Parser] ❌ JSON parse error:', e.message);
    console.error('[Parser] Error at position:', e.message.match(/position (\d+)/)?.[1]);
    console.error('[Parser] First 500 chars of problematic JSON:', assistantMessage.substring(0, 500));
    console.error('[Parser] Around error position (if available):');
    const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
    if (pos > 0) {
      console.error('  Before:', assistantMessage.substring(Math.max(0, pos - 50), pos));
      console.error('  >>>AT:', assistantMessage.substring(pos, pos + 1));
      console.error('  After:', assistantMessage.substring(pos + 1, pos + 51));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw new Error(`JSON parsing failed: ${e.message}`);
  }

  // Clean citation markers from all string values (just in case)
  Object.keys(fillData).forEach(key => {
    if (typeof fillData[key] === 'string') {
      fillData[key] = fillData[key].replace(/【[^】]*】/g, '').trim();
    }
  });

  console.log('Extraherad data:', fillData);
  return { success: true, data: fillData };
}

// New function: Fill a single field progressively
async function fillSingleField(fieldData) {
  console.log(`[SingleField v${VERSION}] Starting for field:`, fieldData.name);

  // Get API settings
  const config = await chrome.storage.local.get(['apiKey', 'assistantId']);
  if (!config.apiKey || !config.assistantId) {
    throw new Error('Konfigurera API-nyckel och Assistant ID i popup');
  }

  // Create a new thread
  const thread = await createThreadWithFiles(config.apiKey, config.assistantId);
  const threadId = thread.id;

  // Create a simple, focused prompt for ONE field
  const prompt = `Analysera detta formulärfält och returnera ENDAST värdet som ska fyllas i, baserat på företagsdokumenten.

FÄLT ATT FYLLA:
Fältnamn: "${fieldData.name}"
Typ: ${fieldData.type}
Beskrivning: ${fieldData.label}
URL: ${fieldData.url}

INSTRUKTIONER:
- Läs beskrivningen noggrant för att förstå vad fältet vill ha
- Sök i dokumenten efter relevant information
- Returnera ENDAST ett enkelt JSON-objekt med fältnamnet som nyckel
- För checkboxes: returnera true eller false
- För textfält: returnera textvärdet (utan newlines)
- Om information saknas: returnera null

SVARFORMAT:
{"${fieldData.name}": "värde här"}

Returnera nu JSON-objektet:`;

  // Send message
  await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: 'user',
      content: prompt
    })
  });

  // Run assistant
  const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: config.assistantId
    })
  });
  const run = await runResp.json();

  // Wait for completion (shorter timeout for single field)
  await waitForCompletion(config.apiKey, threadId, run.id, 30);

  // Get response
  const messages = await getMessages(config.apiKey, threadId);
  let assistantMessage = messages.data[0].content[0].text.value;

  // Simple cleanup
  assistantMessage = assistantMessage.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  assistantMessage = assistantMessage.replace(/[""]/g, '"').replace(/['']/g, "'");
  assistantMessage = assistantMessage.replace(/【[^】]*】/g, '');
  assistantMessage = assistantMessage.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Parse
  const data = JSON.parse(assistantMessage);
  const value = data[fieldData.name];

  console.log(`[SingleField] Got value for ${fieldData.name}:`, value);
  return { success: true, value: value };
}

async function getAssistant(apiKey, assistantId) {
  const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  return await response.json();
}

async function createThreadWithFiles(apiKey, assistantId) {
  console.log('[Background] Getting assistant vector stores...');

  // Get assistant to find vector stores
  const assistant = await getAssistant(apiKey, assistantId);
  const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];

  console.log('[Background] Assistant vector stores:', vectorStoreIds);

  if (vectorStoreIds.length === 0) {
    console.warn('[Background] No vector stores found on assistant!');
  }

  // Create thread with vector store access
  const body = {
    tool_resources: {
      file_search: {
        vector_store_ids: vectorStoreIds
      }
    }
  };

  const response = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  console.log('[Background] Thread created with vector stores:', result.id);
  return result;
}

async function addMessage(apiKey, threadId, formData) {
  // Group fields by name to identify checkbox groups
  const fieldsByName = {};
  formData.fields.forEach(f => {
    if (!fieldsByName[f.name]) {
      fieldsByName[f.name] = [];
    }
    fieldsByName[f.name].push(f);
  });

  const fieldsList = formData.fields.map((f, idx) => {
    const label = f.label || f.placeholder || f.name;
    const isCheckboxGroup = fieldsByName[f.name].length > 1 && f.type === 'checkbox';
    const groupInfo = isCheckboxGroup ? ` [CHECKBOX GROUP - ${fieldsByName[f.name].length} options]` : '';
    return `  "${f.name}": // ${f.type}${groupInfo} - ${label}${f.required ? ' *OBLIGATORISK*' : ''}`;
  }).join('\n');

  const message = `Du ska fylla i ett webbformulär med information från företagsdokumenten.

UPPDRAG: Analysera formulärfälten nedan och returnera företagsinformation från de uppladdade dokumenten.

Formulär på: ${formData.url}
Sidtitel: ${formData.title}

FÄLT SOM SKA FYLLAS (totalt ${formData.fields.length} fält):
${fieldsList}

VIKTIGT - LÄS FÄLTBESKRIVNINGARNA NOGGRANT:
Varje fält ovan visar:
  "fältnamn": // typ [GROUP INFO] - BESKRIVNING (detta är den viktiga texten!)

INSTRUKTIONER:
1. För VARJE fält, LÄS beskrivningen efter "//" - detta förklarar vad fältet vill ha
2. Exempel: Om beskrivningen säger "How many AI Engineers do you have?" → svara med antal AI-ingenjörer
3. Exempel: Om beskrivningen säger "Company name" eller "Företagsnamn" → svara "Daily Wins"
4. Exempel: Om beskrivningen säger "Founding year" eller "Grundningsår" → svara 2024
5. Använd dokumentens information för att besvara varje fråga/fält
6. Returnera ett JSON-objekt med EXAKT fältnamnen som nycklar (t.ex. "0-2/founding_year")
7. Om ett fält inte kan fyllas, sätt värdet till null

VIKTIGA TOLKNINGSREGLER:
- Läs ALLTID beskrivningen (texten efter "//") för att förstå vad fältet vill ha
- Ignorera kryptiska fältnamn som "0-2/..." - fokusera på beskrivningen istället

CHECKBOX HANTERING (VIKTIGT!):
- Om samma fältnamn upprepas flera gånger med [CHECKBOX GROUP], är det en checkbox-grupp där ENDAST EN checkbox ska väljas
- Läs ALLA beskrivningar för den gruppen och välj den som BÄST matchar företagets situation
- Exempel: Om det finns 4 checkboxes för "development stage" (Idea, Prototype, Early market, Growth market):
  * Sätt true för den som matchar bäst (t.ex. "Early market stage" för Daily Wins)
  * Sätt false för alla andra i samma grupp
- För enskilda checkboxes (inte i grupp): sätt true om det gäller företaget, annars false
- Exempel checkbox-grupp:
  {
    "0-2/development_stage_of_solution": false,  // Idea stage - passar INTE
    "0-2/development_stage_of_solution": false,  // Prototype stage - passar INTE
    "0-2/development_stage_of_solution": true,   // Early market stage - DETTA PASSAR!
    "0-2/development_stage_of_solution": false   // Growth stage - för tidigt
  }

EXTRAHERA KONTAKTPERSON:
- Om fältet frågar efter "First Name" eller "firstname", använd förnamnet på första teammedlemmen (t.ex. "Anders")
- Om fältet frågar efter "Last Name" eller "lastname", använd efternamnet på första teammedlemmen (t.ex. "Bratland")
- Om fältet frågar efter "Email", konstruera från förnamn@företag.se (t.ex. "anders@dailywins.se")
- Om fältet frågar efter "Phone", använd telefonnummer om det finns i dokumentet

EXEMPEL PÅ KORREKT SVAR:
{
  "company": "Daily Wins",
  "0-2/founding_year": 2024,
  "0-2/city": "Stockholm",
  "0-2/numberofemployees": 5,
  "0-2/development_stage_of_solution": false,  // Idea stage
  "0-2/development_stage_of_solution": false,  // Prototype
  "0-2/development_stage_of_solution": true,   // Early market ✓
  "0-2/development_stage_of_solution": false,  // Growth
  "email": "anders@dailywins.se",
  "firstname": "Anders",
  "lastname": "Bratland",
  "website": "www.dailywins.se"
}

KRITISKT VIKTIGT:
- Du MÅSTE svara med ENDAST ett valid JSON-objekt - inget annat!
- Använd EXAKT fältnamnen som de står listade ovan (inklusive prefix som "0-2/")
- För checkbox-grupper: välj ENDAST EN checkbox som true, resten false
- Fyll varje fält baserat på dokumentens innehåll
- Gör ditt bästa för att fylla så många fält som möjligt!

SVARFORMAT - JSON KRAV (OBLIGATORISKT):
- Returnera ENDAST raw JSON-objekt - ingenting annat före eller efter
- Valid JSON enligt RFC 8259 standard
- INGA markdown code blocks som \`\`\`json
- INGA JavaScript-kommentarer (// text)
- INGA förklaringar eller text utanför JSON-objektet
- INGA citat-referenser som 【4:7†source】
- Använd endast vanliga ASCII double quotes ("), INTE curly quotes ("")
- INGA literal newlines i strängar - ersätt med mellanslag eller använd \\n
- Alla strängar ska vara på en rad
- Exempel på KORREKT format: {"company": "Daily Wins AB", "email": "anders@dailywins.se", "phone": "+46 70 605 48 44"}
- Exempel på FEL format: \`\`\`json{"company": "Daily Wins"}\`\`\` ← INGA markdown blocks!
- Exempel på FEL format: {"company": "Daily Wins【4:0†source】"} ← INGA citations!

Returnera nu ENDAST JSON-objektet med formulärdata (inget annat text):`;

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
      // NOTE: response_format doesn't work reliably with Assistants API + file_search
      // We rely on the prompt and cleanup function instead
    })
  });
  return await response.json();
}

async function waitForCompletion(apiKey, threadId, runId, maxAttempts = 90) {
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
