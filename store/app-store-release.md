# App Store release — what goes where

In App Store Connect → MetaBlend, top to bottom. Files are in this repo; each
language has its own folder (`fastlane/metadata/de-DE/`, `…/ja/`, …).

## 1. App Information (left menu)
- **Subtitle** (per language): `fastlane/metadata/<language>/subtitle.txt`
- **Category:** Primary **Weather**, secondary **Navigation** (or leave empty)
- **Content Rights:** "Yes, it contains third-party content" → "I have the rights" (weather data under the providers' licences, credited on /terms)
- **Age Rating:** answer **None / No** to everything → **4+** (see `store/compliance.md`, Content rating)
- **Digital Services Act:** **Not a trader** — free app, no income. Switch to trader before adding any purchases.

## 2. Pricing and Availability
- **Price:** Free · **Availability:** all countries

## 3. App Privacy
- Copy the **App Store — App Privacy** section of `store/compliance.md` (all "not linked to you", no tracking).
- **Privacy Policy URL:** https://metablend.app/privacy

## 4. Version 1.0 (iOS App, "Prepare for Submission")
For **each language** (switch at the top right):
- **Screenshots (6.9" display):** `fastlane/screenshots/<language>/1.png … 5.png` — drag all five in
- **Promotional Text:** `promotional_text.txt`
- **Description:** `description.txt`
- **Keywords:** `keywords.txt`
- **Support URL / Marketing URL:** `support_url.txt` / `marketing_url.txt` (both https://metablend.app)

Once, for all languages:
- **Build:** pick the newest TestFlight build (build 2 is fine — the app loads its pages live)
- **Copyright:** `2026 <your full name>`
- **Version release:** "Manually release this version" (you press the button after approval)

## 5. App Review Information
- **Sign-in required:** No
- **Contact:** your name, phone, info@metablend.app
- **Notes** (paste):

  > MetaBlend needs no account. Everything works without granting permissions: location is optional (it fills in "my location" and the summits near you), notifications are optional (weather alerts and hike reminders you switch on yourself). The Hiking tab is the app's own feature: search any peak (e.g. "Großglockner") to see its summit forecast; "Plan a hike" sets a reminder for a date.

## 6. App Accessibility
- Only after the device checks in `mobile/README.md` → "Accessibility": tick VoiceOver, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion.

## 7. Submit
- **Add for Review → Submit.** Review usually takes 1–2 days. Then press **Release**.
