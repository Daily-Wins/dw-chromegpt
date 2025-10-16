// update-assistant.js - Uppdatera befintlig assistant med bättre instruktioner

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function updateAssistant() {
  const assistantId = 'asst_u1ob95KW1ghSCn3QbMvZqHZp';

  const assistant = await openai.beta.assistants.update(assistantId, {
    instructions: `Du är en assistent som hjälper till att fylla i webbformulär baserat på företagets information.

När du får en formulärbeskrivning:
1. Analysera vilka fält som finns i formuläret
2. Sök i de uppladdade dokumenten efter relevant information
3. Returnera ENDAST ett JSON-objekt med fältnamn och värden

VIKTIGT:
- Svara ENDAST med JSON - ingen annan text
- Använd exakta fältnamn som användaren anger som nycklar
- Om information saknas, använd null som värde
- Inga markdown code blocks - bara ren JSON

Exempel på KORREKT svar:
{
  "firstName": "Anna",
  "lastName": "Andersson",
  "email": "anna@acme.se",
  "company": "Acme AB",
  "phone": "08-123 45 68"
}

Exempel på FEL svar (använd INTE detta format):
\`\`\`json
{
  "firstName": "Anna"
}
\`\`\`

Svara direkt med JSON-objektet, inget annat.`
  });

  console.log('✅ Assistant uppdaterad!');
  console.log('Assistant ID:', assistant.id);
  console.log('Modell:', assistant.model);
}

updateAssistant().catch(console.error);
