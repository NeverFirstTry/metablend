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

## Copernicus DEM (GLO-90): the notice for data made from it

- **Read:** 21 November 2026, Copernicus Data Space Ecosystem, the collection's own page, section "User Obligations": https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM. The page was read through this project's fetch tool, which hands long passages over in parts; the notice below was put together from two consecutive parts. The two licence documents the page links were not read.
- **In the page's words:**
  > "Where the Copernicus data have been adapted or modified, the User shall provide the following notice:"

  > "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"

  On access:
  > "The GLO-30 and GLO-90 datasets are available worldwide with a free license."
- **What we use:** the GLO-90 tiles, read from disk on the owner's computer and never asked from a server at run time: the heights along hiking routes (`scripts/routes/local.mjs`, loaded into production on 19 November 2026) and a check of town positions. Shown to the public: a route's ascent, walking time and height profile, which are made from those heights.
- **How we meet it:** the notice stands in the list of sources on /terms in all 13 languages, word for word, followed by what it is used for in the page's language (`app/terms/content.jsx`; held by `lib/legal-pages.test.js`). From 19 November until the deploy of this change the heights were shown without it (code audit of 20 November 2026, finding 20).
- **Not on that page:** a sentence about liability to pass on. If one of the two linked licence documents asks for one, it is still missing here.
