# Wording audit: never promise safety (2026-11-05)

Every string changed, per language. A window, a start time or a day is now "favourable", not "safe".

**Left as they are, on purpose:** storm and severe-weather warnings (`warningStorm`, "Stay safe"), "not a safety guarantee" (`hikeDisclaimer`), "not for safety-critical decisions" (`betaDisclaimer`, `footerData`, the terms), "safe and stable operation" of the servers in the privacy notice (your German text), and the screenshot caption "how sure the week is", which is about certainty. "Safely up and down" appears nowhere in the repo.

`lib/wording.test.js` now fails if a pack, listing or caption calls a window, start or day safe.

## English

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Summit forecasts for any peak: wind up top, freezing level, thunderstorm risk and the safe window to be on the summit. | Summit forecasts for any peak: wind up top, freezing level, thunderstorm risk and the favourable window to be on the summit. |
| UI/push `swNone` | No safe summit window {day} | No favourable summit window {day} |
| UI/push `routeSafeNote` | Every stage inside the safe window | Every stage inside the favourable window |
| UI/push `routeNoStart` | No safe start {day} | No favourable start {day} |
| UI/push `routeNextDay` | Next safe day: {day}, start {start} | Next favourable day: {day}, start {start} |
| UI/push `pushRouteStart` | Start by {start} — summit ~{high} (safe to start until {latest}) | Start by {start} — summit ~{high} (favourable start until {latest}) |
| UI/push `pushRouteNone` | No safe start {day}: {reason} | No favourable start {day}: {reason} |
| UI/push `widgetNoWindow` | No safe window | No favourable window |
| Store listing `android/en-US/full_description.txt` | • The safe window to be on the summit | • The favourable window to be on the summit |
| Store listing `en-US/description.txt` | • The safe window to be on the summit | • The favourable window to be on the summit |
| Store listing `en-US/promotional_text.txt` | the safe time to be on top | the favourable time to be on top |
| Screenshot caption 4 `store/captions.json` | Know when the summit is safe | Know the favourable summit window |
| Page description `app/hike/page.js` | the safe summit window | the favourable summit window |
| Page description `app/mountains/page.js` | the safe summit window | the favourable summit window |
| Page description `app/mountains/[peak]/page.js` | today's safe summit window | today's favourable summit window |
| Device checklist `mobile/README.md` | "No safe window" | "No favourable window" |
| Device checklist `mobile/README.md` | "No safe start" | "No favourable start" |

## German

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Gipfelprognosen für jeden Berg: Wind am Gipfel, Nullgradgrenze, Gewitterrisiko und das sichere Zeitfenster für den Gipfel. | Gipfelprognosen für jeden Berg: Wind am Gipfel, Nullgradgrenze, Gewitterrisiko und das günstige Zeitfenster für den Gipfel. |
| UI/push `swNone` | Kein sicheres Gipfelfenster {day} | Kein günstiges Gipfelfenster {day} |
| UI/push `routeSafeNote` | Jede Etappe im sicheren Fenster | Jede Etappe im günstigen Fenster |
| UI/push `routeNoStart` | Kein sicherer Start {day} | Kein günstiger Start {day} |
| UI/push `routeNextDay` | Nächster sicherer Tag: {day}, Start {start} | Nächster günstiger Tag: {day}, Start {start} |
| UI/push `pushRouteStart` | Start um {start} – Gipfel ~{high} (sicherer Start bis {latest}) | Start um {start} – Gipfel ~{high} (günstiger Start bis {latest}) |
| UI/push `pushRouteNone` | Kein sicherer Start {day}: {reason} | Kein günstiger Start {day}: {reason} |
| UI/push `widgetNoWindow` | Kein sicheres Fenster | Kein günstiges Fenster |
| Store listing `android/de-DE/full_description.txt` | • Das sichere Zeitfenster am Gipfel | • Das günstige Zeitfenster am Gipfel |
| Store listing `de-DE/description.txt` | • Das sichere Zeitfenster am Gipfel | • Das günstige Zeitfenster am Gipfel |
| Store listing `de-DE/promotional_text.txt` | das sichere Zeitfenster am Gipfel | das günstige Zeitfenster am Gipfel |
| Screenshot caption 4 `store/captions.json` | Wissen, wann der Gipfel sicher ist | Das günstige Gipfelfenster kennen |

