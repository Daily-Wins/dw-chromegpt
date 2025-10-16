# Installation Guide

## Prerequisites

- Node.js (v18 or higher)
- Chrome browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Prepare Company Documents

Create or place your company documents in the project root directory. Supported formats:
- PDF (.pdf)
- Excel (.xlsx)
- Word (.docx)
- Text (.txt)

Example documents to create:
- `företagsinfo.txt` - Company information (provided as example)
- `medarbetardata.xlsx` - Employee data
- `policies.docx` - Company policies

You can also update the `files` array in [setup-assistant.js](setup-assistant.js) to include your documents.

## Step 3: Create OpenAI Assistant

1. Set your OpenAI API key as environment variable:

```bash
export OPENAI_API_KEY="sk-..."
```

2. Run the setup script:

```bash
npm run setup
```

3. **IMPORTANT**: Save the Assistant ID that is printed in the output. You'll need it in Step 5.

Example output:
```
✓ Uppladdad: företagsinfo.txt
✓ Vector store skapad med 1 filer

✅ Assistant skapad!
Assistant ID: asst_abc123xyz

Spara detta ID i din extension!
```

## Step 4: Load Chrome Extension

1. Open Chrome and navigate to: `chrome://extensions/`

2. Enable **Developer mode** (toggle in top right corner)

3. Click **"Load unpacked"**

4. Select the project directory (`dw-chromegpt`)

5. The extension should now appear in your extensions list

## Step 5: Configure Extension

1. Click the extension icon in Chrome toolbar (puzzle piece icon → AI Form Filler MVP)

2. Enter your configuration:
   - **OpenAI API Key**: Your API key (sk-...)
   - **Assistant ID**: The ID from Step 3 (asst_...)

3. Click **"Spara"** (Save)

4. You should see a green success message: "✓ Sparat!"

## Step 6: Test the Extension

1. Navigate to a webpage with a form, for example:
   - https://www.w3schools.com/html/html_forms.asp
   - Any job application form
   - Contact forms on websites

2. You should see a purple button: **"🤖 Fyll med AI"** above each form

3. Click the button to automatically fill the form with data from your company documents

4. Watch the magic happen:
   - Button shows "⏳ Analyserar..." while processing
   - Form fields are filled with relevant data
   - Fields flash green to show what was filled
   - Button shows "✓ Ifyllt!" when complete

## Troubleshooting

### "Konfigurera API-nyckel och Assistant ID i popup"
- Make sure you've configured both API key and Assistant ID in the extension popup
- Check that the API key starts with "sk-"
- Check that the Assistant ID starts with "asst_"

### "Timeout: Assistant svarade inte i tid"
- The Assistant is taking too long to respond (>30 seconds)
- Check your OpenAI account for rate limits or quota issues
- Try again in a few moments

### Forms not being detected
- Make sure the page has `<form>` elements
- Try refreshing the page
- Check browser console for errors (F12 → Console)

### Fields not being filled correctly
- The Assistant might not have relevant data in the uploaded documents
- Check that field names match between form and Assistant response
- Review the Assistant instructions in [setup-assistant.js](setup-assistant.js)

### Extension not loading
- Make sure all files are present in the directory
- Check Chrome console for errors: `chrome://extensions/` → Details → "Inspect views: service worker"
- Verify manifest.json is valid JSON

## Updating Documents

To update or add new company documents:

1. Add/update files in the project directory

2. Update the `files` array in [setup-assistant.js](setup-assistant.js)

3. Run the setup script again:

```bash
npm run setup
```

4. Update the Assistant ID in the extension popup with the new ID

## Cost Estimation

- **File storage**: ~$0.20/GB/day
- **Per form fill**: ~$0.01-0.05
- **Monthly (100 forms)**: ~$1-5

Check your usage at: https://platform.openai.com/usage

## Next Steps

Once the MVP is working, you can extend it with:
- SharePoint integration for automatic document sync
- n8n workflows for advanced automation
- Custom templates for specific form types
- Analytics and logging
- Multi-language support

See [README.md](README.md) for architecture details and future enhancements.
