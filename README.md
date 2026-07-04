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

## Roadmap

1. Final Check (fehlende wichtige Artikel je Reiseart) + Rückreise-Checkliste (Hotel-Safe, Kühlschrank, Mietauto-Kabel, ...)
2. Gewichtsschätzung pro Gepäckstück
3. Dokumenten-Safe (verschlüsselt, offline) mit Adressen und Maps-Übergabe
4. Lern-Funktion nach der Reise (vergessen/überflüssig → Templates anpassen)
5. Optionaler Sync über Synology NAS