## French

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Prévisions au sommet pour chaque montagne : vent en altitude, isotherme 0 °C, risque d’orage et le créneau sûr pour le sommet. | Prévisions au sommet pour chaque montagne : vent en altitude, isotherme 0 °C, risque d’orage et le créneau favorable pour le sommet. |
| UI/push `swNone` | Pas de créneau sûr pour le sommet {day} | Pas de créneau favorable pour le sommet {day} |
| UI/push `routeSafeNote` | Chaque étape dans la fenêtre sûre | Chaque étape dans la fenêtre favorable |
| UI/push `routeNoStart` | Aucun départ sûr {day} | Aucun départ favorable {day} |
| UI/push `routeNextDay` | Prochain jour sûr : {day}, départ {start} | Prochain jour favorable : {day}, départ {start} |
| UI/push `pushRouteStart` | Départ à {start} — sommet ~{high} (départ sûr jusqu’à {latest}) | Départ à {start} — sommet ~{high} (départ favorable jusqu’à {latest}) |
| UI/push `pushRouteNone` | Aucun départ sûr {day} : {reason} | Aucun départ favorable {day} : {reason} |
| UI/push `widgetNoWindow` | Pas de créneau sûr | Pas de créneau favorable |
| Store listing `android/fr-FR/full_description.txt` | • Le créneau sûr pour être au sommet | • Le créneau favorable pour être au sommet |
| Store listing `fr-FR/description.txt` | • Le créneau sûr pour être au sommet | • Le créneau favorable pour être au sommet |
| Store listing `fr-FR/promotional_text.txt` | le créneau sûr au sommet | le créneau favorable au sommet |
| Screenshot caption 4 `store/captions.json` | Savoir quand le sommet est sûr | Connaître le créneau favorable au sommet |

## Spanish

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Previsiones en la cumbre para cualquier montaña: viento arriba, cota de congelación, riesgo de tormenta y la ventana segura para hacer cumbre. | Previsiones en la cumbre para cualquier montaña: viento arriba, cota de congelación, riesgo de tormenta y la ventana favorable para hacer cumbre. |
| UI/push `swNone` | Sin ventana segura de cumbre {day} | Sin ventana favorable de cumbre {day} |
| UI/push `routeSafeNote` | Cada tramo dentro de la ventana segura | Cada tramo dentro de la ventana favorable |
| UI/push `routeNoStart` | Ninguna salida segura {day} | Ninguna salida favorable {day} |
| UI/push `routeNextDay` | Próximo día seguro: {day}, salida {start} | Próximo día favorable: {day}, salida {start} |
| UI/push `pushRouteStart` | Sal a las {start} — cumbre ~{high} (salida segura hasta las {latest}) | Sal a las {start} — cumbre ~{high} (salida favorable hasta las {latest}) |
| UI/push `pushRouteNone` | Ninguna salida segura {day}: {reason} | Ninguna salida favorable {day}: {reason} |
| UI/push `widgetNoWindow` | Sin ventana segura | Sin ventana favorable |
| Store listing `android/es-ES/full_description.txt` | • La ventana segura para estar en la cima | • La ventana favorable para estar en la cima |
| Store listing `es-ES/description.txt` | • La ventana segura para estar en la cima | • La ventana favorable para estar en la cima |
| Store listing `es-ES/promotional_text.txt` | la ventana segura en la cima | la ventana favorable en la cima |
| Screenshot caption 4 `store/captions.json` | Sabe cuándo la cumbre es segura | Conoce la ventana favorable de cumbre |

