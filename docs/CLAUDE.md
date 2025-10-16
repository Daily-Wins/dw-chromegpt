# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Form Filler MVP - A Chrome extension that automatically fills web forms using OpenAI Assistant API with RAG (Retrieval-Augmented Generation) capabilities. The extension detects forms on any webpage, extracts form structure, queries an OpenAI Assistant with access to company documents, and automatically fills form fields with relevant data.

## Architecture

### Core Components

```
Chrome Extension (Manifest V3)
├── popup.html/popup.js         → Settings UI (API key, Assistant ID)
├── content.js                  → Form detection & filling
├── background.js               → OpenAI Assistant API integration
└── styles.css                  → UI styling

Setup Scripts
└── setup-assistant.js          → Creates OpenAI Assistant with RAG
```

### Data Flow

1. **Form Detection**: content.js detects forms on webpage using MutationObserver
   - Runs in all frames (top + iframes) via `all_frames: true`
   - Polls at 2, 4, 6, 8, and 10 seconds to catch dynamically loaded forms
   - Detects HubSpot forms by watching for `.hbspt-form`, `.hs-form` classes
2. **Form Analysis**: Extracts form structure (fields, labels, types)
3. **AI Processing**: background.js sends form data to OpenAI Assistant API
4. **RAG Search**: Assistant searches uploaded company documents
5. **Response**: Assistant returns JSON with field values
6. **Form Filling**: content.js populates form fields with AI-generated data

### OpenAI Assistant Integration

The extension uses OpenAI's Assistant API v2 with:
- **file_search tool**: Enables RAG over uploaded documents
- **vector_store**: Stores company documents (PDF, XLSX, DOCX)
- **Threads**: Stateful conversations for each form fill request
- **Streaming responses**: Polls for completion status

## Development Commands

### Initial Setup

```bash
# Install Node.js dependencies
npm install

# Set OpenAI API key
export OPENAI_API_KEY="sk-..."

# Create OpenAI Assistant and upload documents
npm run setup
# Save the Assistant ID output!
```

### Chrome Extension Development

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select project directory
4. Click extension icon → configure API key and Assistant ID
5. Visit any webpage with forms → click "🤖 Fyll med AI"

### Testing

Test on forms at:
- https://www.w3schools.com/html/html_forms.asp
- Any real-world forms (LinkedIn, job applications, etc.)

## Key Files

### manifest.json
Chrome Extension Manifest V3 configuration. Uses:
- `storage` permission for API credentials
- `activeTab` permission for form access
- Service worker for background processing

### content.js
- Detects all `<form>` elements on page
- Adds "🤖 Fyll med AI" button to each form
- Extracts form structure (name, type, label, placeholder, required, options)
- Handles various label detection strategies (for-attribute, parent, sibling)
- Populates fields and dispatches events for SPA compatibility
- Provides visual feedback (loading states, success/error animations)

### background.js
OpenAI Assistant API integration:
- `createThread()` - Creates conversation thread
- `addMessage()` - Sends form structure to assistant
- `runAssistant()` - Executes assistant with file_search
- `waitForCompletion()` - Polls for completion (max 30 attempts)
- `getMessages()` - Retrieves assistant response
- Extracts JSON from markdown code blocks

### setup-assistant.js
One-time setup script that:
1. Uploads company documents (PDF, XLSX, DOCX) to OpenAI
2. Creates vector store for RAG
3. Creates Assistant with file_search capability
4. Outputs Assistant ID for extension configuration

## Chrome Extension Patterns

### Message Passing
- Content script → Background worker: `chrome.runtime.sendMessage()`
- Async responses: `return true` to keep message channel open
- Promise-based communication for clean async/await usage

### Storage API
- `chrome.storage.local.get()` - Retrieve API credentials
- `chrome.storage.local.set()` - Save user configuration
- No sensitive data in extension files (only in storage)

### Content Script Injection
- Runs on all URLs (`<all_urls>`)
- Uses MutationObserver for SPA compatibility
- Dynamically adds UI elements without conflicting with page styles

## OpenAI Assistant Best Practices

### Instructions Format
Assistant returns data as JSON in markdown code blocks:
```json
{
  "fieldName": "value",
  "email": "user@example.com"
}
```

### Field Matching
- Uses exact field names as JSON keys
- Sends field metadata (label, type, required status) for context
- Returns `null` for missing information

### Cost Optimization
- Thread reuse possible for future optimization
- File search: ~$0.20/GB/day
- Per-request cost: ~$0.01-0.05
- Estimated monthly cost for 100 forms: $1-5

## Future Enhancements

When extending this MVP:
1. **SharePoint sync**: Automated document upload from SharePoint
2. **n8n integration**: Webhook triggers for workflow automation
3. **Chat widget**: Interactive UI for form filling
4. **Template library**: Pre-configured templates for common forms
5. **Thread reuse**: Cache threads per domain for faster responses
6. **Error handling**: Retry logic, fallback strategies
7. **Analytics**: Track form fill success rates

## Security Considerations

- API keys stored in chrome.storage (user-specific)
- No API keys in source code or git
- Service worker runs in isolated context
- Content script has limited permissions
- All API calls over HTTPS

## Troubleshooting

### Forms Not Detected

If the extension button appears but doesn't fill forms:

1. **Check console logs**:
   - Open DevTools (F12)
   - Look for `🚀 AI Form Filler` messages
   - Check for form detection logs showing field counts

2. **HubSpot forms specifically**:
   - Forms loaded via `hbspt.forms.create()` may take 5-10 seconds to appear
   - Extension polls every 2s up to 10s to detect them
   - Look for `🔔 HubSpot form container upptäckt!` in console

3. **Cross-origin iframes**:
   - Forms in iframes from different domains may be blocked by CORS
   - Check for "Blocked a frame with origin..." errors in console
   - Extension runs in all frames but CORS may prevent access

4. **Dynamic forms**:
   - MutationObserver watches for new forms added after page load
   - Some forms may load after user interaction (scroll, click)
   - Try scrolling to the form area before clicking the button

### Common Issues

- **Button not visible**: Check if forms exist on page with `document.querySelectorAll('form')`
- **"Timeout" error**: Assistant taking too long (>30s) - check OpenAI status
- **"Configure API key"**: Settings not saved - reopen popup and save again
- **0 fields filled**: Assistant returning wrong field names - check console logs for mismatch

See [DEBUGGING.md](DEBUGGING.md) for detailed debugging guide.
