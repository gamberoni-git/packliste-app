# PackList

Packlisten für die Ferien erstellen, verwalten und speichern. Progressive Web App (PWA) — läuft auf dem iPhone ohne Apple Developer Account: in Safari öffnen → Teilen → «Zum Home-Bildschirm».

## Features (MVP)

- **Reisearten-Templates**: Städtetrip, Strandferien, Wanderferien, Trekkingtour, Weekendtrip, Businesstrip, Skiferien, Skitour, Running Race, Tauchferien, Bikeferien — jede mit vorgeschlagener Packliste
- **Wizard mit Kachel-Auswahl**: Reiseart → Destination/Daten/Dauer → Transportmittel → Gepäckstücke (inkl. Handgepäck/Checked bei Flug) → Klima → Aktivitäten (Wandern, Tauchen, Running, Biken, Business, ...)
- **Kategorien** (Hygiene, Kleider, Schuhe, Elektronik, ...) mit Mengen, tagesabhängig berechnet (z.B. Socken = Reisetage + 1)
- **Prioritäten** mit Farbcode: Essenziell / Normal / Optional-Luxus
- **Eigene Artikel** (persönliche Garderobe) und **eigene Kategorien**, dauerhaft gespeichert
- **Packing-Modus**: Abhaken beim Packen, Fortschritt, Filter «Offen», Last-Minute-Erinnerung (Zahnbürste & Co.) mit Abreise-Banner
- **Teilen**: Liste als Datei (iOS Share Sheet) oder als Link — Empfänger importiert sie in seine App
- **Deutsch/Englisch**, **Dark/Light/System**, komplett offline, Daten bleiben lokal auf dem Gerät (localStorage)
- **Backup**: alle Daten als JSON exportieren/importieren

## Entwicklung

Kein Build-Schritt, kein npm. Lokal starten:

```
node tools/dev-server.js
# http://localhost:5173
```

Icons neu generieren: `node tools/gen-icons.js`

## Deployment

GitHub Pages (Branch `main`, Root). Bei Änderungen an den App-Dateien die Cache-Version in `sw.js` (`packlist-v1`) hochzählen, damit installierte PWAs das Update ziehen.

## Weitere Features (seit MVP)

- **Final Check**: prüft auf fehlende kritische Artikel (je Reiseart, Klima, Transport, Aktivität)
- **Rückreise-Checkliste**: Hotel-Safe, Kühlschrank, Mietauto-Kabel etc., kontextabhängig
- **Gewichtsschätzung**: Annahmen für alle Artikel + Gepäck-Leergewichte, korrigierbar, Flug-Limiten-Warnung
- **Dokumenten-Safe**: AES-256-verschlüsselte Offline-Ablage (Pass, Buchungen, Notizen), Adressen mit Google/Apple-Maps-Lokalisierung, Passwort-Manager-Integration
- **Adapter-Hinweis**: 50 Länder mit Steckertypen, mehrere Ziel-Länder pro Reise
- **Lern-Funktion**: Nach der Reise Feedback (vergessen/überflüssig) → Templates passen sich an

## Roadmap

- Optionaler Sync über Synology NAS