## Italian

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Previsioni in vetta per ogni montagna: vento in quota, zero termico, rischio temporali e la finestra sicura per la vetta. | Previsioni in vetta per ogni montagna: vento in quota, zero termico, rischio temporali e la finestra favorevole per la vetta. |
| UI/push `swNone` | Nessuna finestra sicura per la vetta {day} | Nessuna finestra favorevole per la vetta {day} |
| UI/push `routeSafeNote` | Ogni tappa nella finestra sicura | Ogni tappa nella finestra favorevole |
| UI/push `routeNoStart` | Nessuna partenza sicura {day} | Nessuna partenza favorevole {day} |
| UI/push `routeNextDay` | Prossimo giorno sicuro: {day}, partenza {start} | Prossimo giorno favorevole: {day}, partenza {start} |
| UI/push `pushRouteStart` | Partenza alle {start} — vetta ~{high} (partenza sicura fino alle {latest}) | Partenza alle {start} — vetta ~{high} (partenza favorevole fino alle {latest}) |
| UI/push `pushRouteNone` | Nessuna partenza sicura {day}: {reason} | Nessuna partenza favorevole {day}: {reason} |
| UI/push `widgetNoWindow` | Nessuna finestra sicura | Nessuna finestra favorevole |
| Store listing `android/it-IT/full_description.txt` | • La finestra sicura per stare in vetta | • La finestra favorevole per stare in vetta |
| Store listing `it/description.txt` | • La finestra sicura per stare in vetta | • La finestra favorevole per stare in vetta |
| Store listing `it/promotional_text.txt` | la finestra sicura per la cima | la finestra favorevole per la cima |
| Screenshot caption 4 `store/captions.json` | Sai quando la vetta è sicura | Conosci la finestra favorevole per la vetta |

## Dutch

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Topverwachtingen voor elke berg: wind op de top, vriesgrens, onweerskans en het veilige venster om op de top te staan. | Topverwachtingen voor elke berg: wind op de top, vriesgrens, onweerskans en het gunstige venster om op de top te staan. |
| UI/push `swNone` | Geen veilig topvenster {day} | Geen gunstig topvenster {day} |
| UI/push `routeSafeNote` | Elke etappe binnen het veilige venster | Elke etappe binnen het gunstige venster |
| UI/push `routeNoStart` | Geen veilig vertrek {day} | Geen gunstig vertrek {day} |
| UI/push `routeNextDay` | Volgende veilige dag: {day}, vertrek {start} | Volgende gunstige dag: {day}, vertrek {start} |
| UI/push `pushRouteStart` | Vertrek vóór {start} — top ~{high} (veilig vertrekken tot {latest}) | Vertrek vóór {start} — top ~{high} (gunstig vertrek tot {latest}) |
| UI/push `pushRouteNone` | Geen veilig vertrek {day}: {reason} | Geen gunstig vertrek {day}: {reason} |
| UI/push `widgetNoWindow` | Geen veilig venster | Geen gunstig venster |
| Store listing `android/nl-NL/full_description.txt` | • Het veilige venster om op de top te staan | • Het gunstige venster om op de top te staan |
| Store listing `nl-NL/description.txt` | • Het veilige venster om op de top te staan | • Het gunstige venster om op de top te staan |
| Store listing `nl-NL/promotional_text.txt` | het veilige venster op de top | het gunstige venster op de top |
| Screenshot caption 4 `store/captions.json` | Weet wanneer de top veilig is | Ken het gunstige topvenster |

