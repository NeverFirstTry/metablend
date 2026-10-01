import Foundation
import WidgetKit
import SwiftUI

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

    static func load() -> WidgetSettings? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget_settings"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSettings.self, from: data)
    }
}

// MARK: - Texts in the app's five languages

enum Texts {
    enum Key: Int { case home, openOnce, pickCity, planHike, offline }
    private static let table: [String: [String]] = [
        "en": ["Home city", "Open MetaBlend once to pick a city", "Pick a city in MetaBlend", "Plan a hike in the app", "No connection — tap to open MetaBlend"],
        "de": ["Heimatstadt", "Öffne MetaBlend einmal, um einen Ort zu wählen", "Wähle einen Ort in MetaBlend", "Plane eine Tour in der App", "Keine Verbindung – tippen, um MetaBlend zu öffnen"],
        "fr": ["Ville principale", "Ouvrez MetaBlend une fois pour choisir une ville", "Choisissez une ville dans MetaBlend", "Planifiez une randonnée dans l’app", "Pas de connexion — touchez pour ouvrir MetaBlend"],
        "es": ["Ciudad principal", "Abre MetaBlend una vez para elegir una ciudad", "Elige una ciudad en MetaBlend", "Planifica una excursión en la app", "Sin conexión: toca para abrir MetaBlend"],
        "it": ["Città principale", "Apri MetaBlend una volta per scegliere una città", "Scegli una città in MetaBlend", "Pianifica un’escursione nell’app", "Nessuna connessione: tocca per aprire MetaBlend"],
    ]
    static func t(_ lang: String?, _ key: Key) -> String {
        let phone = Locale.current.language.languageCode?.identifier ?? "en"
        let row = table[lang ?? phone] ?? table["en"]!
        return row[key.rawValue]
    }
}

// MARK: - Payloads from /api/app-widget (display-ready text)

struct WeatherPayload: Codable {
    struct Now: Codable { let temp: String; let icon: String; let text: String; let sky: String; let detail: String? }
    struct Today: Codable { let hi: String; let lo: String }
    struct Hour: Codable { let t: String; let ts: Double; let icon: String; let temp: String; let rain: String; let sky: String }
    struct Day: Codable { let day: String; let icon: String; let hi: String; let lo: String }
    let city: String
    let path: String
    let now: Now
    let today: Today
    let hours: [Hour]
    let days: [Day]
    let skies: [String: [String]]
}

