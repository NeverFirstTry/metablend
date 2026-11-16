import Foundation
import WidgetKit
import SwiftUI

// The home-screen widgets (docs/widgets-spec.md). The texts, colours and backgrounds per theme are generated into
// WidgetLook.swift; the icons and scenery are template images in Assets.xcassets.

// MARK: - What the app syncs (WidgetBridge → App Group)

let appGroup = "group.app.metablend"

struct WidgetSettings: Codable {
    struct Hike: Codable {
        let name: String
        let lat: Double
        let lon: Double
        let elev: Double
        let date: String
    }
    let lang: String
    let unit: String
    let base: String
    let home: String?
    let recent: [String]
    let hikes: [Hike]
    let theme: String? // the app icon's theme: default, mono, winter or sky (absent from apps before 2026-11-16)

    static func load() -> WidgetSettings? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget_settings"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSettings.self, from: data)
    }
}

// MARK: - Payloads from /api/app-widget (display-ready text)

struct WeatherPayload: Codable {
    struct Now: Codable { let temp: String; let icon: String; let text: String; let sky: String; let rain: String?; let wind: String? }
    struct Today: Codable { let hi: String; let lo: String }
    struct Hour: Codable { let t: String; let ts: Double; let icon: String; let temp: String; let rain: String; let sky: String }
    struct Day: Codable { let day: String; let icon: String; let hi: String; let lo: String }
    let city: String
    let path: String
    let now: Now
    let today: Today
    let hours: [Hour]
    let days: [Day]

    // the gallery and the placeholder: Lienz on 16 November
    static let sample = WeatherPayload(
        city: "Lienz", path: "/",
        now: Now(temp: "7°", icon: "⛅", text: "Partly cloudy", sky: "dusk", rain: "9%", wind: "3 km/h"),
        today: Today(hi: "11°", lo: "1°"),
        hours: [("17:00", "☁", "6°", "7%"), ("18:00", "🌙", "5°", "4%"), ("19:00", "🌙", "5°", "2%"), ("20:00", "🌙", "4°", "2%"), ("21:00", "☁", "4°", "1%"), ("22:00", "☁", "4°", "1%")]
            .map { Hour(t: $0.0, ts: 0, icon: $0.1, temp: $0.2, rain: $0.3, sky: "night") },
        days: [("Tue", "🌦", "10°", "3°"), ("Wed", "🌦", "13°", "4°"), ("Thu", "🌦", "9°", "2°"), ("Fri", "⛅", "11°", "2°"), ("Sat", "🌦", "8°", "1°")]
            .map { Day(day: $0.0, icon: $0.1, hi: $0.2, lo: $0.3) }
    )
}

struct HikePayload: Codable {
    let peak: String
    let day: String
    let path: String
    let line: String?
    let label: String? // "Summit window" above a window; absent from servers before 2026-11-16
    let good: Bool?
    let icon: String
    let hi: String
    let lo: String
    let wind: String
    let rain: String
    let storm: String?
    let sky: String

    static let sample = HikePayload(
        peak: "Hochstein", day: "Tomorrow", path: "/hike", line: "08:00-13:33", label: "Summit window", good: true,
        icon: "⛅", hi: "2°", lo: "-3°", wind: "25 km/h", rain: "72%", storm: "Storm risk: low", sky: "day"
    )
}

enum Api {
    static func get<T: Decodable>(_ type: T.Type, base: String, query: [String: String]) async -> (T?, Int) {
        guard var c = URLComponents(string: base + "/api/app-widget") else { return (nil, 0) }
        c.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        c.percentEncodedQuery = c.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let url = c.url else { return (nil, 0) }
        do {
            let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 10))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else { return (nil, status) }
            return (try? JSONDecoder().decode(T.self, from: data), status)
        } catch {
            return (nil, 0)
        }
    }
}

enum Cache {
    private static var store: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        store?.set(data, forKey: "cache.\(key)")
        store?.set(Date().timeIntervalSince1970, forKey: "cache.\(key).at")
    }
    static func load<T: Decodable>(_ type: T.Type, key: String) -> (T, Date)? {
        guard let data = store?.data(forKey: "cache.\(key)"),
              let value = try? JSONDecoder().decode(T.self, from: data),
              let at = store?.double(forKey: "cache.\(key).at"), at > 0 else { return nil }
        return (value, Date(timeIntervalSince1970: at))
    }
}

