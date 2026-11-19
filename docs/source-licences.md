# Source licences: confirmations on file

What a data provider has confirmed to us in writing about the use of its data. The credits themselves are on [metablend.app/terms](https://metablend.app/terms) (all 13 languages) and in the README ("Data sources and credits"). This file records where a licence statement comes from when the provider's own site does not carry it. Newest first.

## CHMI (Czech Hydrometeorological Institute, ČHMÚ): open data, the ALADIN model

- **Date of the confirmation:** 18 November 2026, by email.
- **Sender:** CHMI, Director's Department, in answer to the owner's question ("from info@ inbox" in the owner's note). The sender's name and the email itself are kept in the owner's mailbox, not in this public file.
- **Recorded:** 19 November 2026, from the owner's account of the email. The points below give its content; they are not CHMI's wording.
- **What it says:**
  1. All data on opendata.chmi.cz are under CC BY 4.0.
  2. Commercial and non-commercial use is allowed, including the development of apps.
  3. The only obligation is attribution: CHMI is cited as the author.
  4. CHMI asks that an app's name is not identical to the name of the ALADIN model.
- **Why it is on file:** the folders on opendata.chmi.cz carry no licence text (looked at on 19 November 2026: the root, `meteorology/`, `meteorology/weather/` and `meteorology/weather/nwp_aladin/` are bare listings), so this email is our proof of the licence.
- **What we use:** the ALADIN forecast model for central Europe, received through Open-Meteo (model `chmi_aladin_central_europe_2km`), a source in the blend since 12 November 2026 (`lib/weather.js`, `lib/sources.js`).
- **How we meet it:**
  - Author, licence and the note on changes: /terms, "Data sources & attribution", in every language: "ALADIN model forecasts. Author: Czech Hydrometeorological Institute (ČHMÚ), www.chmi.cz. Data: opendata.chmi.cz, received through Open-Meteo. Licence: CC BY 4.0." The licence is linked to creativecommons.org/licenses/by/4.0/, and the sentence after it, in the page's language, says: "MetaBlend blends these data with other sources, so what it shows is changed from the original." The README carries the same line.
  - Where the data are shown: the list of sources names the source "CHMI ALADIN". The credit line under that list, in the website's footer and on the app's More screen names "ČHMÚ (CHMI)" with a link and ends with "Sources and licences", which leads to the list on /terms.
  - The name: the app is called MetaBlend. "ALADIN" appears only as the name of the source, next to CHMI's.
