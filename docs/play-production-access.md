# Play Console: production access answers

Draft answers for the production application after the closed test. The test started on 2026-10-26, so 14 days are reached on 2026-11-09. Items in **[brackets]** are numbers or facts only the owner has; fill them in from Play Console before pasting.

## How did you recruit testers?

Testers joined through a public page, metablend.app/testers, available in all 13 languages of the app. It offers two routes: joining a Google Group, or leaving the Gmail address of the Google account on their phone, which we then add to the test's email list. **[Where the link was shared: for example the newspaper article, friends, forums.]** The closed test started on 2026-10-26 with 30 opted-in testers, including at least one tester outside Europe (Vietnam).

## How engaged were your testers?

30 testers opted in. **[Testers still opted in on day 14, and active users or sessions from Play Console.]** Testers used the app on real devices of their own, including a Red Magic 8S Pro on Android 15. Reports were detailed enough to reproduce: for example, one named the exact search terms that failed ("hanoi", "sa pa"). We shipped fixes within days of each report and released a new Android build (1.0.1) during the test for a fix that needed one.

## What feedback did you get?

Feedback came through the app's "Send feedback" link, which opens an email with the platform, app version, OS and language filled in. **[Number of reports received.]** The main themes were:

- **Speed:** switching between tabs lagged and restarted the screen.
- **Language:** a brief flash of English when a page opened in another language.
- **Clutter:** the forecast page opened with too many source cards expanded.
- **First start:** it wasn't clear what to do before a city was chosen.
- **Hiking:** walking times on some routes were far too short. "Near you" failed, and summit pages showed nothing useful after sunset.
- **Search:** searching for a town didn't find the summits around it.
- **Settings and polish:** the notification settings button did nothing, and the search field had a thick double focus border.

## What did you change because of it?

| Feedback | Change | Released |
|---|---|---|
| Tabs lagged and restarted | Forecast, Hiking and More now switch at once and keep their place; Hiking and More are fetched ahead | 2026-10-27 |
| English flash in other languages | Every page starts in the user's language and unit from its first frame | 2026-10-27 |
| Walking times too short | 35 of 69 stored routes had lost their heights. Heights were restored and all routes re-timed, and height noise no longer inflates ascent and time | 2026-10-27 |
| Too much on the forecast page | Source cards fold to one line, such as "20 sources · 86% agree", and the choice is remembered | 2026-10-27 |
| Unclear first start | The first start shows a "Use my location" card, and location is only requested when it's tapped | 2026-10-27 |
| Summit page empty after sunset | With no window left today, a peak opens on Tomorrow, and Today shows one line linking to it | 2026-10-27 |
| "Near you" failed | The lookup moved to a different data source and then to our own dataset. Empty results now explain themselves and show the nearest featured summits, and failures offer Retry | 2026-10-29 |
| City search found no summits | Searching a town now lists the summits and huts around it, nearest first, including local spellings | 2026-10-29 |
| Thick focus border | The search field's focus edge matches every other field | 2026-10-29 |
| Notification settings button did nothing | "Open settings" now opens the app's notification settings on Android (build 1.0.1) | 2026-10-30 |
