import WidgetKit
import SwiftUI

@main
struct MetaBlendWidgetsBundle: WidgetBundle {
    var body: some Widget {
        WeatherWidget()
        HikeWidget()
    }
}