// MARK: - Look

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

// The theme, the phone's appearance, and whether the home screen is tinted or clear (then the system draws the
// content in one colour and removes the background)
struct Look {
    let theme: WidgetTheme
    let dark: Bool
    let accented: Bool
    var p: Palette { theme.palette(dark: dark) }
    func ink(_ c: Color) -> Color { accented ? .primary : c }
}

// An elliptical radial glow: the colour at the centre fading to nothing at `fade` of the radius (section 3)
struct Glow: View {
    let cx: Double, cy: Double, rx: Double, ry: Double
    let color: Color, alpha: Double, fade: Double

    var body: some View {
        GeometryReader { g in
            let w = g.size.width * rx, h = g.size.height * ry
            Circle()
                .fill(RadialGradient(colors: [color.opacity(alpha), color.opacity(0)], center: .center, startRadius: 0, endRadius: w * fade))
                .frame(width: w * 2, height: w * 2)
                .scaleEffect(x: 1, y: h / w)
                .position(x: g.size.width * cx, y: g.size.height * cy)
        }
    }
}

struct Background: View {
    let look: Look
    let sky: String

    var body: some View {
        ZStack {
            LinearGradient(stops: look.theme.background(dark: look.dark), startPoint: .top, endPoint: .bottom)
            if !look.accented {
                switch look.theme {
                case .standard where look.dark:
                    switch sky {
                    case "dawn": Glow(cx: 0, cy: 0, rx: 0.9, ry: 0.7, color: Color(hex: "#ffd98a"), alpha: 0.09, fade: 0.7)
                    case "day": Glow(cx: 0.5, cy: 0, rx: 1.1, ry: 0.55, color: Color(hex: "#ffd98a"), alpha: 0.08, fade: 0.8)
                    case "dusk": Glow(cx: 1, cy: 0, rx: 0.9, ry: 0.7, color: Color(hex: "#ffc470"), alpha: 0.1, fade: 0.7)
                    default: EmptyView()
                    }
                case .winter:
                    ZStack(alignment: .topTrailing) {
                        Color.clear
                        Image("winter-specks").resizable().renderingMode(.template)
                            .frame(width: 110, height: 77)
                            .foregroundStyle(look.dark ? Color(hex: "#f6f8fc") : .white)
                            .opacity(look.dark ? 0.3 : 1)
                            .padding(.top, 6).padding(.trailing, 6)
                    }
                    VStack {
                        Spacer(minLength: 0)
                        Image("winter-snow").resizable().renderingMode(.template)
                            .frame(maxWidth: .infinity).frame(height: 16)
                            .foregroundStyle(look.dark ? Color(hex: "#e9eef5") : .white)
                            .opacity(look.dark ? 0.22 : 1)
                    }
                case .sky:
                    if look.dark { Glow(cx: 1, cy: 1.15, rx: 0.9, ry: 0.6, color: Color(hex: "#e8957a"), alpha: 0.3, fade: 0.7) }
                    ZStack(alignment: .topTrailing) {
                        Color.clear
                        // opacity on the view, never in the artwork: the cloud is overlapping circles
                        Image("sky-cloud").resizable().renderingMode(.template).foregroundStyle(.white)
                            .frame(width: 55.5, height: 45).opacity(look.dark ? 0.09 : 0.6)
                            .padding(.trailing, 4.75).offset(y: -8.75)
                        Image("sky-cloud").resizable().renderingMode(.template).foregroundStyle(.white)
                            .frame(width: 37, height: 30).opacity(look.dark ? 0.14 : 0.85)
                            .offset(x: 3.5, y: -4.5)
                    }
                default:
                    EmptyView()
                }
            }
        }
        .clipShape(ContainerRelativeShape())
    }
}

// The website's drawn icons for the payload's emoji (as app/components/Glyph.jsx); partly cloudy is two drawings
struct Glyph: View {
    let emoji: String
    let size: CGFloat
    let look: Look

