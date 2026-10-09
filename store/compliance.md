# Store compliance answers

Copy-paste answers for App Store Connect and the Google Play Console. They
match the privacy notice (`app/privacy/content.jsx`, https://metablend.app/privacy);
when one changes, change the other.

Facts behind every answer:
- No accounts, no sign-up, no ads, no in-app purchases, no tracking across apps or sites.
- Location: the phone's position never leaves the phone except (a) "Near me" peak
  search, rounded to about 10 km, and (b) "my location" for a city name, sent from
  the phone straight to BigDataCloud for that lookup. Nothing precise is stored.
- Push notifications (opt-in): push token, a hash of a random app key, home city,
  alert choices, briefing hour, planned peaks/dates/routes, language, unit, 14-day send log.
- Weather feedback (opt-in): city, temperature, condition, date, the city's map coordinates.
- Analytics: Plausible (cookieless, aggregate) and Vercel Speed Insights (anonymous load times).
- Everything travels over HTTPS.

## App Store — App Privacy

- **Do you or your third-party partners collect data from this app?** Yes.
- **Data used to track you:** none.
- **Data linked to you:** none.
- **Data not linked to you:**
  - Location → **Coarse Location** — purpose: App Functionality (peak search near you, rounded to ~10 km).
  - Identifiers → **Device ID** — purpose: App Functionality (push token, only when notifications are on).
  - User Content → **Other User Content** — purpose: App Functionality (weather feedback: city, temperature, condition).
  - Usage Data → **Product Interaction** — purpose: Analytics (Plausible, cookieless, aggregate counts).
  - Diagnostics → **Performance Data** — purpose: Analytics (Vercel Speed Insights, anonymous load times).
- **Precise Location:** not collected (the reverse-geocoding call goes from the phone to BigDataCloud; nothing is stored).
- **Privacy Policy URL:** https://metablend.app/privacy

## Google Play — Data safety

**Step 2 — Data collection and security**
- Collect or share required data types? **Yes**
- Encrypted in transit? **Yes**
- Users can request deletion? **Yes** (email info@metablend.app; turning notifications off deletes the push record)
- Accounts? **None**

**Step 3 — Data types:** tick these six, nothing else.

| Type | What it is | Purpose | Ephemeral |
|---|---|---|---|
| Location → Approximate location | Near you, peak search (~5–10 km) | App functionality | Yes |
| Location → Precise location | "My location" → BigDataCloud city lookup | App functionality | Yes |
| Device or other IDs | Push token | App functionality | No |
| App activity → App interactions | Plausible page counts | Analytics | No |
| App activity → Other user-generated content | Weather feedback, planned hikes | App functionality | No |
| App info and performance → Diagnostics | Speed Insights load times | Analytics | No |

**Step 4 — For every type:** collected **yes**, shared **no**, optional **yes**.

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
