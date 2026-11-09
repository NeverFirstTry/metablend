# Store compliance answers

Copy-paste answers for App Store Connect and the Google Play Console. They
match the privacy notice (`app/privacy/content.jsx`, https://metablend.app/privacy);
when one changes, change the other.

Facts behind every answer:
- No accounts, no sign-up, no ads, no in-app purchases, no tracking across apps or sites.
- Location: the phone's exact position never leaves the phone. Only rounded
  positions go to our own server: (a) "Near me" peak search, rounded to about
  10 km, and the list of summits near you, to about 5 km, (b) "my location",
  rounded to about 10 km: our server names the town from its own list and picks
  the right town of that name (where the list has none nearby, the server asks
  OpenStreetMap's Nominatim with the same rounded position). Nothing precise is
  collected, shared or stored.
- Push notifications (opt-in): push token, a hash of a random app key, home city,
  alert choices, briefing hour, planned peaks/dates/routes, language, unit, 14-day send log.
- Weather feedback (opt-in): city, temperature, condition, date, the city's map coordinates.
- Analytics: Plausible and Vercel Web Analytics (cookieless, aggregate page counts) and Vercel Speed Insights (anonymous load times).
- Android tester sign-up (opt-in form on /testers, reachable inside the app until both stores are live): e-mail address, optionally phone model and country; deleted when the closed test ends.
- Everything travels over HTTPS.

## App Store — App Privacy

- **Do you or your third-party partners collect data from this app?** Yes.
- **Data used to track you:** none.
- **Data linked to you:**
  - Contact Info → **Email Address** — purpose: App Functionality (the Android tester sign-up on /testers, only if you fill the form in; deleted when the closed test ends).
- **Data not linked to you:**
  - Location → **Coarse Location** — purpose: App Functionality (peak search near you and the town for "my location", rounded to ~5–10 km).
  - Identifiers → **Device ID** — purpose: App Functionality (push token, only when notifications are on).
  - User Content → **Other User Content** — purpose: App Functionality (weather feedback: city, temperature, condition).
  - Usage Data → **Product Interaction** — purpose: Analytics (Plausible and Vercel Web Analytics, cookieless, aggregate counts).
  - Diagnostics → **Performance Data** — purpose: Analytics (Vercel Speed Insights, anonymous load times).
- **Precise Location:** not collected (the position is rounded on the phone before anything is sent).
- **Privacy Policy URL:** https://metablend.app/privacy

## Google Play — Store settings

Grow users → Store presence → Store settings.
- **App category:** Weather
- **Tags** (up to 5, from Google's list — the closest match if a name differs): Weather, Weather forecast, Hiking, Outdoors, Maps & navigation
- **Contact email:** info@metablend.app · **Website:** https://metablend.app

## Google Play — Data safety

**Step 2 — Data collection and security**
- Collect or share required data types? **Yes**
- Encrypted in transit? **Yes**
- Users can request deletion? **Yes** (email info@metablend.app; turning notifications off deletes the push record)
- Accounts? **None**

**Step 3 — Data types:** tick these six, nothing else (Precise location is no longer ticked since "my location" asks our own server with a rounded position; untick it in the form once that version is live).

| Type | What it is | Purpose | Ephemeral |
|---|---|---|---|
| Location → Approximate location | Near you, peak search, the town for "my location" (~5–10 km) | App functionality | Yes |
| Personal info → Email address | Android tester sign-up on /testers (optional form) | App functionality | No |
| Device or other IDs | Push token | App functionality | No |
| App activity → App interactions | Plausible and Vercel Web Analytics page counts | Analytics | No |
| App activity → Other user-generated content | Weather feedback, planned hikes | App functionality | No |
| App info and performance → Diagnostics | Speed Insights load times | Analytics | No |

**Step 4 — For every type:** collected **yes**, shared **no**, optional **yes**. The e-mail address goes into our own tester list in Play Console (Google as the platform, not a third party); if the reviewer treats that as sharing, answer shared **yes — Google, to run the closed test**.

Privacy policy: https://metablend.app/privacy

## Content rating

IARC questionnaire (Play) and Apple's age rating:
- Category: Reference, news or educational / Utility (weather).
- Violence, fear, sexuality, nudity, profanity, drugs, alcohol, tobacco, gambling, horror: **none**.
- Users can interact or exchange content with each other: **no** (weather feedback only appears as anonymous city-level points on an accuracy map).
- Shares the user's location with other users: **no**.
- Digital purchases: **no**.
- Unrestricted web access: **no** (links open the app's own pages and the privacy/terms pages).
- Expected result: **Everyone / PEGI 3 / USK 0**; Apple **4+**.

## Export compliance

- **Does your app use encryption?** Yes, only standard encryption provided by the operating system (HTTPS/TLS).
- **Exempt:** yes — `ITSAppUsesNonExemptEncryption = NO` is in `mobile/ios/App/App/Info.plist`, so App Store Connect stops asking per build.
- Google Play: no separate declaration needed for standard HTTPS.

## Target audience

- **Target age groups:** 13–15, 16–17, 18 and over (not designed for children under 13).
- **Appeals to children?** No.

## Ads

- **Does your app contain ads?** No.

## App access

- **All functionality is available without special access** (no login, no codes). Notifications and location are optional permissions the reviewer can grant or skip.