    var body: some View {
        let p = look.p
        switch emoji.replacingOccurrences(of: "\u{FE0F}", with: "") {
        case "☀": Icon(name: "icon-sun", size: size, color: look.ink(p.sun))
        case "🌙": Icon(name: "icon-moon", size: size, color: look.ink(p.moon))
        case "☁": Icon(name: "icon-cloud", size: size, color: look.ink(p.cloud))
        case "⛅", "🌤", "🌥":
            ZStack {
                Icon(name: "icon-cloud-sun-rays", size: size, color: look.ink(p.sun))
                Icon(name: "icon-cloud-sun-cloud", size: size, color: look.ink(p.cloud))
            }
        case "🌦": Icon(name: "icon-cloud-drizzle", size: size, color: look.ink(p.rain))
        case "🌧": Icon(name: "icon-cloud-rain", size: size, color: look.ink(p.rain))
        case "🌨", "❄": Icon(name: "icon-cloud-snow", size: size, color: look.ink(p.rain))
        case "⛈", "🌩": Icon(name: "icon-cloud-lightning", size: size, color: look.ink(p.rain))
        case "🌫": Icon(name: "icon-cloud-fog", size: size, color: look.ink(p.cloud))
        default: EmptyView()
        }
    }
}

struct Icon: View {
    let name: String
    let size: CGFloat
    let color: Color

    var body: some View {
        Image(name).resizable().renderingMode(.template)
            .frame(width: size, height: size)
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }
}

private let pathAllowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")

func appLink(_ path: String) -> URL {
    let encoded = path.addingPercentEncoding(withAllowedCharacters: pathAllowed) ?? "%2F"
    return URL(string: "metablend://open?path=\(encoded)") ?? URL(string: "metablend://open?path=%2F")!
}

func isOld(_ fetched: Date, _ stale: Bool) -> Bool {
    stale && Date().timeIntervalSince(fetched) > 3 * 3600
}

func hilo(_ hi: String, _ lo: String) -> String { "↑ \(hi)  ↓ \(lo)" }

// the widget's look from the environment: built once per view
struct Themed<Content: View>: View {
    let theme: WidgetTheme
    @ViewBuilder let content: (Look) -> Content
    @Environment(\.colorScheme) private var scheme
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        content(Look(theme: theme, dark: scheme == .dark, accented: mode != .fullColor))
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

struct MessageView: View {
    let text: String
    let theme: WidgetTheme

    var body: some View {
        Themed(theme: theme) { look in
            Text(text)
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(look.ink(look.p.muted))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .containerBackground(for: .widget) { Background(look: look, sky: "") }
                .widgetURL(appLink("/"))
        }
    }
}

// MARK: - Weather widget

struct WeatherEntry: TimelineEntry {
    enum State {
        case data(WeatherPayload, hour: Int?, fetched: Date, stale: Bool)
        case message(String)
    }
    let date: Date
    let state: State
    let show: WidgetShow
    let theme: WidgetTheme
}

struct WeatherProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, state: .data(.sample, hour: nil, fetched: .now, stale: false), show: .hours, theme: WidgetTheme(WidgetSettings.load()?.theme))
    }

    func snapshot(for configuration: WeatherConfig, in context: Context) async -> WeatherEntry {
        if context.isPreview { return placeholder(in: context) }
        return await entries(for: configuration)[0]
    }

    func timeline(for configuration: WeatherConfig, in context: Context) async -> Timeline<WeatherEntry> {
        Timeline(entries: await entries(for: configuration), policy: .after(Date().addingTimeInterval(30 * 60)))
    }

    private func entries(for config: WeatherConfig) async -> [WeatherEntry] {
        let s = WidgetSettings.load()
        let theme = WidgetTheme(s?.theme)
        let entry = { (state: WeatherEntry.State, date: Date) in
            WeatherEntry(date: date, state: state, show: config.show, theme: theme)
        }
        guard let s else { return [entry(.message(Texts.t(nil, .openOnce)), .now)] }
        let chosen = config.city?.id ?? ""
        var city = chosen.isEmpty ? (s.home ?? "") : chosen
        if city.isEmpty { return [entry(.message(Texts.t(s.lang, .pickCity)), .now)] }
        let query = { (name: String) in ["city": name, "lang": s.lang, "unit": s.unit] }
        var (payload, status) = await Api.get(WeatherPayload.self, base: s.base, query: query(city))
        if payload == nil, status == 404, let home = s.home, !home.isEmpty, home != city {
            city = home
            (payload, status) = await Api.get(WeatherPayload.self, base: s.base, query: query(city))
        }
        let key = "weather|\(city)|\(s.lang)|\(s.unit)"
        if let payload {
            Cache.save(payload, key: key)
            return hourly(payload, fetched: .now, stale: false, entry)
        }
        if let cached = Cache.load(WeatherPayload.self, key: key) {
            return hourly(cached.0, fetched: cached.1, stale: true, entry)
        }
        return [entry(.message(Texts.t(s.lang, .offline)), .now)]
    }

    // one entry now, then one per coming hour: the widget moves on with the
    // forecast even when iOS postpones the next refresh
    private func hourly(_ p: WeatherPayload, fetched: Date, stale: Bool, _ entry: (WeatherEntry.State, Date) -> WeatherEntry) -> [WeatherEntry] {
        let now = Date()
        let passed = p.hours.lastIndex { Date(timeIntervalSince1970: $0.ts) <= now }
        var list = [entry(.data(p, hour: passed, fetched: fetched, stale: stale), now)]
        for (i, h) in p.hours.enumerated() where Date(timeIntervalSince1970: h.ts) > now {
            list.append(entry(.data(p, hour: i, fetched: fetched, stale: stale), Date(timeIntervalSince1970: h.ts)))
        }
        return list
    }
}

