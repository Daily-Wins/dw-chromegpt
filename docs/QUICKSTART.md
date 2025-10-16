# Quick Start Guide

Get up and running in 5 minutes!

## 1️⃣ Install Dependencies

```bash
npm install
```

## 2️⃣ Set API Key & Create Assistant

```bash
export OPENAI_API_KEY="sk-..."
npm run setup
```

**Save the Assistant ID** that appears in the output!

## 3️⃣ Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select this folder

## 4️⃣ Configure Extension

Click the extension icon and enter:
- Your OpenAI API key
- The Assistant ID from step 2

## 5️⃣ Test It!

Visit any webpage with a form and click the **"🤖 Fyll med AI"** button.

---

## Project Structure

```
dw-chromegpt/
├── manifest.json           # Chrome extension config
├── popup.html/js           # Settings UI
├── content.js              # Form detection & filling
├── background.js           # OpenAI API integration
├── styles.css              # UI styling
├── setup-assistant.js      # Assistant setup script
├── företagsinfo.txt        # Sample company data
├── package.json            # Node.js dependencies
├── README.md               # Full documentation
├── INSTALLATION.md         # Detailed setup guide
└── CLAUDE.md               # Development guide

Chrome Extension (Manifest V3)
├── popup → Saves API credentials to chrome.storage
├── content → Detects forms, adds AI button, fills fields
└── background → Calls OpenAI Assistant API with form data

OpenAI Assistant
├── Uploaded documents (företagsinfo.txt, etc.)
├── Vector store for RAG search
└── Returns JSON with field values
```

## Key Features

✅ Automatic form detection on all webpages
✅ AI-powered form filling using company documents
✅ RAG (Retrieval-Augmented Generation) for accurate data
✅ Visual feedback and animations
✅ Support for text, email, select, textarea fields
✅ SPA-compatible with MutationObserver
✅ Secure storage of API credentials

## Commands

```bash
# Install dependencies
npm install

# Create OpenAI Assistant
npm run setup

# (Extension loads directly in Chrome, no build step needed)
```

## Troubleshooting

**Button not appearing?**
→ Refresh the page, check console for errors

**"Konfigurera API-nyckel" error?**
→ Click extension icon and enter API key + Assistant ID

**Form not filling correctly?**
→ Check that company documents contain relevant data

**Assistant timeout?**
→ Wait a moment and try again

For detailed troubleshooting, see [INSTALLATION.md](INSTALLATION.md)

## What's Next?

- Add more company documents to improve accuracy
- Test on different types of forms
- Customize Assistant instructions in `setup-assistant.js`
- Extend with SharePoint sync or n8n integration

See [README.md](README.md) for the complete architecture and roadmap.

## Cost

- File storage: ~$0.20/GB/day
- Per form: ~$0.01-0.05
- 100 forms/month: ~$1-5

## Support

- Check [INSTALLATION.md](INSTALLATION.md) for setup issues
- Review [CLAUDE.md](CLAUDE.md) for development guidance
- See [README.md](README.md) for architecture details
