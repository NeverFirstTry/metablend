import UIKit
import Capacitor
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // Push: hand the APNs device token (or the failure) to @capacitor/push-notifications
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}

// The website hands the home-screen widgets their settings (language, unit,
// home city, recent cities, planned hikes) through the App Group.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)]

    @objc func sync(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { return call.reject("json missing") }
        UserDefaults(suiteName: "group.app.metablend")?.set(json, forKey: "widget_settings")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

// The app's web view controller with the in-app plugins registered.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(TextScalePlugin())
    }
}

// Larger Text: the phone's text size as a factor of the default (body 17 pt),
// and a "change" event when it changes — the web view scales its root font
// size with it (lib/text-scale.js).
@objc(TextScalePlugin)
public class TextScalePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TextScalePlugin"
    public let jsName = "TextScale"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)]
    private var observer: NSObjectProtocol?

    private func scale() -> Double { Double(UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0) }

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.notifyListeners("change", data: ["scale": self.scale()])
        }
    }

    deinit { if let observer = observer { NotificationCenter.default.removeObserver(observer) } }

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["scale": self.scale()]) }
    }
}

// More → App icon: "auto" is the primary icon (follows light / dark /
// tinted); the others are the alternate icon sets in Assets.xcassets.
@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
    ]
    private let sets = ["light": "AppIcon-Light", "dark": "AppIcon-Dark", "sky": "AppIcon-Sky"]

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let current = UIApplication.shared.alternateIconName
            let name = self.sets.first(where: { $0.value == current })?.key ?? "auto"
            call.resolve(["name": name, "platform": "ios"])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "auto"
        let iconSet = name == "auto" ? nil : sets[name]
        if name != "auto" && iconSet == nil { return call.reject("unknown icon: " + name) }
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else { return call.reject("alternate icons not supported") }
            UIApplication.shared.setAlternateIconName(iconSet) { error in
                if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
            }
        }
    }
}