// The next hours (time, glyph, temperature, rain) or days (weekday, glyph, high, low). `fill`: the medium widget's
// cells take the full height and spread their four items from top to bottom.
struct Strip: View {
    let p: WeatherPayload
    let from: Int
    let show: WidgetShow
    let look: Look
    var count = 5
    var fill = false

    var body: some View {
        HStack(spacing: 0) {
            if show == .days {
                ForEach(Array(p.days.prefix(count).enumerated()), id: \.offset) { _, d in
                    cell(top: d.day, icon: d.icon, main: d.hi, sub: d.lo, subColor: look.p.muted)
                }
            } else {
                ForEach(Array(p.hours.dropFirst(max(from, 0)).prefix(count).enumerated()), id: \.offset) { _, h in
                    cell(top: h.t, icon: h.icon, main: h.temp, sub: h.rain, subColor: look.p.rain)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: fill ? CGFloat.infinity : nil)
    }

    @ViewBuilder
    private func cell(top: String, icon: String, main: String, sub: String, subColor: Color) -> some View {
        let items = VStack(spacing: fill ? 0 : 4) {
            Text(top).font(.footnote).foregroundStyle(look.ink(look.p.muted))
            if fill { Spacer(minLength: 2) }
            Glyph(emoji: icon, size: 20, look: look).frame(height: 20)
            if fill { Spacer(minLength: 2) }
            Text(main).font(.subheadline.weight(.medium)).foregroundStyle(look.ink(look.p.ink))
            if fill { Spacer(minLength: 2) }
            Text(sub).font(.footnote).foregroundStyle(look.ink(subColor))
        }
        .monospacedDigit()
        .lineLimit(1)
        if fill {
            items.frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            items.frame(maxWidth: .infinity)
        }
    }
}

struct RainWind: View {
    let rain: String
    let wind: String
    let look: Look

    var body: some View {
        HStack(spacing: 4) {
            Icon(name: "icon-droplet", size: 13, color: look.ink(look.p.rain))
            Text(rain)
            Icon(name: "icon-wind", size: 13, color: look.ink(look.p.muted)).padding(.leading, 6)
            Text(wind)
        }
        .font(.footnote)
        .monospacedDigit()
        .foregroundStyle(look.ink(look.p.muted))
        .lineLimit(1)
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text, theme: entry.theme)
        case .data(let p, let hour, let fetched, let stale):
            Themed(theme: entry.theme) { look in
                content(p, hour: hour, fetched: fetched, stale: stale, look: look)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .opacity(isOld(fetched, stale) ? 0.55 : 1)
                    .containerBackground(for: .widget) { Background(look: look, sky: hour.map { p.hours[$0].sky } ?? p.now.sky) }
                    .widgetURL(appLink(p.path))
            }
        }
    }

