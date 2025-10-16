# Testing Guide

## Snabbtest

### 1. Ladda Om Extensionen

1. Öppna `chrome://extensions/`
2. Hitta "AI Form Filler MVP"
3. Klicka på refresh-ikonen (🔄)

### 2. Testa med Lokal HTML-fil

1. Öppna filen `test-form.html` i Chrome:
   - Högerklicka på filen → "Open with" → Chrome
   - Eller dra filen till Chrome-fönstret

2. Du ska se:
   - En flytande knapp nere till höger: "🤖 Fyll alla 2 formulär med AI"
   - Två formulär på sidan

3. Öppna Console (F12 → Console)

4. Kolla att du ser:
   ```
   AI Form Filler: Hittade 2 formulär på sidan
   AI Form Filler: Knapp tillagd
   AI Form Filler: Knapp tillagd i DOM
   ```

5. Klicka på knappen

6. Du ska se i console:
   ```
   AI Form Filler: Knappen klickad!
   Hittade 2 formulär på sidan

   === Formulär 1 ===
   Formulärstruktur skickad till API: {...}
   ...
   ```

## Om Det Inte Fungerar

### Knappen Syns Inte

**Kolla console:**
- Ser du "AI Form Filler: Hittade 0 formulär"?
  → Sidan har inga formulär

- Ser du "AI Form Filler: Inga formulär hittades"?
  → Content script laddades före formulär. Ladda om sidan (F5)

- Ser du inga meddelanden alls?
  → Content script laddades inte. Ladda om extensionen.

### Knappen Gör Inget

**Kolla console när du klickar:**
- Ser du "AI Form Filler: Knappen klickad!"?
  → Bra! Kolla resten av loggen för fel

- Ser du inget?
  → Event listener fungerar inte. Ladda om sidan.

### Fel i Console

**"Konfigurera API-nyckel och Assistant ID":**
1. Klicka på extension-ikonen
2. Fyll i API key och Assistant ID
3. Klicka "Spara"

**"Failed to fetch":**
- Kolla internet-anslutning
- Kolla att API key är korrekt
- Kolla OpenAI status: https://status.openai.com/

**Chrome Extension Fel:**
- Kolla `chrome://extensions/` för felmeddelanden
- Klicka på "Errors" om det finns några

## Manuell Test av Fältmatchning

I test-form.html finns fält med tydliga namn:
- `firstName`, `lastName`, `email`, `phone`, `company`
- `companyName`, `orgNumber`, `address`, `city`, `zipCode`

Assistenten borde matcha dessa mot företagsinfo.txt:
- firstName → "Anna"
- lastName → "Andersson"
- email → "anna@acme.se"
- phone → "08-123 45 68"
- company → "Acme AB"
- companyName → "Acme AB"
- orgNumber → "556123-4567"
- address → "Storgatan 1"
- city → "Stockholm"
- zipCode → "123 45"

## Debug Output

Korrekt console output ska se ut så här:

```
AI Form Filler: Hittade 2 formulär på sidan
AI Form Filler: Knapp tillagd
AI Form Filler: Knapp tillagd i DOM

[Klicka på knapp]

AI Form Filler: Knappen klickad!
Hittade 2 formulär på sidan

=== Formulär 1 ===
Formulärstruktur skickad till API: {
  url: "file:///.../test-form.html",
  title: "Test Formulär - AI Form Filler",
  fields: [
    {name: "firstName", type: "text", label: "Förnamn:", ...},
    {name: "lastName", type: "text", label: "Efternamn:", ...},
    ...
  ]
}

Assistant svar: {"firstName":"Anna","lastName":"Andersson",...}
Extraherad data: {firstName: "Anna", lastName: "Andersson", ...}
Svar från API: {success: true, data: {...}}
Försöker fylla formulär med data: {...}

Försöker sätta fält "firstName" till: "Anna"
  → Hittade fält: firstName (type: text)
Försöker sätta fält "lastName" till: "Andersson"
  → Hittade fält: lastName (type: text)
...

Fyllde 6 fält i formulär 1

=== Formulär 2 ===
[Samma process för formulär 2]

Fyllde 7 fält i formulär 2
```

## Vanliga Problem

### Assistenten returnerar fel data

**Symtom:** Console visar `{query: null}` istället av fältdata

**Lösning:**
1. Kolla att Assistant ID är korrekt
2. Kör `OPENAI_API_KEY="..." node update-assistant.js`
3. Testa igen

### Fält fylls inte trots att data finns

**Symtom:** "Hittade INTE fält för 'firstName'"

**Lösning:**
- Assistenten använder fel fältnamn
- Kolla "Formulärstruktur skickad till API" för korrekta namn
- Assistenten borde använda exakt samma namn

### Extension laddar inte

**Symtom:** Ingen knapp, inga console-meddelanden

**Lösning:**
1. `chrome://extensions/` → Kolla för fel
2. Ladda om extensionen
3. Ladda om sidan
4. Kolla att manifest.json är OK
