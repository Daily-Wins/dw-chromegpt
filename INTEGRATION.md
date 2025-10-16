# Integration Guide - AI Form Filler

This guide explains how to integrate the AI Form Filler components into your own Chrome extension.

## Architecture Overview

The codebase is now **fully modular** with clear separation of concerns:

```
src/
├── core/                    # Core business logic (reusable)
│   ├── FormDetector.js      # Form detection (iframes, HubSpot, etc.)
│   ├── FormFieldExtractor.js # Field extraction (7 label detection methods)
│   ├── FormFiller.js        # Parallel form filling with progress
│   └── OpenAIClient.js      # OpenAI Assistant API integration
├── ui/
│   └── UIManager.js         # Button management and UI updates
├── utils/
│   └── ChromeAPIBridge.js   # Chrome Extension API wrapper
├── config.js                # Centralized configuration
├── content.js               # Content script entry point
└── background.js            # Background worker entry point
```

## Integration Steps

### 1. Copy Core Components

Copy the files you need from `src/` to your extension:

```bash
# Copy all core components
cp -r src/core/ your-extension/src/

# Copy utilities
cp -r src/utils/ your-extension/src/

# Copy config (optional - you can customize)
cp src/config.js your-extension/src/
```

### 2. Basic Integration Example

Here's a minimal example of using the components:

```javascript
import { FormDetector } from './core/FormDetector.js';
import { FormFieldExtractor } from './core/FormFieldExtractor.js';
import { FormFiller } from './core/FormFiller.js';
import { OpenAIClient } from './core/OpenAIClient.js';

// 1. Detect forms
const detector = new FormDetector({
  version: '1.0.0',
  onFormsDetected: (forms) => {
    console.log(`Found ${forms.length} forms`);
  }
});

detector.initialize();

// 2. Extract fields
const extractor = new FormFieldExtractor({ version: '1.0.0' });
const forms = detector.getForms();
const fields = [];

forms.forEach(form => {
  const formFields = extractor.extractFields(form);
  fields.push(...formFields);
});

// 3. Initialize OpenAI client
const client = new OpenAIClient({
  version: '1.0.0',
  apiKey: 'your-api-key',
  assistantId: 'your-assistant-id'
});

// 4. Fill forms
const filler = new FormFiller({
  version: '1.0.0',
  batchSize: 5,
  apiClient: client,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  },
  onComplete: (result) => {
    console.log(`Complete: ${result.filled} filled, ${result.failed} failed`);
  }
});

await filler.fillFields(forms, fields);
```

### 3. Component Configuration

Each component accepts a configuration object:

#### FormDetector

```javascript
const detector = new FormDetector({
  version: '1.0.0',
  onFormsDetected: (forms) => {
    // Callback when forms are detected
  }
});
```

#### FormFieldExtractor

```javascript
const extractor = new FormFieldExtractor({
  version: '1.0.0'
});
```

#### FormFiller

```javascript
const filler = new FormFiller({
  version: '1.0.0',
  batchSize: 5,              // Number of concurrent requests
  apiClient: clientInstance,  // Must implement fillSingleField()
  onProgress: (progress) => {
    // Called after each field completes
    // progress = {percentage, completed, total, field}
  },
  onComplete: (result) => {
    // Called when all fields are done
    // result = {filled, failed, total}
  },
  onError: (error) => {
    // Called on error
  }
});
```

#### OpenAIClient

```javascript
const client = new OpenAIClient({
  version: '1.0.0',
  apiKey: 'sk-...',
  assistantId: 'asst_...',
  maxAttempts: 90  // Max polling attempts
});
```

#### UIManager

```javascript
const uiManager = new UIManager({
  version: '1.0.0',
  buttonClass: 'my-button-class',
  onClick: () => {
    // Button click handler
  }
});

// Create button
uiManager.createButton(formCount);

// Update states
uiManager.setWorking();
uiManager.setProgress(50, 5, 10);
uiManager.setSuccess(9, 1);
uiManager.setError('Error message');
uiManager.reset();
```

### 4. Custom API Client

If you're not using OpenAI, you can create a custom API client:

