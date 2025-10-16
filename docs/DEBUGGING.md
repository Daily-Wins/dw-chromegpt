# Debugging Guide for AI Form Filler Extension

## Current Issue

The extension cannot detect the HubSpot form on AI Sweden's startup application page.

## Key Findings

### Form Details
- **Form Type**: HubSpot dynamically loaded form
- **Form ID**: `3ab2f4a2-1b54-45b4-8534-53d583b384d3`
- **Portal ID**: `27153619`
- **Region**: `eu1`
- **Loading Method**: `hbspt.forms.create()` JavaScript method

### What Works
✅ Extension loads in all frames (top + iframes)
✅ Button appears and is clickable
✅ Communication with OpenAI API works
✅ Assistant returns data
✅ Can detect and fill simple forms (language selector, search)

### What Doesn't Work
❌ Main HubSpot application form not detected
❌ Forms with many fields (Company name, Founding year, etc.) not found

## Latest Improvements (2025-10-15)

### 1. Extended Polling
Added multiple delayed checks to catch slow-loading forms:
```javascript
setTimeout(findForms, 2000);
setTimeout(findForms, 4000);
setTimeout(findForms, 6000);
setTimeout(findForms, 8000);
setTimeout(findForms, 10000);
setTimeout(findForms, 15000);
setTimeout(findForms, 20000);
```

### 2. HubSpot XHR Detection
Intercepts HubSpot API calls to trigger form search:
```javascript
XMLHttpRequest.prototype.open intercepts hsforms.com calls
Logs: 🔔 HubSpot XHR detected
Automatically triggers form search 2s and 5s after XHR completes
```

### 3. HubSpot Container Search
New `checkForHubSpotForm()` function that:
- Searches for: `[class*="hbspt"]`, `[class*="hs-form"]`, `[id^="hsForm"]`, etc.
- Checks all iframes for HubSpot sources
- Logs container details and whether they contain forms
- Runs at 3s, 5s, 10s, and 15s after page load

### 4. Enhanced Logging
Each form now logs:
- Form ID and class name
- Form action URL
- Number of visible fields
- Details of each field (name, type, id)
- HubSpot container structure
- Iframe sources and HubSpot indicators

## How to Test

1. **Reload extension**:
   ```bash
   # Go to chrome://extensions/
   # Click reload on "AI Form Filler MVP"
   ```

2. **Visit test page**:
   ```
   https://www.ai.se/sv/ekosystem/startup-programmet/startup-programmet-ansok-till-steg-1
   ```

3. **Open DevTools Console** and look for:
   ```
   🚀 AI Form Filler (Top/Iframe)
   🔔 HubSpot form container upptäckt!
   🔔 Nya formulär upptäckta...
   Form 1: X synliga fält {id: ..., fields: [...]}
   ```

4. **Wait 10 seconds** for all polling to complete

5. **Check console** for detailed form information

## Expected Console Output

If working correctly:
```
🚀 AI Form Filler (Top)
  Totalt X formulär innan filtrering
    Form 1: 2 synliga fält {id: "search-form", ...}
    Form 2: 15 synliga fält {id: "hsForm_...", ...}  ← THIS IS WHAT WE WANT
Hittade 2 relevanta formulär i denna frame
```

## Troubleshooting

### If still not detecting form:

1. **Check if form is in iframe**:
   - Open DevTools → Elements tab
   - Search for "Company name" or "Founding year"
   - Check if parent is an `<iframe>` element

2. **Check iframe origin**:
   - If iframe is cross-origin (different domain), CORS may block access
   - Look for errors like "Blocked a frame with origin..."

3. **Manual form inspection**:
   - In console, run: `document.querySelectorAll('form')`
   - Check if HubSpot form appears in list
   - Note: May not work if form is in cross-origin iframe

4. **Check HubSpot loading**:
   - In console, run: `typeof hbspt`
   - Should return "object" if HubSpot loaded
   - Check Network tab for `forms.hsforms.com` requests

## Next Steps if Still Failing

1. Use Browser MCP to directly inspect the page
2. Check if form loads after user interaction (scroll, click)
3. Consider alternative approach: inject script into iframe context
4. Check if HubSpot form uses Shadow DOM (would hide form elements)

## Files Modified

- [content.js](content.js) - Enhanced form detection and logging
- [background.js](background.js) - OpenAI API integration
- [manifest.json](manifest.json) - Added `all_frames: true`
