# Google-Play-Eintrag hochladen (fastlane supply)

Die Lane `fastlane android upload_store` lädt den Store-Eintrag aus `fastlane/metadata/android/<Sprache>/` zu Google Play hoch: Titel, Kurz- und Langbeschreibung, App-Symbol und Feature-Grafik (en-US) und die fünf Handy-Screenshots je Sprache. Die Screenshots ersetzen die vorhandenen. Sie lädt kein App-Bundle hoch, erstellt keinen Release und ändert keinen Track. Die Änderungshinweise (Changelogs) gehören zu einem Release und bleiben draußen.

Dafür braucht sie einen Dienstkonto-Schlüssel (eine JSON-Datei). Er liegt außerhalb des Repositorys und wird nie eingecheckt, nie per Chat oder E-Mail verschickt. Die Lane bricht ab, wenn der Schlüssel im Repository liegt.

## 1. Dienstkonto und Schlüssel in Google Cloud

1. https://console.cloud.google.com öffnen, mit dem Google-Konto anmelden, das auch Inhaber der Play Console ist.
2. Oben ein Projekt wählen oder ein neues anlegen, z. B. `metablend-play`.
3. **APIs und Dienste → Bibliothek**: „Google Play Android Developer API“ suchen und **Aktivieren**.
4. **IAM und Verwaltung → Dienstkonten → Dienstkonto erstellen**: Name z. B. `fastlane-play`. Rollen im Projekt sind nicht nötig: **Weiter**, **Fertig**.
5. Das neue Dienstkonto öffnen, Reiter **Schlüssel → Schlüssel hinzufügen → Neuen Schlüssel erstellen → JSON**. Die JSON-Datei wird heruntergeladen.
   - Ist das Erstellen gesperrt („Organisationsrichtlinie iam.disableServiceAccountKeyCreation“), gehört das Projekt zu einer Google-Workspace-Organisation. Dann muss ein Organisations-Admin die Richtlinie für dieses Projekt aufheben. Bei einem privaten Google-Konto kommt das nicht vor.
6. Die E-Mail-Adresse des Dienstkontos notieren (endet auf `.iam.gserviceaccount.com`).
7. Die JSON-Datei an einen festen Ort außerhalb des Repositorys verschieben, z. B. `C:\Users\itsre\keys\metablend-play.json`.

## 2. Zugriff in der Play Console

1. https://play.google.com/console öffnen, **Nutzer und Berechtigungen → Neue Nutzer einladen**.
2. Die E-Mail-Adresse des Dienstkontos eintragen.
3. Reiter **App-Berechtigungen → App hinzufügen → MetaBlend**. Diese Berechtigung setzen:
   - **Store-Präsenz verwalten** (Store-Eintrag, Grafiken und Screenshots bearbeiten).
   - „App-Informationen ansehen (Lesezugriff)“ bleibt wie voreingestellt an.
   - Keine Kontoberechtigungen, keine Release-Berechtigungen.
4. **Nutzer einladen** und bestätigen. Bis die Berechtigung wirkt, können einige Minuten vergehen (früher bis zu 24 Stunden).
5. Nur in älteren Play Consoles: steht unter **Einrichtung** noch ein Punkt **API-Zugriff**, dort zuerst das Cloud-Projekt aus Schritt 1 verknüpfen. In aktuellen Play Consoles gibt es diesen Schritt nicht mehr.

## 3. Name des geschlossenen Tests

Ohne App-Bundle hängt supply den Eintrag an den Release eines Tracks, ändert ihn aber nicht. Das ist der geschlossene Test. Den Namen unter **Testen und veröffentlichen → Tests → Geschlossene Tests** ablesen:
- „Geschlossener Test – Alpha“ ist der Standard und heißt für die Lane `alpha` (nichts zu setzen).
- Ein selbst angelegter Track heißt so, wie er dort steht. Dann `SUPPLY_TRACK` auf diesen Namen setzen (unten).
- Meldet die Lane „More than one release found in this track“, mit `SUPPLY_VERSION_CODE` den aktuellen versionCode angeben (zurzeit `2`).

## 4. Hochladen (PowerShell)

```powershell
cd "C:\Users\itsre\Documents\nichtwichtig pepega\app\metablend"
git pull

# für Japanisch und Chinesisch in der Ausgabe
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$env:SUPPLY_JSON_KEY = "C:\Users\itsre\keys\metablend-play.json"
# nur wenn der geschlossene Test nicht "alpha" heißt:
# $env:SUPPLY_TRACK = "Name des Tracks"

# 1. Prüflauf: Google prüft alles, nichts wird geändert ("Successfully validated the upload to Google Play")
fastlane android upload_store validate:true

# 2. Hochladen: Texte, Symbol, Feature-Grafik, Screenshots in allen 13 Sprachen
fastlane android upload_store

# danach den Pfad aus der Sitzung entfernen
Remove-Item Env:SUPPLY_JSON_KEY
```

Änderungen am Store-Eintrag prüft Google, meist innerhalb weniger Stunden. Ist in der Play Console die verwaltete Veröffentlichung an, warten sie danach unter **Veröffentlichungsübersicht**, bis sie dort freigegeben werden.