## Polish

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Prognozy na szczytach dla każdej góry: wiatr na górze, granica zamarzania, ryzyko burzy i bezpieczne okno na pobyt na szczycie. | Prognozy na szczytach dla każdej góry: wiatr na górze, granica zamarzania, ryzyko burzy i korzystne okno na pobyt na szczycie. |
| UI/push `swNone` | Brak bezpiecznego okna szczytowego {day} | Brak korzystnego okna szczytowego {day} |
| UI/push `routeSafeNote` | Każdy odcinek w bezpiecznym oknie | Każdy odcinek w korzystnym oknie |
| UI/push `routeNoStart` | Brak bezpiecznego wyjścia {day} | Brak korzystnego wyjścia {day} |
| UI/push `routeNextDay` | Następny bezpieczny dzień: {day}, wyjście {start} | Następny korzystny dzień: {day}, wyjście {start} |
| UI/push `pushRouteStart` | Wyjdź do {start} — szczyt ~{high} (bezpieczne wyjście do {latest}) | Wyjdź do {start} — szczyt ~{high} (korzystne wyjście do {latest}) |
| UI/push `pushRouteNone` | Brak bezpiecznego wyjścia {day}: {reason} | Brak korzystnego wyjścia {day}: {reason} |
| UI/push `widgetNoWindow` | Brak bezpiecznego okna | Brak korzystnego okna |
| Store listing `android/pl-PL/full_description.txt` | • Bezpieczne okno na pobyt na szczycie | • Korzystne okno na pobyt na szczycie |
| Store listing `pl/description.txt` | • Bezpieczne okno na pobyt na szczycie | • Korzystne okno na pobyt na szczycie |
| Store listing `pl/promotional_text.txt` | bezpieczne okno na szczycie | korzystne okno na szczycie |
| Screenshot caption 4 `store/captions.json` | Wiedz, kiedy szczyt jest bezpieczny | Poznaj korzystne okno na szczyt |

## Czech

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Předpovědi pro vrcholy jakékoli hory: vítr nahoře, nulová izoterma, riziko bouřek a bezpečné okno na vrcholu. | Předpovědi pro vrcholy jakékoli hory: vítr nahoře, nulová izoterma, riziko bouřek a příznivé okno na vrcholu. |
| UI/push `swNone` | Žádné bezpečné okno na vrcholu {day} | Žádné příznivé okno na vrcholu {day} |
| UI/push `routeSafeNote` | Každý úsek v bezpečném okně | Každý úsek v příznivém okně |
| UI/push `routeNoStart` | Žádný bezpečný start {day} | Žádný příznivý start {day} |
| UI/push `routeNextDay` | Další bezpečný den: {day}, start {start} | Další příznivý den: {day}, start {start} |
| UI/push `pushRouteStart` | Vyrazte do {start} — vrchol ~{high} (bezpečný start do {latest}) | Vyrazte do {start} — vrchol ~{high} (příznivý start do {latest}) |
| UI/push `pushRouteNone` | Žádný bezpečný start {day}: {reason} | Žádný příznivý start {day}: {reason} |
| UI/push `widgetNoWindow` | Žádné bezpečné okno | Žádné příznivé okno |
| Store listing `android/cs-CZ/full_description.txt` | • Bezpečné okno na vrcholu | • Příznivé okno na vrcholu |
| Store listing `cs/description.txt` | • Bezpečné okno na vrcholu | • Příznivé okno na vrcholu |
| Store listing `cs/promotional_text.txt` | bezpečné okno na vrcholu | příznivé okno na vrcholu |
| Screenshot caption 4 `store/captions.json` | Vězte, kdy je vrchol bezpečný | Poznejte příznivé okno na vrchol |

