# AI Form Filler - Call Graph & Button States

## Overview
This document shows the complete execution flow from button click to form completion, including all function calls and button state transitions.

---

## 1. User Clicks Button

**Button State:** `🤖 Fyll formulär med AI`

```
User clicks button
    ↓
handleClick() [content.js:134]
```

---

## 2. Initial Setup & Field Extraction

**Button State:** `⏳ Arbetar...`

```javascript
handleClick()
├── Set button.disabled = true
├── button.textContent = '⏳ Arbetar...'
│
├── Get forms from current frame
│   └── allForms = formsInFrame
│
└── Extract all fields from all forms
    │
    ├── forEach form in allForms
    │   ├── extractFormFields(form) [content.js:248]
    │   │   ├── querySelectorAll('input, select, textarea')
    │   │   ├── Filter out hidden/submit/button types
    │   │   └── For each input:
    │   │       ├── Find label (7 methods)
    │   │       │   ├── Method 1: label[for="id"]
    │   │       │   ├── Method 2: aria-labelledby
    │   │       │   ├── Method 3: parent label
    │   │       │   ├── Method 4: sibling label
    │   │       │   ├── Method 5: fieldset legend
    │   │       │   ├── Method 6: HubSpot wrapper
    │   │       │   └── Method 7: parent containers
    │   │       └── Return {element, name, type, label}
    │   │
    │   └── Store fields with form reference
    │
    └── allFields[] contains all fields from all forms
```

**Console Output:**
```
📋 Processing 1 forms with PROGRESSIVE filling...
📊 Total fields to fill: 24
🚀 Using parallel processing: 5 fields at a time
```

---

## 3. Parallel Batch Processing Loop

**Button State:** `⏳ Batch X/Y (N fält)...`

```javascript
BATCH_SIZE = 5
totalBatches = Math.ceil(allFields.length / BATCH_SIZE)

For each batch (batchStart = 0; batchStart < allFields.length; batchStart += BATCH_SIZE):
    │
    ├── batch = allFields.slice(batchStart, batchStart + BATCH_SIZE)
    ├── button.textContent = `⏳ Batch ${batchNum}/${totalBatches} (${batch.length} fält)...`
    │
    └── Process 5 fields concurrently with Promise.all()
        │
        └── For each field in batch (parallel execution):
            │
            ├── Send message to background worker
            │   ├── chrome.runtime.sendMessage({
            │   │       type: 'FILL_SINGLE_FIELD',
            │   │       fieldData: {name, type, label, url}
            │   │   })
            │   │
            │   └── Background Worker Processes Request (see Section 4)
            │
            ├── Wait for response (max 60 seconds)
            │
            ├── Fill field with response value
            │   ├── Check field type:
            │   │   ├── If checkbox: element.checked = value
            │   │   ├── If number: extract first digit, element.value = digit
            │   │   └── Else: element.value = value
            │   │
            │   ├── Dispatch events:
            │   │   ├── new Event('input', {bubbles: true})
            │   │   └── new Event('change', {bubbles: true})
            │   │
            │   └── Visual feedback:
            │       ├── element.style.background = '#e8f5e9' (green)
            │       └── setTimeout(() => clear background, 3000)
            │
            └── Return {success: true/false, field}
```

**Console Output (per field):**
```
[1/24] Starting: company (Company name*)
[2/24] Starting: 0-2/founding_year (Founding year*)
...
✅ [1/24] Filled company with: Daily Wins AB
✅ [2/24] Filled 0-2/founding_year with: 2025
🔢 [6] Converted "1–4" -> "1" for number field
✅ [6/24] Filled 0-2/numberofemployees with: 1
```

**After batch completes:**
```
✓ Batch 1 complete: 5/5 succeeded
```

---

## 4. Background Worker: AI Processing

**File:** background.js

