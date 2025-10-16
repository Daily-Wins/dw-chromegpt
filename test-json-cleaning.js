/**
 * Manual test for JSON cleaning improvements
 * Run with: node test-json-cleaning.js
 */

class OpenAIClientTest {
  _cleanJsonString(str) {
    const debug = false; // Set to true for detailed logging

    // Remove markdown code blocks
    str = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    if (debug) console.log('After markdown removal:', str);

    // Replace smart quotes with regular quotes
    str = str.replace(/[""]/g, '"').replace(/['']/g, "'");
    if (debug) console.log('After quote replacement:', str);

    // Remove citation markers like 【4:7†source】
    str = str.replace(/【[^】]*】/g, '');
    if (debug) console.log('After citation removal:', str);

    // Remove JavaScript comments (but not // in URLs like https://)
    // Only match // that's preceded by whitespace or at start of line
    str = str.replace(/(^|\s)\/\/[^\n]*/gm, '$1');
    if (debug) console.log('After comment removal:', str);

    // Remove trailing commas before closing braces/brackets
    str = str.replace(/,(\s*[}\]])/g, '$1');
    if (debug) console.log('After trailing comma removal:', str);

    // Remove newlines and tabs
    str = str.replace(/[\r\n\t]+/g, ' ');
    if (debug) console.log('After newline removal:', str);

    // Compress whitespace
    str = str.replace(/\s+/g, ' ');
    if (debug) console.log('After whitespace compression:', str);

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
        // Try to close unclosed object
        str = str + '}';
      }
    }

    return str;
  }

  _extractValueFallback(text, fieldName) {
    try {
      // Try to find: "fieldName": "value" or "fieldName": value
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
        // Loose format: fieldName: value with quotes
        new RegExp(`${fieldName}\\s*:\\s*"([^"]*)"`, 'i'),
        // Loose format: fieldName: value without quotes
        new RegExp(`${fieldName}\\s*:\\s*([^,}\\s]+)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          let value = match[1].trim();
          // Remove leading/trailing quotes if present
          value = value.replace(/^["']|["']$/g, '');
          // Parse boolean and null
          if (value === 'true') return true;
          if (value === 'false') return false;
          if (value === 'null') return null;
          // Parse numbers
          if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
          return value;
        }
      }

      return null;
    } catch (error) {
      console.error('[OpenAIClient] Fallback extraction error:', error);
      return null;
    }
  }

  testCase(name, input, fieldName, expectedValue) {
    console.log(`\n=== ${name} ===`);
    console.log('Input:', input);

    try {
      const cleaned = this._cleanJsonString(input);
      console.log('Cleaned:', cleaned);

      const parsed = JSON.parse(cleaned);
      const value = parsed[fieldName];
      console.log('Parsed value:', value);

      if (value === expectedValue) {
        console.log('✅ PASS');
        return true;
      } else {
        console.log(`❌ FAIL: Expected "${expectedValue}", got "${value}"`);
        return false;
      }
    } catch (error) {
      console.log('JSON parse failed:', error.message);
      console.log('Trying fallback extraction...');

      const fallbackValue = this._extractValueFallback(input, fieldName);
      console.log('Fallback value:', fallbackValue);

      if (fallbackValue === expectedValue) {
        console.log('✅ PASS (via fallback)');
        return true;
      } else {
        console.log(`❌ FAIL: Expected "${expectedValue}", got "${fallbackValue}"`);
        return false;
      }
    }
  }
}

// Run tests
const tester = new OpenAIClientTest();

const tests = [
  {
    name: 'Normal JSON',
    input: '{"website": "https://example.com"}',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'Unterminated string',
    input: '{"website": "https://example.com}',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'With markdown code block',
    input: '```json\n{"website": "https://example.com"}\n```',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'With extra text before',
    input: 'Here is the data: {"website": "https://example.com"}',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'With trailing comma',
    input: '{"website": "https://example.com",}',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'With smart quotes',
    input: '{"website": "https://example.com"}',
    field: 'website',
    expected: 'https://example.com'
  },
  {
    name: 'Boolean value',
    input: '{"active": true}',
    field: 'active',
    expected: true
  },
  {
    name: 'Number value',
    input: '{"year": 2024}',
    field: 'year',
    expected: 2024
  },
  {
    name: 'Null value',
    input: '{"unknown": null}',
    field: 'unknown',
    expected: null
  },
  {
    name: 'Completely malformed but extractable',
    input: 'The website is: website: "https://example.com" and that is it',
    field: 'website',
    expected: 'https://example.com'
  }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  if (tester.testCase(test.name, test.input, test.field, test.expected)) {
    passed++;
  } else {
    failed++;
  }
});

console.log('\n===================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('===================\n');