    @ViewBuilder
    private func content(_ p: WeatherPayload, hour: Int?, fetched: Date, stale: Bool, look: Look) -> some View {
        let h = hour.map { p.hours[$0] }
        let from = (hour ?? -1) + 1
        let ink = look.ink(look.p.ink), muted = look.ink(look.p.muted)
        let name = Text(p.city).font(.subheadline.weight(.semibold)).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.8)
        let temp = Text(h?.temp ?? p.now.temp)
            .font(.system(size: 44, weight: .light)).tracking(-0.88).monospacedDigit()
            .foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
        // once the timeline has moved past the first hour: that hour's rain instead of the condition now
        let condition = Group {
            if let h {
                HStack(spacing: 4) { Icon(name: "icon-droplet", size: 13, color: look.ink(look.p.rain)); Text(h.rain) }
            } else {
                Text(p.now.text)
            }
        }
        .font(.footnote).foregroundStyle(muted).lineLimit(1)
        let range = Text(hilo(p.today.hi, p.today.lo)).font(.footnote).monospacedDigit().foregroundStyle(muted)
        let time = Text(fetched, style: .time).font(.footnote).foregroundStyle(muted)
        let rainWind = h == nil ? p.now.rain.flatMap { r in p.now.wind.map { (r, $0) } } : nil

        switch family {
        case .systemLarge:
            // the header, then the next 6 hours and the next 5 days
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 0) {
                        name
                        HStack(spacing: 8) { temp; Glyph(emoji: h?.icon ?? p.now.icon, size: 30, look: look) }
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 4) {
                        condition
                        range
                        if let rainWind { RainWind(rain: rainWind.0, wind: rainWind.1, look: look) }
                        if stale { time }
                    }
                }
                Spacer(minLength: 8)
                Strip(p: p, from: from, show: .hours, look: look, count: 6)
                Spacer(minLength: 8)
                Strip(p: p, from: 0, show: .days, look: look)
            }
        case .systemMedium:
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    name
                    HStack(spacing: 8) { temp; Glyph(emoji: h?.icon ?? p.now.icon, size: 28, look: look) }
                    Spacer(minLength: 0)
                    condition
                    range
                    if stale { time } else if let rainWind { RainWind(rain: rainWind.0, wind: rainWind.1, look: look) }
                }
                .frame(width: 116, alignment: .leading)
                Strip(p: p, from: from, show: entry.show, look: look, fill: true)
            }
        default:
            VStack(alignment: .leading, spacing: 0) {
                name
                HStack(spacing: 8) { temp; Glyph(emoji: h?.icon ?? p.now.icon, size: 30, look: look) }
                Spacer(minLength: 0)
                condition
                range
                if stale { time }
            }
        }
    }
}

struct WeatherWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MetaBlendWeather", intent: WeatherConfig.self, provider: WeatherProvider()) { entry in
            WeatherWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather")
        .description("Now, the next hours or the next days for a city.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Hike widget

struct HikeEntry: TimelineEntry {
    enum State {
        case data(HikePayload, fetched: Date, stale: Bool)
        case message(String)
    }
    let date: Date
    let state: State
    let theme: WidgetTheme
}

struct HikeProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HikeEntry {
        HikeEntry(date: .now, state: .data(.sample, fetched: .now, stale: false), theme: WidgetTheme(WidgetSettings.load()?.theme))
    }

    func snapshot(for configuration: HikeConfig, in context: Context) async -> HikeEntry {
        if context.isPreview { return placeholder(in: context) }
        return await entry(for: configuration)
    }

    func timeline(for configuration: HikeConfig, in context: Context) async -> Timeline<HikeEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .after(Date().addingTimeInterval(30 * 60)))
    }

    private static func today() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private func entry(for config: HikeConfig) async -> HikeEntry {
        let s = WidgetSettings.load()
        let make = { (state: HikeEntry.State) in HikeEntry(date: .now, state: state, theme: WidgetTheme(s?.theme)) }
        guard let s else { return make(.message(Texts.t(nil, .openOnce))) }
        let today = Self.today()
        guard let plan = s.hikes.filter({ $0.date >= today }).min(by: { $0.date < $1.date }) else {
            return make(.message(Texts.t(s.lang, .planHike)))
        }
        let query = [
            "kind": "hike", "name": plan.name, "lat": String(plan.lat), "lon": String(plan.lon),
            "elev": String(Int(plan.elev.rounded())), "date": plan.date, "lang": s.lang, "unit": s.unit,
        ]
        let key = "hike|\(plan.name)|\(plan.date)|\(s.lang)|\(s.unit)"
        let (payload, _) = await Api.get(HikePayload.self, base: s.base, query: query)
        if let payload {
            Cache.save(payload, key: key)
            return make(.data(payload, fetched: .now, stale: false))
        }
        if let cached = Cache.load(HikePayload.self, key: key) {
            return make(.data(cached.0, fetched: cached.1, stale: true))
        }
        return make(.message(Texts.t(s.lang, .offline)))
    }
}

