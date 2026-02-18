# VS Code Setup - Anleitung für den API-Schlüssel

## Was Sie jetzt in VS Code machen müssen

### ✅ Schritt 1: Änderungen vom GitHub pullen

Öffnen Sie VS Code und das Terminal (Strg+Ö oder View → Terminal).

```bash
# Im Terminal ausführen:
git pull origin copilot/improve-github-pages-deployment
```

Dies lädt die neue Dokumentation herunter:
- `docs/GOOGLE_PLACES_API_KEY.md` (Anleitung)
- Updates an anderen Dateien

---

### ✅ Schritt 2: Lokale .env Datei erstellen

**WICHTIG:** Die `.env` Datei mit dem echten API-Schlüssel wurde **nicht** zu GitHub hochgeladen (aus Sicherheitsgründen). Sie müssen diese Datei lokal erstellen.

#### Option A: Im VS Code erstellen

1. Öffnen Sie VS Code
2. Klicken Sie auf "New File" oder drücken Sie Strg+N
3. Speichern Sie die Datei als `.env` im Hauptverzeichnis des Projekts
4. Fügen Sie folgenden Inhalt ein:

```env
# Google Maps/Places API Key
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4

# Server port
PORT=5055
```

#### Option B: Im Terminal erstellen

```bash
# Im Hauptverzeichnis des Projekts:
cat > .env << 'EOF'
# Google Maps/Places API Key
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4

# Server port
PORT=5055
EOF
```

Oder einfacher:

```bash
cp .env.example .env
```

Und dann die Datei `.env` öffnen und den Platzhalter ersetzen mit:
```
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4
```

---

### ✅ Schritt 3: Überprüfen, dass die .env Datei ignoriert wird

Die `.env` Datei sollte **nicht** in Git erscheinen (sie ist in `.gitignore`).

Prüfen Sie:

```bash
git status
```

**Erwartetes Ergebnis:** Die `.env` Datei sollte **nicht** aufgelistet werden.

Wenn sie doch erscheint, ist etwas falsch. Sie sollte nicht committet werden!

---

### ✅ Schritt 4: Testen, dass der Server funktioniert

Nachdem die `.env` Datei erstellt ist, können Sie testen:

```bash
# Dependencies installieren (falls noch nicht geschehen)
npm ci

# Server starten
npx tsx server/maps-proxy.ts
```

**Erwartete Ausgabe:**
```
🗺️  Maps proxy running on :5055
```

Wenn Sie diese Meldung sehen, funktioniert alles! ✅

Wenn Sie einen Fehler "Missing GOOGLE_MAPS_KEY" sehen, wurde die `.env` Datei nicht richtig erstellt.

---

## Zusammenfassung

**Was Sie tun müssen:**

1. ✅ **Git Pull** - Änderungen von GitHub holen
2. ✅ **`.env` Datei erstellen** - Lokal im Projekt-Root mit dem API-Schlüssel
3. ✅ **Überprüfen** - Mit `git status` sicherstellen, dass `.env` nicht getrackt wird
4. ✅ **Testen** - Server starten und schauen, ob er läuft

**Was Sie NICHT tun müssen:**

- ❌ Die `.env` Datei zu Git hinzufügen/committen
- ❌ Den API-Schlüssel irgendwo anders speichern

---

## Schnell-Anleitung (Kopieren & Einfügen)

```bash
# 1. Änderungen pullen
git pull origin copilot/improve-github-pages-deployment

# 2. .env Datei erstellen
cat > .env << 'EOF'
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4
PORT=5055
EOF

# 3. Überprüfen
git status  # .env sollte NICHT erscheinen

# 4. Testen
npm ci
npx tsx server/maps-proxy.ts
```

---

## Bei Problemen

**Problem:** "Missing GOOGLE_MAPS_KEY in .env"
**Lösung:** Die `.env` Datei wurde nicht erstellt oder hat falschen Inhalt

**Problem:** `.env` erscheint in `git status`
**Lösung:** Das sollte nicht passieren (ist in `.gitignore`). Nicht committen!

**Problem:** "Cannot find module 'express'"
**Lösung:** `npm ci` ausführen um Dependencies zu installieren

---

## Dateien-Übersicht

```
Weekplaner/
├── .env               ← NEU: Lokal erstellen, NICHT committen
├── .env.example       ← Template (bereits vorhanden)
├── .gitignore         ← Enthält .env (bereits vorhanden)
├── docs/
│   └── GOOGLE_PLACES_API_KEY.md  ← NEU: Dokumentation (gepullt)
└── server/
    └── maps-proxy.ts  ← Verwendet den API-Key
```
