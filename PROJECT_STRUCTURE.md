# Project Structure - AI Form Filler v2.0.0

## Overview

This project has been refactored into a **fully modular architecture** with clean separation of concerns.

## Directory Layout

```
dw-chromegpt/
├── src/                          # Source code (modular components)
│   ├── core/                     # Core business logic (reusable)
│   │   ├── FormDetector.js       # Detects forms (iframes, HubSpot, dynamic)
│   │   ├── FormFieldExtractor.js # Extracts fields with 7 label methods
│   │   ├── FormFiller.js         # Parallel filling with progress tracking
│   │   └── OpenAIClient.js       # OpenAI Assistant API integration
│   ├── ui/                       # User interface components
│   │   └── UIManager.js          # Button management and state updates
│   ├── utils/                    # Utility functions
│   │   └── ChromeAPIBridge.js    # Chrome Extension API wrapper
│   ├── config.js                 # Centralized configuration
│   ├── content.js                # Content script entry point (uses modules)
│   └── background.js             # Background worker entry point (uses modules)
│
├── setup/                        # Setup scripts
│   ├── setup-assistant.js        # Create OpenAI assistant with RAG
│   └── update-assistant.js       # Update existing assistant
│
├── docs/                         # Documentation
│   ├── CLAUDE.md                 # Claude Code instructions
│   ├── CALL_GRAPH.md             # Execution flow diagram
│   ├── PERFORMANCE_IMPROVEMENTS.md
│   ├── DEBUGGING.md              # Troubleshooting guide
│   └── ... (other docs)
│
├── archive/                      # Old versions (pre-refactor)
│   ├── background.js             # Old monolithic background script
│   ├── content.js                # Old monolithic content script
│   ├── content-old.js
│   ├── content-old-v2.js
│   └── content-iframe.js
│
├── manifest.json                 # Chrome Extension manifest (v3)
├── popup.html                    # Extension popup UI
├── popup.js                      # Popup logic (settings)
├── styles.css                    # UI styles
├── package.json                  # Node.js dependencies
├── README.md                     # Main documentation
├── INTEGRATION.md                # Integration guide for reuse
└── PROJECT_STRUCTURE.md          # This file
```

## Key Changes from v1.x

### Before (v1.x - Monolithic)

- **content.js**: 760 lines, all functionality in one file
- **background.js**: 490 lines, all API logic in one file
- Hard to test, hard to reuse, hard to understand
- No clear separation of concerns

### After (v2.0 - Modular)

- **FormDetector.js**: 220 lines, form detection logic only
- **FormFieldExtractor.js**: 170 lines, label extraction only
- **FormFiller.js**: 140 lines, filling logic only
- **OpenAIClient.js**: 230 lines, API communication only
- **UIManager.js**: 130 lines, UI state management only
- **content.js**: 80 lines, just orchestration
- **background.js**: 50 lines, just message routing

### Benefits

✅ **Reusable**: Each component can be used independently
✅ **Testable**: Components have clear inputs/outputs
✅ **Maintainable**: Changes isolated to single files
✅ **Documented**: JSDoc comments on all public methods
✅ **Configurable**: Centralized config file
✅ **Portable**: Easy to integrate into other extensions

## Component Dependencies

```
content.js
├── config.js
├── FormDetector
│   └── (no dependencies)
├── FormFieldExtractor
│   └── (no dependencies)
├── FormFiller
│   ├── ChromeAPIBridge (for messaging)
│   └── apiClient (injected)
├── UIManager
│   └── (no dependencies)
└── ChromeAPIBridge
    └── (no dependencies)

background.js
├── config.js
└── OpenAIClient
    └── (no dependencies, uses fetch)
```

## File Sizes (v2.0 vs v1.3)

| File | v1.3 | v2.0 | Change |
|------|------|------|--------|
| content.js | 26 KB | 3 KB | -88% |
| background.js | 19 KB | 2 KB | -89% |
| **Total monolithic** | **45 KB** | - | - |
| **Total modular** | - | **25 KB** | -44% |

The modular version is **smaller** despite having more files, because:
- No code duplication
- Better tree-shaking potential
- Clear separation removes dead code

## Integration Points

For integrating into your own extension:

1. **Copy `src/core/` directory** → Get all business logic
2. **Copy `src/config.js`** → Customize configuration
3. **Optional: Copy `src/ui/`** → If you want the button UI
4. **Optional: Copy `src/utils/`** → If using Chrome Extension API

See [INTEGRATION.md](INTEGRATION.md) for detailed guide.

## Configuration

All configuration is in `src/config.js`:

- Form detection settings (delays, filters)
- Form filling settings (batch size, delays)
- OpenAI API settings (timeouts, retries)
- UI settings (button text, position, colors)
- Logging settings

## Version History

- **v2.0.0**: Modular architecture refactor
- **v1.3.2**: UX improvements (percentage progress)
- **v1.3.0**: Performance optimization (parallel + gpt-4o-mini)
- **v1.2.x**: Bug fixes and improvements
- **v1.0.0**: Initial release

## Migration Guide

If you have v1.x installed:

1. Backup your API key and Assistant ID from popup
2. Go to `chrome://extensions/`
3. Remove old extension
4. Click "Load unpacked" and select new `dw-chromegpt` directory
5. Enter API key and Assistant ID again

The new version is **100% compatible** with existing assistants.

## Development Workflow

```bash
# Install dependencies
npm install

# Create OpenAI assistant
export OPENAI_API_KEY="sk-..."
npm run setup

# Load extension in Chrome
# 1. chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked → select directory

# Make changes to src/ files
# Reload extension at chrome://extensions/

# Update assistant (if needed)
npm run update
```

## Testing

Each component can be tested independently:

```javascript
// Test FormDetector
import { FormDetector } from './src/core/FormDetector.js';
const detector = new FormDetector({ version: '1.0.0' });
const forms = detector.findForms();

// Test FormFieldExtractor
import { FormFieldExtractor } from './src/core/FormFieldExtractor.js';
const extractor = new FormFieldExtractor({ version: '1.0.0' });
const fields = extractor.extractFields(document.querySelector('form'));

// Test with mock API
class MockAPIClient {
  async fillSingleField(fieldData) {
    return { success: true, value: 'test' };
  }
}
```

## Architecture Principles

1. **Single Responsibility**: Each component does one thing well
2. **Dependency Injection**: Components receive dependencies, don't create them
3. **Interface Segregation**: Small, focused interfaces
4. **Configuration over Code**: Behavior controlled by config.js
5. **Documentation**: JSDoc on all public methods
6. **No Side Effects**: Pure functions where possible

## Future Enhancements

Potential additions (without breaking modularity):

- `src/core/FormCache.js` - Cache filled values
- `src/core/TemplateManager.js` - Pre-configured form templates
- `src/utils/Analytics.js` - Track success rates
- `src/ui/ChatWidget.js` - Interactive chat interface
- `src/integrations/SharePoint.js` - Sync documents from SharePoint

---

**Architecture by: Claude Code**
**Date: 2025-10-16**
**Version: 2.0.0**