struct HikeWidgetView: View {
    let entry: HikeEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text, theme: entry.theme)
        case .data(let p, let fetched, let stale):
            Themed(theme: entry.theme) { look in
                let medium = family == .systemMedium
                HStack(alignment: .top, spacing: 16) {
                    left(p, fetched: fetched, stale: stale, look: look, windowSize: medium ? 24 : 22)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if medium { facts(p, look: look).frame(width: 144, alignment: .leading) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .opacity(isOld(fetched, stale) ? 0.55 : 1)
                .containerBackground(for: .widget) { Background(look: look, sky: p.sky) }
                .widgetURL(appLink(p.path))
            }
        }
    }

    // one column, everything from the top: name, day, the window block, glyph with high and low
    @ViewBuilder
    private func left(_ p: HikePayload, fetched: Date, stale: Bool, look: Look, windowSize: CGFloat) -> some View {
        let ink = look.ink(look.p.ink), muted = look.ink(look.p.muted)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Icon(name: "icon-mountain", size: 15, color: ink)
                Text(p.peak).font(.subheadline.weight(.semibold)).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(p.day).font(.footnote).foregroundStyle(muted).lineLimit(1)
            if let line = p.line {
                VStack(alignment: .leading, spacing: 0) {
                    if let label = p.label {
                        // a window: its words above it, so its colour is never the only sign
                        Text(label).font(.footnote).foregroundStyle(muted).lineLimit(1)
                        Text(line)
                            .font(.system(size: windowSize, weight: .semibold)).monospacedDigit()
                            .foregroundStyle(look.ink(p.good == true ? look.p.window : look.p.ink))
                            .lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
                    } else {
                        // "No favourable window", "No daylight left today"
                        Text(line).font(.subheadline.weight(.semibold)).foregroundStyle(ink).lineLimit(2)
                    }
                }
                .padding(.top, 10)
            }
            HStack(spacing: 6) {
                Glyph(emoji: p.icon, size: 20, look: look).frame(height: 20)
                Text(hilo(p.hi, p.lo)).font(.footnote).monospacedDigit().foregroundStyle(ink)
            }
            .padding(.top, p.line == nil ? 10 : 6)
            if stale { Text(fetched, style: .time).font(.footnote).foregroundStyle(muted) }
        }
    }

    // wind, rain and storm risk, from the top, the first row level with the peak name
    private func facts(_ p: HikePayload, look: Look) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            fact("icon-wind", look.p.muted, p.wind, look: look)
            fact("icon-droplet", look.p.rain, p.rain, look: look)
            if let storm = p.storm { fact("icon-zap", look.p.muted, storm, look: look, lines: 2) }
        }
    }

    private func fact(_ icon: String, _ color: Color, _ text: String, look: Look, lines: Int = 1) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Icon(name: icon, size: 15, color: look.ink(color)).padding(.top, 2) // centred on the text's first line
            Text(text).font(.footnote).monospacedDigit().foregroundStyle(look.ink(look.p.ink)).lineLimit(lines)
        }
    }
}

struct HikeWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MetaBlendHike", intent: HikeConfig.self, provider: HikeProvider()) { entry in
            HikeWidgetView(entry: entry)
        }
        .configurationDisplayName("Next hike")
        .description("The summit window of your next planned hike.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
