// setup-assistant.js - Kör en gång för att sätta upp

const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function createFormFillerAssistant() {
  // 1. Ladda upp dokument från SharePoint
  const files = [
    'företagsinfo.txt',
    'företagsinfo.pdf',
    'medarbetardata.xlsx',
    'policies.docx'
  ];

  const uploadedFiles = [];
  for (const file of files) {
    if (fs.existsSync(file)) {
      const uploaded = await openai.files.create({
        file: fs.createReadStream(file),
        purpose: 'assistants'
      });
      uploadedFiles.push(uploaded.id);
      console.log(`✓ Uppladdad: ${file}`);
    } else {
      console.log(`⚠ Fil saknas: ${file} - hoppar över`);
    }
  }

  if (uploadedFiles.length === 0) {
    console.log('\n⚠ Inga filer hittades. Skapar assistant utan filer.');
    console.log('Du kan lägga till filer senare via OpenAI Dashboard.');
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
    model: "gpt-4o-mini",
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: {
        vector_store_ids: [] // Skapas nedan
      }
    }
  });

  // 3. Attach files directly to assistant (simpler approach for v2)
  if (uploadedFiles.length > 0) {
    console.log('\nLägger till filer till assistant...');

    // For Assistants v2, we attach files when creating/running threads
    // Just update the assistant to enable file_search
    await openai.beta.assistants.update(assistant.id, {
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          // Files will be attached to threads instead
        }
      }
    });

    console.log(`✓ ${uploadedFiles.length} filer uppladdade (kommer attachas till threads)`);
    console.log(`✓ File IDs:`, uploadedFiles.join(', '));
    console.log('\n⚠️  VIKTIGT: Spara dessa file IDs - de behövs för att attacha till threads!');
  }

  console.log('\n✅ Assistant skapad!');
  console.log('Assistant ID:', assistant.id);
  console.log('\nSpara detta ID i din extension!');

  return assistant.id;
}

createFormFillerAssistant();
