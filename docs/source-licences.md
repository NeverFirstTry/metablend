# Source licences: confirmations on file

What a data provider has confirmed to us in writing about the use of its data. The credits themselves are on [metablend.app/terms](https://metablend.app/terms) (all 13 languages) and in the README ("Data sources and credits"). This file records where a licence statement comes from when the provider's own site does not carry it. Newest first.

## CHMI (Czech Hydrometeorological Institute, ČHMÚ): open data, the ALADIN model

- **Date of the confirmation:** 18 November 2026, by email.
- **Sender:** CHMI, Director's Department, in answer to the owner's question ("from info@ inbox" in the owner's note). The sender's name and the email itself are kept in the owner's mailbox, not in this public file.
- **Recorded:** 19 November 2026. The two passages below are CHMI's own words, as the owner copied them from the email. The point after them is the owner's account of the email, not a quotation.
- **In CHMI's words:**
  > "all data published on the opendata.chmi.cz portal are provided as open data under the free international Creative Commons BY 4.0 license. This license contains no restrictions regarding the purpose of use. You may therefore legally use the data for both commercial and non-commercial purposes, including application development."

  > "Your sole legal obligation when using the CC BY 4.0 license is to attribute the origin of the data (i.e., to cite CHMI as the author)."
- **Also asked (the owner's account):** that an app's name is not identical to the name of the ALADIN model.
- **Why it is on file:** the folders on opendata.chmi.cz carry no licence text (looked at on 19 November 2026: the root, `meteorology/`, `meteorology/weather/` and `meteorology/weather/nwp_aladin/` are bare listings), so this email is our proof of the licence.
- **What we use:** the ALADIN forecast model for central Europe, received through Open-Meteo (model `chmi_aladin_central_europe_2km`), a source in the blend since 12 November 2026 (`lib/weather.js`, `lib/sources.js`).
- **How we meet it:**
  - Author, licence and the note on changes: /terms, "Data sources & attribution", in every language: "ALADIN model forecasts. Author: Czech Hydrometeorological Institute (ČHMÚ), www.chmi.cz. Data: opendata.chmi.cz, received through Open-Meteo. Licence: CC BY 4.0." The licence is linked to creativecommons.org/licenses/by/4.0/, and the sentence after it, in the page's language, says: "MetaBlend blends these data with other sources, so what it shows is changed from the original." The README carries the same line.
  - Where the data are shown: the list of sources names the source "CHMI ALADIN". The credit line under that list, in the website's footer and on the app's More screen names "ČHMÚ (CHMI)" with a link and ends with "Sources and licences", which leads to the list on /terms.
  - The name: the app is called MetaBlend. "ALADIN" appears only as the name of the source, next to CHMI's.

## Visual Crossing: attribution, and what its free plan allows

- **Read:** 20 November 2026, by the owner, on Visual Crossing's own documentation pages. **Recorded:** 21 November 2026. The passages below are Visual Crossing's words as the owner copied them from the two pages. A fetch of the pages with this project's tools failed on 20 November (connection reset, three tries), so they were not read a second time here.
- **Pages:**
  - Attribution: https://www.visualcrossing.com/resources/documentation/weather-data/how-to-properly-cite-or-attribute-visual-crossing-weather-data/
  - Free plan: https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/
- **In Visual Crossing's words, the attribution page:**
  > "Place the attribution near the weather data."

  It should not be
  > "hidden on a separate attribution, credits, legal, or about page."

  > "Link the attribution to Visual Crossing whenever possible."

  > "An attribution shown only on an application's About, Settings, Legal, or Credits screen is not a substitute for attribution near the weather data itself."

  The attribution
  > "may be written in the local language."

  The examples it gives: "Powered by" and "Weather data provided by".
- **In Visual Crossing's words, the free plan page:**
  > "Commercial use is permitted on every Visual Crossing plan, even on our free plan."

  > "Just remember to provide appropriate attribution to Visual Crossing Weather near the displayed weather information."

  > "API keys should not be exposed in client-side code, public repositories, or downloadable applications."

  > "Applications must not present weather information as infallible or as a substitute for official emergency warnings."

  Not permitted:
  > "Publicly distributing raw weather data as downloadable files, bulk datasets, or API responses"

  or
  > "Offering a standalone weather data API, bulk download service, or competing data feed"
- **What we use:** the current conditions at a place, as one source in the blend (`lib/weather.js`, `fetchVisualCrossing`), and the mean temperature of the day before for the daily scoring of the sources (`app/api/calibrate/route.js`).
- **How we meet it:**
  - Attribution near the data: Visual Crossing's own value is shown in one place, the list of sources in the Sources panel (website and app). The credit line stands right under that list, in the same panel: "Weather data provided by Visual Crossing Weather", linked to https://www.visualcrossing.com/ (`app/components/outlook/SourcesPanel.jsx`, `lib/credits.js`; held by `lib/visual-crossing-display.test.js`). The same line is in the website's footer, on the app's More screen and on /terms.
  - No raw data handed on: our forecast address passes on, of Visual Crossing, only the temperature that list shows (`lib/sources.js`, `publicSources`). Its feels-like, rain, wind and condition words stay on the server. The landing page's example names it without a value, because no credit stands beside that example (`lib/landing.js`). The embed widget, the share images, the RSS feed, the app's widget feed and the rankings carry the blend or our own scores, never a value of one source. Our addresses send no cross-origin header, so another website's page cannot read their answers. The database tables that hold per-source values are not readable with the public key (row level security, no policy; looked at on 21 November 2026).
  - Open, for the owner: the forecast address is public JSON and now holds one Visual Crossing temperature per place, because the list is drawn in the browser from that answer. Whether that falls under "API responses" in the passage above is a reading of their terms that only Visual Crossing can settle.
  - The key: read from the server's environment (`VISUAL_CROSSING_KEY`) in the two files named above. No value is in this repository (the recorded test answers hold `x` in its place), none in the browser's code, and none in the apps, which load the website.
  - Not infallible, no substitute for official warnings: the disclaimer on /terms ("MetaBlend is a planning aid. It does not replace official warnings ..."; German original) and the note in the footer and on the More screen ("Forecasts can be wrong. Not for decisions that life, health or property depend on. For those, follow the official warnings.").
