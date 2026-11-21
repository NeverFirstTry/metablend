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

## Copernicus DEM (GLO-90): its licence, the notice and the liability sentence

- **Read:** 21 November 2026. First the collection's own page at the Copernicus Data Space Ecosystem, section "User Obligations": https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM. Then, on the owner's order of the same day, the two documents that page links, as text taken from the PDF files:
  - https://dataspace.copernicus.eu/sites/default/files/media/files/2025-06/copernicus_contributing_mission_data_access_v2_cop_dem_licenses.pdf ("Copernicus Data Access, Mission-specific Annex: Amendments to the CSCDA ESA - User Licence", version 15 February 2024)
  - https://s3.waw3-1.cloudferro.com/swift/v1/portal_uploads_prod/CSCDA_ESA_Mission-specific_Annex_31_Oct_22_latest.pdf ("Copernicus Contributing Mission Data Access, Licence between ESA and Copernicus User", issue date 21/02/2025)

  Both hold the same "Licence for COP-DEM-GLO-90-F Global 90m Full, Free & Open: Licence for the use of the Copernicus WorldDEM™-90". The passages below are from it, with the trademark sign where the documents print "TM" raised.
- **In the licence's words:**
  - Article 4, Right of Use:
    > "The Licensor grants to the User the following non-exclusive rights of use regarding the Copernicus WorldDEM™-90: (a) reproduction; (b) distribution; (c) communication to the General Public; (d) adaptation, modification and combination with other data and information."
  - Article 5:
    > "The use rights granted under this licence are free of charge to the User."
  - Article 6 (a):
    > "When communicating to the General Public or distributing the Copernicus WorldDEM™-90, the User shall inform the General Public of the source by using the following notice: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."
  - Article 6 (b):
    > "Where the Copernicus WorldDEM™-90 data have been adapted or modified, the User shall provide the following notice: "produced using Copernicus WorldDEM™-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"."
  - Article 6 (c):
    > "Users exercising the right of distribution or communication to the General Public of the Copernicus WorldDEM™-90, modified or not, must ensure that the Subsequent Users understand that neither the Licensor nor any other legal entities in charge of the Copernicus programme or the delivery of Copernicus data and information under the Copernicus programme may be held liable with regard to any aspect of the Copernicus WorldDEM™-90. The following sentence or its translation in any language shall be added by such Users in a licence or any legal warning or notice covering their distribution or communication to the General Public of the Copernicus WorldDEM™-90: "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM™-90"."
  - Article 6 (d):
    > "User shall make sure not to convey the impression to the General Public that the user's activities are officially endorsed by the Provider, the Licensor or any other legal entities in charge of the Copernicus programme or the delivery of Copernicus data and information under the Copernicus programme."
  - Article 7, Warranty and Liability:
    > "The Copernicus WorldDEM™-90 is made available to the Users 'as is'. The User uses it under its own responsibility."
- **What we use:** the GLO-90 tiles, read from disk on the owner's computer and never asked from a server at run time: the heights along hiking routes (`scripts/routes/local.mjs`, loaded into production on 19 November 2026) and a check of town positions. Shown to the public: a route's ascent, walking time and height profile, which are made from those heights. That is data "adapted or modified", so the notice of Article 6 (b) is the one that applies.
- **How we meet it:**
  - The notice of Article 6 (b) stands in the list of sources on /terms in all 13 languages, word for word, followed by what it is used for in the page's language (`app/terms/content.jsx`; held by `lib/legal-pages.test.js`).
  - The sentence of Article 6 (c) stands in the same line, in the licence's own English words on every page; the licence allows the sentence or a translation.
  - Article 6 (d): the site names Copernicus as a source and nowhere as a partner or supporter.
  - From 19 November until the deploy of this change the heights were shown without the notice (code audit of 20 November 2026, finding 20).
- **A difference between the page and the licence:** the collection's page prints the notice as "Copernicus WorldDEM-90", without the trademark sign. The licence is the document that binds, so /terms follows the licence.