```javascript
chrome.runtime.onMessage.addListener() [background.js:4]
    ├── Receive 'FILL_SINGLE_FIELD' message
    │   └── fieldData: {name, type, label, url}
    │
    └── fillSingleField(fieldData) [background.js:184]
        │
        ├── Get config from storage
        │   └── chrome.storage.local.get(['apiKey', 'assistantId'])
        │
        ├── createThreadWithFiles(apiKey, assistantId) [background.js:278]
        │   ├── getAssistant(apiKey, assistantId) [background.js:268]
        │   │   └── GET /v1/assistants/{assistantId}
        │   │       └── Returns assistant with vector_store_ids
        │   │
        │   └── Create thread with vector stores
        │       └── POST /v1/threads
        │           body: {
        │               tool_resources: {
        │                   file_search: {
        │                       vector_store_ids: [...]
        │                   }
        │               }
        │           }
        │
        ├── Build prompt for single field
        │   └── Template:
        │       "Analysera detta formulärfält...
        │        FÄLT ATT FYLLA:
        │        Fältnamn: {name}
        │        Typ: {type}
        │        Beskrivning: {label}
        │
        │        SVARFORMAT:
        │        {'{name}': 'värde här'}"
        │
        ├── Send message to thread
        │   └── POST /v1/threads/{threadId}/messages
        │       body: {
        │           role: 'user',
        │           content: prompt
        │       }
        │
        ├── Run assistant
        │   └── POST /v1/threads/{threadId}/runs
        │       body: {
        │           assistant_id: assistantId
        │           // Uses gpt-4o-mini model
        │           // Uses file_search tool to search vector store
        │       }
        │
        ├── waitForCompletion(apiKey, threadId, runId, maxAttempts=30) [background.js:451]
        │   └── Poll every 1 second (max 30 times):
        │       ├── GET /v1/threads/{threadId}/runs/{runId}
        │       ├── Check status:
        │       │   ├── 'completed' → break
        │       │   ├── 'failed' → throw error
        │       │   └── 'queued'/'in_progress' → wait 1s, continue
        │       └── Returns when completed or throws timeout
        │
        ├── getMessages(apiKey, threadId) [background.js:477]
        │   └── GET /v1/threads/{threadId}/messages
        │       └── Returns latest assistant message
        │
        ├── Clean JSON response [background.js:255-258]
        │   ├── Remove markdown: ```json ... ```
        │   ├── Replace smart quotes: "" → "
        │   ├── Remove citations: 【4:7†source】
        │   └── Remove newlines/tabs
        │
        ├── Parse JSON
        │   └── data = JSON.parse(cleanedMessage)
        │
        └── Extract field value
            └── value = data[fieldData.name]
            └── Return {success: true, value}
```

**Console Output:**
```
[Background v1.3.1] Meddelande mottaget: FILL_SINGLE_FIELD
[Background] Startar fillSingleField för: company
[SingleField v1.3.1] Starting for field: company
[Background] Getting assistant vector stores...
[Background] Assistant vector stores: ['vs_68ef...']
[Background] Thread created with vector stores: thread_Nvt7...
[SingleField] Got value for company: Daily Wins AB
[Background] fillSingleField lyckades: {success: true, value: 'Daily Wins AB'}
```

---

## 5. Batch Completion & Next Batch

```javascript
After Promise.all() completes for batch:
    ├── Count successes and failures
    │   └── results.forEach(r => r.success ? filled++ : failed++)
    │
    ├── Log batch summary
    │   └── console.log(`✓ Batch ${batchNum} complete: X/Y succeeded`)
    │
    ├── Small delay between batches
    │   └── await new Promise(resolve => setTimeout(resolve, 200))
    │
    └── Loop to next batch
```

---

## 6. Final Completion

**Button State:** `✓ Klart! X fyllda, Y misslyckades` (green background)

```javascript
After all batches complete:
    │
    ├── button.textContent = `✓ Klart! ${filled} fyllda, ${failed} misslyckades`
    ├── button.style.background = '#4CAF50' (green)
    │
    ├── Log summary
    │   └── console.log(`✅ SUMMARY: ${filled} filled, ${failed} failed out of ${allFields.length} total`)
    │
    ├── Delay 3 seconds
    │   └── setTimeout(() => {
    │           button.textContent = originalText  // Reset to "🤖 Fyll formulär med AI"
    │           button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    │       }, 3000)
    │
    └── button.disabled = false
```

---

## Button State Transitions Summary

| State | Button Text | Background | When |
|-------|-------------|------------|------|
| **Initial** | `🤖 Fyll formulär med AI` | Purple gradient | Ready to click |
| **Working** | `⏳ Arbetar...` | Purple gradient | Just clicked, extracting fields |
| **Processing Batch** | `⏳ Batch 1/5 (5 fält)...` | Purple gradient | Processing batch N |
| **Success** | `✓ Klart! 23 fyllda, 1 misslyckades` | Green `#4CAF50` | All batches complete |
| **Error** | `❌ Fel` | Red `#f44336` | Fatal error occurred |
| **Reload Needed** | `🔄 Ladda om sidan` | Orange `#FF9800` | Extension context invalid |

