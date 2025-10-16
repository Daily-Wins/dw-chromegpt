/**
 * OpenAIClient - Handles communication with OpenAI Assistant API
 *
 * Features:
 * - Thread management with vector store access
 * - Single field filling (progressive approach)
 * - JSON cleanup and parsing
 * - Robust error handling
 * - Polling for completion with timeout
 *
 * @module OpenAIClient
 */

export class OpenAIClient {
  constructor(config = {}) {
    this.version = config.version || '1.0.0';
    this.apiKey = config.apiKey;
    this.assistantId = config.assistantId;
    this.maxAttempts = config.maxAttempts || 90;
  }

  /**
   * Set API credentials
   * @param {string} apiKey - OpenAI API key
   * @param {string} assistantId - Assistant ID
   */
  setCredentials(apiKey, assistantId) {
    this.apiKey = apiKey;
    this.assistantId = assistantId;
  }

  /**
   * Fill a single field with AI-generated value
   * @param {Object} fieldData - Field information {name, type, label, url}
   * @returns {Promise<Object>} Response with {success, value}
   */
  async fillSingleField(fieldData) {
    console.log(`[OpenAIClient] Filling field: ${fieldData.name}`);

    if (!this.apiKey || !this.assistantId) {
      throw new Error('API credentials not configured');
    }

    // Create thread with vector store access
    const thread = await this._createThreadWithFiles();
    const threadId = thread.id;

    // Create focused prompt for single field
    const prompt = this._buildSingleFieldPrompt(fieldData);

    // Send message
    await this._addMessage(threadId, prompt);

    // Run assistant
    const run = await this._runAssistant(threadId);

    // Wait for completion
    await this._waitForCompletion(threadId, run.id, 30);

    // Get and parse response
    const messages = await this._getMessages(threadId);
    let assistantMessage = messages.data[0].content[0].text.value;

    // Log raw response for debugging
    console.log(`[OpenAIClient] Raw response for ${fieldData.name}:`, assistantMessage);

    // Clean and parse JSON with error handling
    try {
      assistantMessage = this._cleanJsonString(assistantMessage);
      console.log(`[OpenAIClient] Cleaned JSON for ${fieldData.name}:`, assistantMessage);
      const data = JSON.parse(assistantMessage);
      const value = data[fieldData.name];

      console.log(`[OpenAIClient] Got value for ${fieldData.name}:`, value);
      return { success: true, value };
    } catch (parseError) {
      console.error(`[OpenAIClient] JSON parse error for ${fieldData.name}:`, parseError.message);
      console.error(`[OpenAIClient] Failed to parse:`, assistantMessage);

      // Try fallback: extract just the value directly
      const fallbackValue = this._extractValueFallback(assistantMessage, fieldData.name);
      if (fallbackValue !== null) {
        console.log(`[OpenAIClient] Fallback extraction succeeded for ${fieldData.name}:`, fallbackValue);
        return { success: true, value: fallbackValue };
      }

      return { success: false, error: `JSON parse failed: ${parseError.message}` };
    }
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Build prompt for single field
   * @private
   */
  _buildSingleFieldPrompt(fieldData) {
    return `Analysera detta formulärfält och returnera ENDAST värdet som ska fyllas i, baserat på företagsdokumenten.

FÄLT ATT FYLLA:
Fältnamn: "${fieldData.name}"
Typ: ${fieldData.type}
Beskrivning: ${fieldData.label}
URL: ${fieldData.url}

INSTRUKTIONER:
- Läs beskrivningen noggrant för att förstå vad fältet vill ha
- Sök i dokumenten efter relevant information
- Returnera ENDAST ett enkelt JSON-objekt med fältnamnet som nyckel
- För checkboxes: returnera true eller false
- För textfält: returnera textvärdet (utan newlines)
- Om information saknas: returnera null

SVARFORMAT:
{"${fieldData.name}": "värde här"}

Returnera nu JSON-objektet:`;
  }

  /**
   * Clean JSON string from markdown, quotes, citations, etc.
   * @private
   */
  _cleanJsonString(str) {
    // Remove markdown code blocks
    str = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Replace smart quotes with regular quotes
    str = str.replace(/[""]/g, '"').replace(/['']/g, "'");

    // Remove citation markers like 【4:7†source】
    str = str.replace(/【[^】]*】/g, '');

    // Remove JavaScript comments (but not // in URLs like https://)
    // Only match // that's preceded by whitespace or at start of line
    str = str.replace(/(^|\s)\/\/[^\n]*/gm, '$1');

    // Remove trailing commas before closing braces/brackets
    str = str.replace(/,(\s*[}\]])/g, '$1');

    // Remove newlines and tabs
    str = str.replace(/[\r\n\t]+/g, ' ');

    // Compress whitespace
    str = str.replace(/\s+/g, ' ');

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

  /**
   * Fallback method to extract value when JSON parsing fails
   * Uses regex to find the field value in the response
   * @private
   */
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

  /**
   * Get assistant information
   * @private
   */
  async _getAssistant() {
    const response = await fetch(`https://api.openai.com/v1/assistants/${this.assistantId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get assistant: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create thread with vector store access
   * @private
   */
  async _createThreadWithFiles() {
    // Get assistant to find vector stores
    const assistant = await this._getAssistant();
    const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];

    console.log('[OpenAIClient] Creating thread with vector stores:', vectorStoreIds);

    if (vectorStoreIds.length === 0) {
      console.warn('[OpenAIClient] No vector stores found on assistant!');
    }

    // Create thread with vector store access
    const body = {
      tool_resources: {
        file_search: {
          vector_store_ids: vectorStoreIds
        }
      }
    };

    const response = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[OpenAIClient] Thread created:', result.id);
    return result;
  }

  /**
   * Add message to thread
   * @private
   */
  async _addMessage(threadId, content) {
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: content
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add message: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Run assistant on thread
   * @private
   */
  async _runAssistant(threadId) {
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: this.assistantId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to run assistant: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Wait for run completion
   * @private
   */
  async _waitForCompletion(threadId, runId, maxAttempts = null) {
    const attempts = maxAttempts || this.maxAttempts;

    for (let i = 0; i < attempts; i++) {
      const response = await fetch(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check run status: ${response.statusText}`);
      }

      const run = await response.json();

      if (run.status === 'completed') {
        return run;
      }

      if (run.status === 'failed' || run.status === 'cancelled') {
        throw new Error(`Run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
      }

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout: Assistant did not respond in time');
  }

  /**
   * Get messages from thread
   * @private
   */
  async _getMessages(threadId) {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return await response.json();
  }
}
