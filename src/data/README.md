# Data files in `src/data`

Diese Dateien dienen als lokale Seed-/Fixture-Daten für die App und Tests.

## Dateien

- `roster.json`  
  Spielerstammdaten (inkl. Teams, Positionen, Lizenz-/TNA-Daten, optionale Metadaten).

- `roster_clean.json`  
  Bereinigte/vereinheitlichte Roster-Variante für Import/Validierung.

- `staff.json`  
  Trainer-/Staff-Liste mit Rollen und optionaler Lizenz.

- `teams.json`  
  Team-Definitionen/Zuordnungen (z. B. U18, NBBL, HOL, 1RLH).

- `weekplan_master.json`  
  Vorlage für den Wochenplan (Sessions, Zeitfenster, Orte, Grundstruktur).

- `Start.txt`  
  Freitext-/Startnotizen (nicht kritisch für Laufzeitlogik).

## Hinweise für Tests & Mocking

- In Unit-Tests möglichst kleine, fokussierte JSON-Fixtures verwenden.
- Datumswerte bevorzugt im ISO-Format (`YYYY-MM-DD`) halten.
- IDs (`player.id`, `session.id`) stabil halten, damit Snapshots reproduzierbar bleiben.
- Bei Strukturänderungen bitte Normalizer in `src/state/normalizers.ts` mitprüfen.