---

## OpenAI API Call Sequence (Per Field)

```
1. GET /v1/assistants/{assistantId}
   ↓
2. POST /v1/threads
   body: {tool_resources: {file_search: {vector_store_ids: [...]}}}
   ↓
3. POST /v1/threads/{threadId}/messages
   body: {role: 'user', content: 'Analysera detta formulärfält...'}
   ↓
4. POST /v1/threads/{threadId}/runs
   body: {assistant_id: assistantId}
   ↓
5. GET /v1/threads/{threadId}/runs/{runId}  [Poll every 1s, max 30x]
   status: 'queued' → 'in_progress' → 'completed'
   ↓
6. GET /v1/threads/{threadId}/messages
   ↓
7. Parse response → Extract value → Return to content.js
```

**Total API calls per field:** 6 + (N polling attempts)
**Typical polling attempts:** 3-8 (with gpt-4o-mini)
**Total time per field:** 10-15 seconds (with gpt-4o-mini)

---

## Parallel Execution Visualization

### Batch 1 (5 fields running concurrently):

```
Time →
 0s  Field 1: company              ═══════════════> ✅ (10s)
 0s  Field 2: founding_year        ═══════════════> ✅ (11s)
 0s  Field 3: organization_number  ═══════════════> ✅ (13s)
 0s  Field 4: city                 ═══════════════> ✅ (13s)
 0s  Field 5: company_description  ═══════════════> ✅ (14s)
                                    ↑
                            Batch 1 complete: 14s total
                            (vs 65s if sequential!)

 +0.2s delay
     ↓

14s  Field 6: employees            ═══════════════> ✅ (9s)
14s  Field 7: team_members         ═══════════════> ✅ (11s)
14s  Field 8: ai_engineers         ═══════════════> ✅ (24s)
14s  Field 9: dev_stage_1          ═══════════════> ✅ (12s)
14s  Field 10: dev_stage_2         ═══════════════> ✅ (18s)
                                    ↑
                            Batch 2 complete: 24s total
```

**Performance:** 5 fields in ~10-24s instead of ~50-120s sequential!

---

## Error Handling Flow

```javascript
try {
    // Normal execution
    const response = await fillSingleField(...)
    if (response.success) {
        // Fill field
        filled++
    } else {
        // No value returned
        failed++
    }
} catch (error) {
    // API error, timeout, etc.
    console.error(`❌ Failed: ${error.message}`)
    failed++

    // Check error type:
    if (error.message.includes('Extension context invalidated')) {
        button.textContent = '🔄 Ladda om sidan'
        button.style.background = '#FF9800'
    } else {
        button.textContent = '❌ Fel'
        button.style.background = '#f44336'
    }
}
```

---

## Performance Metrics (v1.3.1)

| Metric | Value |
|--------|-------|
| **Model** | gpt-4o-mini |
| **Batch Size** | 5 concurrent fields |
| **Fields per Second** | ~0.25-0.4 (4-2.5s per field) |
| **Total Time (24 fields)** | ~60-90 seconds |
| **Speedup vs Sequential** | **4-5x faster** |
| **Cost per Field** | ~$0.0001-0.0005 |
| **Rate Limits** | None (gpt-4o-mini has high TPM) |

---

## Key Optimizations

1. ✅ **Parallel Processing:** 5 fields at once instead of 1
2. ✅ **Fast Model:** gpt-4o-mini (2-3x faster than gpt-4o)
3. ✅ **Number Field Handling:** Extracts digits from "1–4" strings
4. ✅ **Visual Feedback:** Green background on filled fields
5. ✅ **Batch Progress:** Shows "Batch X/Y" in button
6. ✅ **Error Recovery:** Continues filling even if some fields fail
7. ✅ **Thread Cleanup:** New thread per field (no token buildup)

---

## Future Optimization Ideas

1. **Thread Reuse:** Reuse single thread for all fields (~400ms saved per field)
2. **Increase Batch Size:** 8-10 concurrent (if no rate limits)
3. **Optimize Polling:** Check at 100ms, 200ms, 500ms intervals first
4. **Cache Assistant Metadata:** Skip GET /assistants call after first field
5. **Prefetch:** Start filling while user scrolls to form
