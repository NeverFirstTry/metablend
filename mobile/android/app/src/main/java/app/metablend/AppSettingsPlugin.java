package app.metablend;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// More → Notifications → "Open settings" (lib/app-settings.js): the app's own
// notification settings (Android 8+), else its app details screen. A link
// from the web view can't open system settings (a tester's report, Android 15).
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {
    @PluginMethod
    public void openNotifications(PluginCall call) {
        String pkg = getContext().getPackageName();
        Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", pkg, null));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && open(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg))) {
            call.resolve();
        } else if (open(details)) {
            call.resolve();
        } else {
            call.reject("No settings screen to open");
        }
    }

    // some phones' own system builds lack a settings screen, or refuse it
    private boolean open(Intent intent) {
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