## Slovene

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Napovedi za vrhove vseh gora: veter na vrhu, ničta izoterma, nevarnost neviht in varno okno za vrh. | Napovedi za vrhove vseh gora: veter na vrhu, ničta izoterma, nevarnost neviht in ugodno okno za vrh. |
| UI/push `swNone` | Ni varnega okna za vrh {day} | Ni ugodnega okna za vrh {day} |
| UI/push `routeSafeNote` | Vsak odsek v varnem oknu | Vsak odsek v ugodnem oknu |
| UI/push `routeNoStart` | Ni varnega odhoda {day} | Ni ugodnega odhoda {day} |
| UI/push `routeNextDay` | Naslednji varen dan: {day}, odhod {start} | Naslednji ugoden dan: {day}, odhod {start} |
| UI/push `pushRouteStart` | Odidi do {start} — vrh ~{high} (varen odhod do {latest}) | Odidi do {start} — vrh ~{high} (ugoden odhod do {latest}) |
| UI/push `pushRouteNone` | Ni varnega odhoda {day}: {reason} | Ni ugodnega odhoda {day}: {reason} |
| UI/push `widgetNoWindow` | Ni varnega okna | Ni ugodnego okna |
| Store listing `android/sl/full_description.txt` | • Varno okno za vrh | • Ugodno okno za vrh |
| Screenshot caption 4 `store/captions.json` | Vedi, kdaj je vrh varen | Spoznaj ugodno okno za vrh |

## Portuguese

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | Previsões de cume para qualquer montanha: vento no topo, nível de congelamento, risco de tempestade e a janela segura para estar no cume. | Previsões de cume para qualquer montanha: vento no topo, nível de congelamento, risco de tempestade e a janela favorável para estar no cume. |
| UI/push `swNone` | Sem janela de cume segura {day} | Sem janela de cume favorável {day} |
| UI/push `routeSafeNote` | Cada trecho dentro da janela segura | Cada trecho dentro da janela favorável |
| UI/push `routeNoStart` | Sem saída segura {day} | Sem saída favorável {day} |
| UI/push `routeNextDay` | Próximo dia seguro: {day}, saída {start} | Próximo dia favorável: {day}, saída {start} |
| UI/push `pushRouteStart` | Saia até {start} — cume ~{high} (saída segura até {latest}) | Saia até {start} — cume ~{high} (saída favorável até {latest}) |
| UI/push `pushRouteNone` | Sem saída segura {day}: {reason} | Sem saída favorável {day}: {reason} |
| UI/push `widgetNoWindow` | Sem janela segura | Sem janela favorável |
| Store listing `android/pt-BR/full_description.txt` | • A janela segura para estar no cume | • A janela favorável para estar no cume |
| Store listing `pt-BR/description.txt` | • A janela segura para estar no cume | • A janela favorável para estar no cume |
| Store listing `pt-BR/promotional_text.txt` | a janela segura no topo | a janela favorável no topo |
| Screenshot caption 4 `store/captions.json` | Saiba quando o cume é seguro | Conheça a janela favorável no cume |

## Japanese

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | あらゆる山の山頂予報：山頂の風、凍結高度、雷のリスク、そして山頂に安全にいられる時間帯。 | あらゆる山の山頂予報：山頂の風、凍結高度、雷のリスク、そして山頂に向かうのに好条件の時間帯。 |
| UI/push `swNone` | {day}は安全な山頂時間帯がありません | {day}は好条件の山頂時間帯がありません |
| UI/push `routeSafeNote` | すべての区間が安全な時間帯内です | すべての区間が好条件の時間帯内です |
| UI/push `routeNoStart` | {day}は安全に出発できる時間がありません | {day}は好条件で出発できる時間がありません |
| UI/push `routeNextDay` | 次の安全な日：{day}、{start}出発 | 次の好条件の日：{day}、{start}出発 |
| UI/push `pushRouteStart` | {start}までに出発 — 山頂 ~{high}（{latest}まで安全に出発できます） | {start}までに出発 — 山頂 ~{high}（{latest}まで好条件で出発できます） |
| UI/push `pushRouteNone` | {day}は安全に出発できません：{reason} | {day}は好条件で出発できません：{reason} |
| UI/push `widgetNoWindow` | 安全な時間帯なし | 好条件の時間帯なし |
| Store listing `android/ja-JP/full_description.txt` | • 山頂に安全にいられる時間帯 | • 山頂に向かうのに好条件の時間帯 |
| Store listing `ja/description.txt` | • 山頂に安全にいられる時間帯 | • 山頂に向かうのに好条件の時間帯 |
| Store listing `ja/promotional_text.txt` | 山頂に安全にいられる時間帯 | 山頂に向かうのに好条件の時間帯 |
| Screenshot caption 4 `store/captions.json` | 山頂が安全な時間がわかる | 山頂の好条件の時間帯がわかる |

