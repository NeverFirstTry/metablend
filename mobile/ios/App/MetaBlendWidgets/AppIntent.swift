import Foundation
import AppIntents
import WidgetKit

enum WidgetStyle: String, AppEnum {
    case sky, system
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Style" }
    static var caseDisplayRepresentations: [WidgetStyle: DisplayRepresentation] { [.sky: "Living sky", .system: "System"] }
}

enum WidgetShow: String, AppEnum {
    case hours, days
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Show" }
    static var caseDisplayRepresentations: [WidgetShow: DisplayRepresentation] { [.hours: "Next hours", .days: "Next days"] }
}

// "" is the home city; anything else a city name from the app's recent list.
struct CityEntity: AppEntity {
    let id: String
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "City" }
    static var defaultQuery: CityQuery { CityQuery() }
    var displayRepresentation: DisplayRepresentation {
        guard id.isEmpty else { return DisplayRepresentation(title: "\(id)") }
        let s = WidgetSettings.load()
        let home = Texts.t(nil, .home) // Edit Widget speaks the phone's language, like the rest of it
        let title = s?.home.map { "\(home) (\($0))" } ?? home
        return DisplayRepresentation(title: "\(title)")
    }
}

struct CityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CityEntity] {
        identifiers.map { CityEntity(id: $0) }
    }
    func suggestedEntities() async throws -> [CityEntity] {
        let s = WidgetSettings.load()
        let others = (s?.recent ?? []).filter { $0 != s?.home }
        return [CityEntity(id: "")] + others.map { CityEntity(id: $0) }
    }
    func defaultResult() async -> CityEntity? { CityEntity(id: "") }
}

struct WeatherConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Weather" }
    static var description: IntentDescription { IntentDescription("Now, the next hours or the next days for a city.") }
    @Parameter(title: "City") var city: CityEntity?
    @Parameter(title: "Show", default: .hours) var show: WidgetShow
    @Parameter(title: "Style", default: .sky) var style: WidgetStyle
}

struct HikeConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Next hike" }
    static var description: IntentDescription { IntentDescription("The summit window of your next planned hike.") }
    @Parameter(title: "Style", default: .sky) var style: WidgetStyle
}
