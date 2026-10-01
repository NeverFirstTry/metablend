package app.metablend;

import app.metablend.widget.WidgetStore;
import app.metablend.widget.WidgetUpdater;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The website (in the WebView) hands the home-screen widgets their settings —
// language, unit, home city, recent cities, planned hikes — as one JSON string.
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void sync(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json missing");
            return;
        }
        WidgetStore.saveSettings(getContext(), json);
        WidgetUpdater.refreshAll(getContext());
        call.resolve();
    }
}