## Chinese

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | 任何山峰的山顶预报：山顶风力、冻结高度、雷暴风险，以及可以安全登顶的时间段。 | 任何山峰的山顶预报：山顶风力、冻结高度、雷暴风险，以及适宜登顶的时间段。 |
| UI/push `swNone` | {day}没有安全的登顶时段 | {day}没有适宜的登顶时段 |
| UI/push `routeSafeNote` | 每一段都在安全时段内 | 每一段都在适宜时段内 |
| UI/push `routeNoStart` | {day}没有安全的出发时间 | {day}没有适宜的出发时间 |
| UI/push `routeNextDay` | 下一个安全日：{day}，{start} 出发 | 下一个适宜日：{day}，{start} 出发 |
| UI/push `pushRouteStart` | {start} 前出发 — 登顶 ~{high}（{latest} 前出发都安全） | {start} 前出发 — 登顶 ~{high}（{latest} 前出发都适宜） |
| UI/push `pushRouteNone` | {day}没有安全的出发时间：{reason} | {day}没有适宜的出发时间：{reason} |
| UI/push `widgetNoWindow` | 没有安全时段 | 没有适宜时段 |
| Store listing `android/zh-CN/full_description.txt` | • 可以安全登顶的时段 | • 适宜登顶的时段 |
| Store listing `zh-Hans/description.txt` | • 可以安全登顶的时段 | • 适宜登顶的时段 |
| Store listing `zh-Hans/promotional_text.txt` | 可以安全登顶的时段 | 适宜登顶的时段 |
| Screenshot caption 4 `store/captions.json` | 知道何时登顶最安全 | 知道何时最适宜登顶 |

## Korean

| Where | Before | After |
|---|---|---|
| UI/push `hikeTeaserSub` | 모든 산의 정상 예보: 정상의 바람, 결빙 고도, 뇌우 위험, 그리고 정상에 안전하게 머물 수 있는 시간대. | 모든 산의 정상 예보: 정상의 바람, 결빙 고도, 뇌우 위험, 그리고 정상에 머물기 유리한 시간대. |
| UI/push `swNone` | {day} 안전한 정상 시간대 없음 | {day} 유리한 정상 시간대 없음 |
| UI/push `routeSafeNote` | 모든 구간이 안전한 시간대 안이에요 | 모든 구간이 유리한 시간대 안이에요 |
| UI/push `routeNoStart` | {day} 안전한 출발 시간 없음 | {day} 유리한 출발 시간 없음 |
| UI/push `routeNextDay` | 다음 안전한 날: {day}, {start} 출발 | 다음 유리한 날: {day}, {start} 출발 |
| UI/push `pushRouteStart` | {start}까지 출발 — 정상 ~{high} ({latest}까지 출발하면 안전) | {start}까지 출발 — 정상 ~{high} ({latest}까지 출발이 유리) |
| UI/push `pushRouteNone` | {day} 안전한 출발 시간 없음: {reason} | {day} 유리한 출발 시간 없음: {reason} |
| UI/push `widgetNoWindow` | 안전한 시간대 없음 | 유리한 시간대 없음 |
| Store listing `android/ko-KR/full_description.txt` | • 정상에 안전하게 머물 수 있는 시간대 | • 정상에 머물기 유리한 시간대 |
| Store listing `ko/description.txt` | • 정상에 안전하게 머물 수 있는 시간대 | • 정상에 머물기 유리한 시간대 |
| Store listing `ko/promotional_text.txt` | 정상에 안전하게 머물 시간대 | 정상에 머물기 유리한 시간대 |
| Screenshot caption 4 `store/captions.json` | 정상이 안전한 때를 알려 줘요 | 정상에 유리한 때를 알려 줘요 |