struct HikePayload: Codable {
    let peak: String
    let day: String
    let path: String
    let line: String?
    let good: Bool?
    let icon: String
    let hi: String
    let lo: String
    let wind: String
    let rain: String
    let storm: String?
    let sky: String
    let skies: [String: [String]]
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

struct Ink {
    let main: Color
    let dim: Color
}

// white on the sky; the system's colours on a plain or tinted home screen
func palette(sky: Bool, mode: WidgetRenderingMode) -> Ink {
    sky && mode == .fullColor ? Ink(main: .white, dim: .white.opacity(0.85)) : Ink(main: .primary, dim: .secondary)
}

struct SkyBackground: View {
    let colors: [String]?
    let sky: Bool
    var body: some View {
        if sky, let colors, colors.count >= 2 {
            LinearGradient(colors: colors.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom)
        } else {
            Color(.systemBackground)
        }
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

struct MessageView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.footnote)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .containerBackground(for: .widget) { Color(.systemBackground) }
            .widgetURL(appLink("/"))
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
    let style: WidgetStyle
}

struct WeatherProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, state: .message("MetaBlend"), show: .hours, style: .sky)
    }

    func snapshot(for configuration: WeatherConfig, in context: Context) async -> WeatherEntry {
        await entries(for: configuration)[0]
    }

    func timeline(for configuration: WeatherConfig, in context: Context) async -> Timeline<WeatherEntry> {
        Timeline(entries: await entries(for: configuration), policy: .after(Date().addingTimeInterval(30 * 60)))
    }

    private func entries(for config: WeatherConfig) async -> [WeatherEntry] {
        let entry = { (state: WeatherEntry.State, date: Date) in
            WeatherEntry(date: date, state: state, show: config.show, style: config.style)
        }
        guard let s = WidgetSettings.load() else { return [entry(.message(Texts.t(nil, .openOnce)), .now)] }
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

struct Strip: View {
    let p: WeatherPayload
    let from: Int
    let show: WidgetShow
    let ink: Ink
    var count = 5

    var body: some View {
        HStack(spacing: 0) {
            if show == .days {
                ForEach(Array(p.days.prefix(count).enumerated()), id: \.offset) { _, d in
                    cell(top: d.day, icon: d.icon, main: d.hi, sub: d.lo)
                }
            } else {
                ForEach(Array(p.hours.dropFirst(max(from, 0)).prefix(count).enumerated()), id: \.offset) { _, h in
                    cell(top: h.t, icon: h.icon, main: h.temp, sub: h.rain)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func cell(top: String, icon: String, main: String, sub: String) -> some View {
        VStack(spacing: 4) {
            Text(top).font(.system(size: 10)).foregroundStyle(ink.dim)
            Text(icon).font(.system(size: 18))
            Text(main).font(.caption.weight(.medium)).foregroundStyle(ink.main)
            Text(sub).font(.system(size: 10)).foregroundStyle(ink.dim)
        }
        .frame(maxWidth: .infinity)
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text)
        case .data(let p, let hour, let fetched, let stale):
            let h = hour.map { p.hours[$0] }
            let onSky = entry.style == .sky
            let ink = palette(sky: onSky, mode: mode)
            let from = (hour ?? -1) + 1
            let line = h.map { "💧 \($0.rain)" } ?? p.now.text
            Group {
                if family == .systemLarge {
                    // large: the header, then the next hours and the next days
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.city).font(.subheadline.bold()).foregroundStyle(ink.main).lineLimit(1)
                                HStack(spacing: 6) {
                                    Text(h?.temp ?? p.now.temp).font(.system(size: 48, weight: .light)).foregroundStyle(ink.main)
                                    Text(h?.icon ?? p.now.icon).font(.largeTitle)
                                }
                            }
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(line).lineLimit(1)
                                Text("↑ \(p.today.hi)  ↓ \(p.today.lo)")
                                if h == nil, let detail = p.now.detail { Text(detail) }
                                if stale { Text(fetched, style: .time) }
                            }
                            .font(.footnote)
                            .foregroundStyle(ink.dim)
                        }
                        Spacer(minLength: 8)
                        Strip(p: p, from: from, show: .hours, ink: ink, count: 6)
                        Spacer(minLength: 8)
                        Strip(p: p, from: 0, show: .days, ink: ink)
                    }
                } else {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.city).font(.caption.bold()).foregroundStyle(ink.main).lineLimit(1)
                            HStack(spacing: 4) {
                                Text(h?.temp ?? p.now.temp).font(.system(size: 34, weight: .light)).foregroundStyle(ink.main)
                                Text(h?.icon ?? p.now.icon).font(.title2)
                            }
                            Spacer(minLength: 0)
                            Text(line).font(.caption2).foregroundStyle(ink.dim).lineLimit(1)
                            Text("↑ \(p.today.hi)  ↓ \(p.today.lo)").font(.caption2).foregroundStyle(ink.dim)
                            if family == .systemMedium, h == nil, let detail = p.now.detail {
                                Text(detail).font(.caption2).foregroundStyle(ink.dim).lineLimit(1)
                            }
                            if stale { Text(fetched, style: .time).font(.system(size: 10)).foregroundStyle(ink.dim) }
                        }
                        if family == .systemMedium {
                            Strip(p: p, from: from, show: entry.show, ink: ink)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(isOld(fetched, stale) ? 0.55 : 1)
            .containerBackground(for: .widget) { SkyBackground(colors: p.skies[h?.sky ?? p.now.sky], sky: onSky) }
            .widgetURL(appLink(p.path))
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
    let style: WidgetStyle
}

struct HikeProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HikeEntry {
        HikeEntry(date: .now, state: .message("MetaBlend"), style: .sky)
    }

    func snapshot(for configuration: HikeConfig, in context: Context) async -> HikeEntry {
        await entry(for: configuration)
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
        let make = { (state: HikeEntry.State) in HikeEntry(date: .now, state: state, style: config.style) }
        guard let s = WidgetSettings.load() else { return make(.message(Texts.t(nil, .openOnce))) }
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
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text)
        case .data(let p, let fetched, let stale):
            let onSky = entry.style == .sky
            let ink = palette(sky: onSky, mode: mode)
            let good: Color = onSky && mode == .fullColor ? Color(hex: "#A7F3D0") : .green
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("⛰ \(p.peak)").font(.caption.bold()).foregroundStyle(ink.main).lineLimit(1)
                    Text(p.day).font(.caption2).foregroundStyle(ink.dim)
                    Spacer(minLength: 0)
                    HStack(spacing: 6) {
                        Text(p.icon).font(.title3)
                        Text("↑ \(p.hi)  ↓ \(p.lo)").font(.caption2).foregroundStyle(ink.dim)
                    }
                    Text(p.line ?? "💨 \(p.wind)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(p.good == true ? good : ink.main)
                        .lineLimit(2)
                    if stale { Text(fetched, style: .time).font(.system(size: 10)).foregroundStyle(ink.dim) }
                }
                if family == .systemMedium {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("💨 \(p.wind)")
                        Text("💧 \(p.rain)")
                        if let storm = p.storm { Text("⚡ \(storm)").lineLimit(2) }
                    }
                    .font(.caption)
                    .foregroundStyle(ink.main)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(isOld(fetched, stale) ? 0.55 : 1)
            .containerBackground(for: .widget) { SkyBackground(colors: p.skies[p.sky], sky: onSky) }
            .widgetURL(appLink(p.path))
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
