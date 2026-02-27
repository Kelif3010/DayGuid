# DayGuide – Deployment & Android-Installation

## 🚀 In 5 Schritten auf dein Android-Tablet

### Schritt 1: Projekt vorbereiten
```bash
# Entpacke das dayguide-Projektverzeichnis
cd dayguide

# Abhängigkeiten installieren
npm install
```

### Schritt 2: Supabase einrichten (optional für Demo)
Die App funktioniert auch OHNE Supabase mit Demo-Daten.
Für die Produktionsversion:

1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein Projekt
2. Öffne den SQL-Editor und führe `supabase-schema.sql` aus
3. Erstelle `.env` im Projektordner:
```
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-key
```

### Schritt 3: Lokal testen
```bash
npm run dev
```
Öffne `http://localhost:5173` im Browser.

### Schritt 4: Deployen (kostenlos)

#### Option A: Vercel (empfohlen)
1. Gehe zu [vercel.com](https://vercel.com) → Sign Up (kostenlos)
2. Erstelle ein GitHub-Repository und push den Code
3. In Vercel: "Import Project" → GitHub-Repo auswählen
4. Environment Variables setzen (falls Supabase):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy klicken → Fertig!
Du bekommst eine URL wie: `https://dayguide.vercel.app`

#### Option B: Netlify
```bash
npm run build
# Upload den 'dist' Ordner auf netlify.com
```

#### Option C: Eigener Server
```bash
npm run build
# Kopiere den 'dist' Ordner auf deinen Webserver
```

### Schritt 5: Auf Android installieren 📱

1. Öffne **Chrome** auf deinem Android-Tablet/Handy
2. Gehe zu deiner URL (z.B. `https://dayguide.vercel.app`)
3. Chrome zeigt automatisch ein Banner: **"App zum Startbildschirm hinzufügen"**
   - Falls nicht: Tippe auf **⋮** (drei Punkte oben rechts)
   - Wähle **"Zum Startbildschirm hinzufügen"** oder **"App installieren"**
4. Bestätige mit **"Hinzufügen"**
5. Die App erscheint auf deinem Startbildschirm wie eine normale App!

---

## 📱 So funktioniert die App auf Android

### Als PWA installiert:
- ✅ Läuft im **Vollbild** (kein Browser-Rahmen)
- ✅ Eigenes **App-Icon** auf dem Startbildschirm
- ✅ Funktioniert auch **offline** (gecachte Inhalte)
- ✅ **Push-Notifications** als Wecker-Erinnerung
- ✅ **Bildschirm bleibt an** im Kind-Modus (Wake Lock)
- ✅ **Vibriert** bei Erinnerungen
- ✅ Startet automatisch im **Standalone-Modus**
- ✅ Kein App-Store nötig, kein Update nötig

### Tablet-Tipps:
- **Querformat** wird empfohlen (Kind-Modus)
- **Kiosk-Modus**: Manche Android-Tablets haben einen "Kiosk-Modus" in den Einstellungen, der verhindert, dass Kinder die App verlassen
- **PIN-Schutz**: Der Kind-Modus ist mit einer 4-stelligen PIN geschützt (Standard: 1234)
- **Bildschirmsperre deaktivieren**: Damit die App dauerhaft läuft, stelle den Bildschirm-Timeout auf "Nie"

### Empfohlene Android-Einstellungen:
1. **Display** → Bildschirm-Timeout → 30 Minuten oder "Nie"  
2. **Töne** → Medien-Lautstärke aufdrehen (für TTS)
3. **Apps** → Chrome → Benachrichtigungen → Erlauben
4. **Batterie** → DayGuide von Batterieoptimierung ausschließen

---

## 🔧 Technische Details

### PWA-Unterstützung:
| Feature | Android Chrome | Samsung Internet | Firefox Android |
|---------|:---:|:---:|:---:|
| Installation | ✅ | ✅ | ✅ |
| Standalone-Modus | ✅ | ✅ | ✅ |
| Push-Notifications | ✅ | ✅ | ✅ |
| Wake Lock | ✅ | ✅ | ❌ |
| Offline-Modus | ✅ | ✅ | ✅ |
| Audio-Aufnahme | ✅ | ✅ | ✅ |
| Text-to-Speech | ✅ | ✅ | ✅ |
| Vibration | ✅ | ✅ | ✅ |
| Vollbild | ✅ | ✅ | ✅ |

### Mindestanforderungen:
- Android 8.0+ (Oreo)
- Chrome 80+ (oder Samsung Internet 13+)
- Mindestens 2 GB RAM
- Internet für erste Installation, danach offline nutzbar

---

## 💡 FAQ

**Kann ich die App ohne Supabase nutzen?**
Ja! Die Demo-Version funktioniert komplett ohne Backend mit vordefinierten Aufgaben.

**Funktioniert die App auch auf iPads?**
Ja, PWAs funktionieren auch auf iOS/iPadOS über Safari, allerdings mit einigen Einschränkungen (z.B. kein Push, kein Wake Lock).

**Kann ich die App updaten?**
Einfach den neuen Code deployen. Die PWA aktualisiert sich automatisch beim nächsten Öffnen.

**Wie schütze ich den Kind-Modus?**
Der Wechsel zum Eltern-Bereich ist mit einer 4-stelligen PIN geschützt. Standard: 1234. Kann in den Einstellungen geändert werden.
