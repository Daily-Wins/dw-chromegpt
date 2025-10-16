# Test Instructions - Updated 2025-10-15

## Latest Updates

The extension has been updated with improved HubSpot form detection for the AI Sweden startup application form.

### What Changed:
- ✅ Extended polling (2, 4, 6, 8, 10 seconds)
- ✅ HubSpot-specific detection (`.hbspt-form`, `.hs-form` classes)
- ✅ Enhanced logging (shows field details for every form)
- ✅ Better MutationObserver for dynamic forms

## Test 1: AI Sweden Startup Form (Primary Target)

### 1. Reload Extension
Go to `chrome://extensions/` → Click Reload on "AI Form Filler MVP"

### 2. Visit AI Sweden Page
Navigate to: https://www.ai.se/sv/ekosystem/startup-programmet/startup-programmet-ansok-till-steg-1

### 3. Open DevTools
Press F12 or Right-click → Inspect, go to Console tab

### 4. Wait 10 Seconds
The extension polls for forms at 2, 4, 6, 8, and 10 seconds

### 5. Check Console Output
Look for:
```
🚀 AI Form Filler (Top)
  Totalt X formulär innan filtrering
    Form 1: 1 synliga fält {id: "search", ...}
    Form 2: 15 synliga fält {id: "hsForm_3ab2f4a2-...", fields: [...]}  ← TARGET!
Hittade 2 relevanta formulär i denna frame
```

**Success Indicators:**
- ✅ Form with 10+ fields detected
- ✅ Field names include "company", "founding_year", "org_number", etc.
- ✅ HubSpot form ID visible (starts with "hsForm_")

**If Not Working:**
- ❌ Only 1-2 field forms detected ("lang_dropdown_select", "query")
- ❌ No form with company/org fields found

### 6. Click the Purple Button
Click "🤖 Fyll formulär med AI" in bottom-right corner

### 7. Check Form Filling
Watch console for:
```
Form data: {fields: Array(15)}  ← Should be 10+ fields
Data att fylla: {company_name: "Acme AB", ...}
✓ company_name = Acme AB
Fyllde X fält  ← Should be >5
```

Fields should turn light green when filled successfully.

---

## Test 2: Local Test Form (Fallback)

If AI Sweden form still not working, test with local form:

### 1. Open test-form.html
Drag `test-form.html` to Chrome browser

### 2. Click Purple Button
Should fill 7 fields with company data from företagsinfo.txt

### 3. Check Results
Fields should be filled with:
- ✅ Acme AB (Company name)
- ✅ 556123-4567 (Organization number)
- ✅ Storgatan 1 (Address)
- ✅ Stockholm (City)
- ✅ 123 45 (Zip code)
- ✅ info@acme.se (Email)
- ✅ 08-123 45 67 (Phone)

---

## Troubleshooting

### Assistant Returns Wrong Data
Re-run update script:
```bash
export OPENAI_API_KEY="sk-svcacct-..."
node update-assistant.js
```

### Fields Not Matched
Console shows "INTE HITTAD":
- Assistant uses different field names than form
- Check console logs for exact name mismatch
- May need fuzzy matching logic

### Timeout Errors
- Assistant takes >30 seconds
- Check OpenAI API status
- Try with fewer form fields first

### CORS Errors
If you see "Blocked a frame with origin...":
- Form is in cross-origin iframe
- Extension cannot access due to browser security
- Alternative approach may be needed

---

## Next Steps

**If Local Form Works But AI Sweden Doesn't:**
- HubSpot form may be in cross-origin iframe
- Form may load after user interaction (scroll, click)
- Shadow DOM may be hiding form elements
- Report console logs for further investigation

**If Both Work:**
- Test on other websites with company forms
- Add more company documents to Assistant
- Improve field matching logic for better accuracy

See [DEBUGGING.md](DEBUGGING.md) for detailed debugging guide.
