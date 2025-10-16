# Fullständig Reset av Extension

Följ dessa steg EXAKT:

## Steg 1: Stäng ALLA Chrome-fönster
- Cmd+Q (Mac) eller Alt+F4 (Windows)
- Kontrollera att Chrome verkligen stängts (kolla i Activity Monitor/Task Manager)

## Steg 2: Öppna Chrome igen

## Steg 3: Rensa Extension-cache
1. Öppna `chrome://extensions/`
2. Hitta "AI Form Filler MVP"
3. Klicka **"Remove"** (ta bort helt)
4. Stäng fliken

## Steg 4: Ladda Extension på nytt
1. Öppna `chrome://extensions/` igen
2. Aktivera "Developer mode" (toggle uppe till höger)
3. Klicka **"Load unpacked"**
4. Navigera till: `/Users/andersbratland/Documents/@code/dw-chromegpt`
5. Klicka "Select"

## Steg 5: Verifiera att extension laddades
På `chrome://extensions/` ska du se:
- **Name:** AI Form Filler MVP
- **Version:** 1.0.0
- **ID:** (något random)
- **Inga error-meddelanden**

Om det finns errors, klicka på "Errors" och dela vad som står där.

## Steg 6: Inspektera Background Script
1. Under "AI Form Filler MVP" klicka på **"Inspect views: service worker"**
2. En DevTools-flik öppnas
3. I Console-fliken, skriv: `console.log('Background test')`
4. Du ska se "Background test" i loggen

## Steg 7: Öppna test-form.html
1. **STÄNG alla tidigare flikar med test-form.html**
2. Öppna Finder/File Explorer
3. Navigera till: `/Users/andersbratland/Documents/@code/dw-chromegpt/test-form.html`
4. **Högerklicka** på filen
5. Välj **"Open With" → "Google Chrome"**

## Steg 8: Öppna Console OMEDELBART
1. Tryck F12 (eller Cmd+Option+I)
2. Gå till Console-fliken

## Steg 9: Kolla för vårt meddelande
Du MÅSTE se:
```
🚀 AI Form Filler laddad - version 2
Document ready state: ...
```

Om du INTE ser detta, gör följande:
1. Tryck Cmd+R (eller F5) för att ladda om sidan
2. Kolla console igen

## Steg 10: Om det fortfarande inte fungerar

Testa med en helt ny sida:
1. Öppna en ny flik
2. Gå till: `https://www.w3schools.com/html/html_forms.asp`
3. Öppna Console (F12)
4. Leta efter "🚀 AI Form Filler laddad - version 2"

## Felsökning

### "Inga meddelanden alls i console"
→ Content script laddas inte. Gå tillbaka till Steg 3 och börja om.

### "Fel i manifest.json"
→ Dela felmeddelandet

### "Extension laddas men inget händer"
→ Kolla `chrome://extensions/` för errors

### "Content script krockar med andra extensions"
→ Stäng av alla andra extensions tillfälligt
→ Högerklicka på varje extension → "Manage" → Stäng av toggle