```javascript
class CustomAPIClient {
  async fillSingleField(fieldData) {
    // fieldData = {name, type, label, url}

    // Call your own API
    const response = await fetch('https://your-api.com/fill', {
      method: 'POST',
      body: JSON.stringify(fieldData)
    });

    const data = await response.json();

    // Must return {success, value}
    return {
      success: true,
      value: data.fieldValue
    };
  }
}

// Use with FormFiller
const filler = new FormFiller({
  apiClient: new CustomAPIClient(),
  // ...
});
```

### 5. Configuration Customization

Modify `src/config.js` to customize behavior:

```javascript
import { CONFIG, setConfig } from './config.js';

// Override specific values
setConfig({
  formFilling: {
    batchSize: 10,  // More concurrent requests
    batchDelay: 500 // Longer delay between batches
  },
  ui: {
    buttonText: '⚡ Auto-fill',  // Custom button text
    position: {
      bottom: '50px',
      right: '50px'
    }
  }
});
```

## Minimal Integration (Without UI)

If you only need the form detection and filling logic without the UI:

```javascript
import { FormDetector } from './core/FormDetector.js';
import { FormFieldExtractor } from './core/FormFieldExtractor.js';
import { FormFiller } from './core/FormFiller.js';

// Your custom API client
class MyAPIClient {
  async fillSingleField(fieldData) {
    // Your implementation
    return { success: true, value: 'filled value' };
  }
}

// Detect forms
const detector = new FormDetector({ version: '1.0.0' });
detector.initialize();

// Extract fields
const extractor = new FormFieldExtractor({ version: '1.0.0' });
const forms = detector.getForms();
const fields = forms.flatMap(form => extractor.extractFields(form));

// Fill forms
const filler = new FormFiller({
  version: '1.0.0',
  apiClient: new MyAPIClient(),
  onComplete: (result) => console.log('Done:', result)
});

await filler.fillFields(forms, fields);
```

## Chrome Extension Setup

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Your Extension",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content.js"],
    "all_frames": true,
    "type": "module"
  }],
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  }
}
```

**Important**: Use `"type": "module"` to enable ES6 imports.

### content.js (Entry Point)

```javascript
import { FormDetector } from './core/FormDetector.js';
import { UIManager } from './ui/UIManager.js';
// ... other imports

// Initialize your components
const detector = new FormDetector({
  onFormsDetected: (forms) => {
    uiManager.createButton(forms.length);
  }
});

detector.initialize();
```

### background.js (Service Worker)

```javascript
import { OpenAIClient } from './core/OpenAIClient.js';

const client = new OpenAIClient({ version: '1.0.0' });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FILL_FIELD') {
    client.setCredentials(request.apiKey, request.assistantId);
    client.fillSingleField(request.fieldData)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
```

## Testing

Each component can be tested independently:

```javascript
// Test FormDetector
const detector = new FormDetector({ version: '1.0.0' });
detector.findForms(); // Returns array of forms

// Test FormFieldExtractor
const extractor = new FormFieldExtractor({ version: '1.0.0' });
const fields = extractor.extractFields(document.querySelector('form'));
console.log(fields); // Array of {element, name, type, label}

// Test with mock API client
class MockAPIClient {
  async fillSingleField(fieldData) {
    return { success: true, value: 'test value' };
  }
}

const filler = new FormFiller({
  apiClient: new MockAPIClient(),
  onComplete: (result) => console.log(result)
});
```

## Dependencies

- **No external dependencies** - All code uses vanilla JavaScript
- **Chrome Extension API** - Requires Manifest V3
- **ES6 Modules** - Uses import/export syntax

## Browser Compatibility

- Chrome 91+ (ES6 modules in service workers)
- Edge 91+
- Opera 77+

## Performance Considerations

- **Batch Processing**: Default 5 concurrent API calls
- **Memory**: ~1-2MB per page (minimal footprint)
- **CPU**: Light - mostly I/O bound (waiting for API responses)

## Security Notes

- API keys are stored in `chrome.storage.local` (user-specific)
- No API keys in source code
- All API calls over HTTPS
- Content scripts run in isolated context

## Support

For issues or questions about integration:
1. Check the component source code (well-documented)
2. Review `src/content.js` for working example
3. See `docs/` for additional documentation

## License

MIT License - Free to use and modify
