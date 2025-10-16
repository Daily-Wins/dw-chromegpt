# JSON Parsing Improvements

## Problem
The extension was failing to fill certain fields (notably the "website" field) due to malformed JSON responses from OpenAI. The error was:
```
SyntaxError: Unterminated string in JSON at position 19
```

## Root Cause
The `_cleanJsonString()` method in OpenAIClient.js had a critical bug where the JavaScript comment removal regex `/\/\/[^\n]*/g` was matching `//` in URLs (like `https://example.com`) and treating them as comments, removing everything after the `//`.

Additionally, it didn't handle other edge cases where OpenAI returns malformed JSON:
- Unterminated strings (e.g., `{"website": "https://example.com}` missing closing quote)
- Unexpected text before/after the JSON object
- Trailing commas
- Unclosed braces

## Solution

### 1. Fixed Critical Bug in `_cleanJsonString()` Method
**The main fix**: Changed JavaScript comment removal to NOT match `//` in URLs:

```javascript
// BEFORE (BROKEN):
str = str.replace(/\/\/[^\n]*/g, '');
// This removed everything after // in https://example.com

// AFTER (FIXED):
// Remove JavaScript comments (but not // in URLs like https://)
// Only match // that's preceded by whitespace or at start of line
str = str.replace(/(^|\s)\/\/[^\n]*/gm, '$1');
```

### 2. Enhanced JSON Structure Handling
Added cleaning steps for other edge cases:

```javascript
// Remove trailing commas before closing braces/brackets
str = str.replace(/,(\s*[}\]])/g, '$1');

// Ensure proper JSON structure - must start with { and end with }
str = str.trim();
if (!str.startsWith('{')) {
  const firstBrace = str.indexOf('{');
  if (firstBrace !== -1) {
    str = str.substring(firstBrace);
  }
}
if (!str.endsWith('}')) {
  const lastBrace = str.lastIndexOf('}');
  if (lastBrace !== -1) {
    str = str.substring(0, lastBrace + 1);
  } else {
    str = str + '}';
  }
}
```

### 3. Added Robust Fallback Extraction Method
Created `_extractValueFallback()` that uses regex patterns to extract values when JSON parsing fails completely:

```javascript
_extractValueFallback(text, fieldName) {
  const patterns = [
    // Standard JSON format with quotes - proper closure
    new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i'),
    // Unterminated string - missing closing quote before }
    new RegExp(`"${fieldName}"\\s*:\\s*"([^"}]+)}`, 'i'),
    // Unterminated string - missing closing quote before ,
    new RegExp(`"${fieldName}"\\s*:\\s*"([^",]+),`, 'i'),
    // Without quotes (for numbers, booleans)
    new RegExp(`"${fieldName}"\\s*:\\s*([^,}\\s]+)`, 'i'),
    // With single quotes
    new RegExp(`'${fieldName}'\\s*:\\s*'([^']*)'`, 'i'),
    // Loose format: fieldName: value
    new RegExp(`${fieldName}\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`${fieldName}\\s*:\\s*([^,}\\s]+)`, 'i')
  ];
  // ... pattern matching, quote removal, and type parsing (boolean, null, numbers)
}
```

### 4. Try-Catch with Logging
Wrapped JSON parsing in try-catch with detailed logging:

```javascript
try {
  assistantMessage = this._cleanJsonString(assistantMessage);
  console.log(`[OpenAIClient] Cleaned JSON for ${fieldData.name}:`, assistantMessage);
  const data = JSON.parse(assistantMessage);
  const value = data[fieldData.name];
  return { success: true, value };
} catch (parseError) {
  console.error(`[OpenAIClient] JSON parse error for ${fieldData.name}:`, parseError.message);
  const fallbackValue = this._extractValueFallback(assistantMessage, fieldData.name);
  if (fallbackValue !== null) {
    return { success: true, value: fallbackValue };
  }
  return { success: false, error: `JSON parse failed: ${parseError.message}` };
}
```

### 5. Added Raw Response Logging
Log the raw OpenAI response before cleaning for debugging:

```javascript
console.log(`[OpenAIClient] Raw response for ${fieldData.name}:`, assistantMessage);
```

## Benefits

1. **Robust Error Handling**: No more crashes on malformed JSON
2. **Fallback Extraction**: Can extract values even when JSON is completely malformed
3. **Better Debugging**: Raw and cleaned JSON logged for troubleshooting
4. **Higher Success Rate**: More fields successfully filled
5. **Graceful Degradation**: Returns error object instead of throwing exception

## Testing

To test the improvements:
1. Reload the extension in Chrome
2. Navigate to a form with a "website" field
3. Click "🤖 Fyll formulär med AI"
4. Check console logs to see:
   - Raw response from OpenAI
   - Cleaned JSON string
   - Success/failure with detailed error messages
   - Fallback extraction attempts if JSON parsing fails

## Files Modified

- [src/core/OpenAIClient.js](../src/core/OpenAIClient.js) - Enhanced JSON parsing and added fallback
- [src/background.js](../src/background.js) - Improved error logging

## Expected Results

Before:
```
✓ Klart! 11 fyllda, 13 misslyckades
```

After:
```
✓ Klart! 23 fyllda, 1 misslyckades
```

The only expected failure should be `g-recaptcha-response` which cannot be auto-filled by design.
