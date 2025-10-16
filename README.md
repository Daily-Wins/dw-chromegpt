# AI Form Filler MVP - Modular Architecture

A Chrome extension that automatically fills web forms using OpenAI Assistant API with RAG (Retrieval-Augmented Generation). Now with **fully modular, reusable components**.

## 🚀 Features

- **Intelligent Form Detection**: Detects forms on any webpage, including HubSpot forms and iframes
- **Smart Field Extraction**: 7 different label detection methods for accurate field identification
- **Parallel Processing**: Fills 5 fields concurrently for 4-5x faster performance
- **Real-time Progress**: Button shows percentage and field count during filling
- **RAG-Powered**: Uses OpenAI Assistant API with vector store for document search
- **Modular Architecture**: Clean, reusable components that can be integrated into any Chrome extension

## 📦 Project Structure

```
dw-chromegpt/
├── src/
│   ├── core/                    # Core business logic
│   │   ├── FormDetector.js      # Form detection
│   │   ├── FormFieldExtractor.js # Field extraction
│   │   ├── FormFiller.js        # Parallel form filling
│   │   └── OpenAIClient.js      # OpenAI API integration
│   ├── ui/
│   │   └── UIManager.js         # Button and UI management
│   ├── utils/
│   │   └── ChromeAPIBridge.js   # Chrome API wrapper
│   ├── config.js                # Centralized configuration
│   ├── content.js               # Content script entry point
│   └── background.js            # Background worker entry point
├── setup/
│   ├── setup-assistant.js       # Create OpenAI assistant
│   └── update-assistant.js      # Update assistant
├── docs/                        # Documentation
├── archive/                     # Old versions
├── popup.html                   # Extension popup
├── popup.js                     # Popup logic
├── styles.css                   # UI styles
├── manifest.json                # Chrome extension manifest
├── README.md                    # This file
└── INTEGRATION.md               # Integration guide
```

## 🔧 Installation

### 1. Setup OpenAI Assistant

```bash
# Install Node.js dependencies
npm install

# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Create assistant with company documents
npm run setup
```

This will:
- Upload your company documents to OpenAI
- Create a vector store for RAG
- Create an OpenAI Assistant
- Output an Assistant ID (save this!)

### 2. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `dw-chromegpt` directory
5. Click the extension icon and configure:
   - Paste your OpenAI API key
   - Paste your Assistant ID
   - Click "Save"

## 💡 Usage

1. Navigate to any webpage with forms
2. Wait for the "🤖 Fyll formulär med AI" button to appear (bottom-right)
3. Click the button
4. Watch as the extension:
   - Detects all forms on the page
   - Extracts field information
   - Queries your AI assistant
   - Fills fields in parallel (5 at a time)
   - Shows real-time progress

## 🎯 Performance

- **Speed**: 60-90 seconds for 24 fields (was 2-3 minutes)
- **Parallel Processing**: 5 concurrent API calls
- **Model**: gpt-4o-mini (3x faster, 60x cheaper than GPT-4o)
- **Cost**: ~$0.01-0.05 per form fill

## 🧩 Integration

Want to use these components in your own Chrome extension? See [INTEGRATION.md](INTEGRATION.md) for detailed guide.

### Quick Example

```javascript
import { FormDetector } from './core/FormDetector.js';
import { FormFiller } from './core/FormFiller.js';
import { OpenAIClient } from './core/OpenAIClient.js';

// Detect forms
const detector = new FormDetector({ version: '1.0.0' });
detector.initialize();

// Fill forms
const client = new OpenAIClient({ apiKey: 'sk-...', assistantId: 'asst_...' });
const filler = new FormFiller({
  apiClient: client,
  onProgress: (p) => console.log(`${p.percentage}% complete`)
});

await filler.fillFields(forms, fields);
```

## 🔑 Configuration

All configuration is centralized in [src/config.js](src/config.js):

```javascript
export const CONFIG = {
  version: '2.0.0',
  formFilling: {
    batchSize: 5,           // Concurrent API calls
    batchDelay: 200         // Delay between batches (ms)
  },
  ui: {
    buttonText: '🤖 Fyll formulär med AI',
    successResetDelay: 3000
  },
  openai: {
    maxWaitAttempts: 90,    // Max polling attempts
    pollInterval: 1000      // Poll every 1 second
  }
};
```

## 📚 Component Documentation

### FormDetector
Detects forms on web pages, including:
- Standard HTML forms
- HubSpot forms (iframe-embedded)
- Dynamically loaded forms (MutationObserver)
- Cross-frame communication

### FormFieldExtractor
Extracts field information using 7 different label detection methods:
1. Label `for` attribute
2. `aria-labelledby`
3. Input inside `<label>`
4. Sibling labels
5. Fieldset `<legend>`
6. HubSpot-specific wrappers
7. Parent container text

### FormFiller
Fills forms with parallel batch processing:
- Configurable batch size (default: 5 concurrent)
- Real-time progress callbacks
- Type-specific field handling (checkbox, number, text)
- Visual feedback (green flash on success)

### OpenAIClient
Handles OpenAI Assistant API communication:
- Thread management with vector store access
- Single field filling (progressive approach)
- JSON cleanup and parsing
- Robust error handling

### UIManager
Manages the floating action button:
- Auto-positioning (bottom-right)
- State management (idle, working, progress, success, error)
- Real-time text updates
- Auto-reset after completion

## 🔄 Version History

### v2.0.0 (Current) - Modular Architecture
- Fully componentized codebase
- ES6 modules with imports/exports
- Centralized configuration
- Improved documentation
- Integration guide for reuse

### v1.3.2 - UX Improvements
- Percentage-based progress (instead of "Batch X/Y")
- Real-time button updates after each field
- Number field validation fixes

### v1.3.0 - Performance Optimization
- Parallel processing (5 concurrent fields)
- Switched to gpt-4o-mini (4-5x faster)
- 60x cost reduction

### v1.2.x - Bug Fixes
- Fixed label detection for HubSpot forms
- Improved JSON parsing
- Better error handling

### v1.0.0 - Initial Release
- Basic form detection and filling
- OpenAI Assistant integration
- Sequential processing

## 🐛 Troubleshooting

### Forms not detected
- Check console for `🚀 AI Form Filler` messages
- HubSpot forms may take 5-10 seconds to appear
- Cross-origin iframes may be blocked by CORS

### Button not updating
- Check that extension has latest version
- Reload extension at `chrome://extensions/`
- Clear browser cache

### API errors
- Verify API key and Assistant ID in popup
- Check OpenAI API status
- Ensure assistant has vector stores attached

See [docs/DEBUGGING.md](docs/DEBUGGING.md) for detailed troubleshooting.

## 🔐 Security

- API keys stored in `chrome.storage.local` (user-specific)
- No API keys in source code or git
- Service worker runs in isolated context
- All API calls over HTTPS

## 📄 License

MIT License - Free to use and modify

## 🤝 Contributing

This is a modular, well-documented codebase designed for easy customization:

1. All components are in `src/core/`
2. Configuration is centralized in `src/config.js`
3. Each component has clear JSDoc comments
4. See `INTEGRATION.md` for usage examples

## 📞 Support

- **Issues**: GitHub Issues
- **Integration**: See [INTEGRATION.md](INTEGRATION.md)
- **Documentation**: See [docs/](docs/) folder

---

**Built with ❤️ using modular, reusable components**
