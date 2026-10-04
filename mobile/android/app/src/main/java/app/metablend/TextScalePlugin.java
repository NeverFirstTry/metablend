package app.metablend;

import android.content.res.Configuration;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The phone's font-size setting for the web view's Larger Text (lib/text-scale.js).
// MainActivity handles fontScale changes itself (AndroidManifest configChanges),
// so the page stays and hears a "change" event instead of reloading.
@CapacitorPlugin(name = "TextScale")
public class TextScalePlugin extends Plugin {
    private float last = -1f;

    private float scale() { return getContext().getResources().getConfiguration().fontScale; }

    private void report(float s) {
        if (last >= 0 && s != last) {
            JSObject r = new JSObject();
            r.put("scale", s);
            notifyListeners("change", r);
        }
        last = s;
    }

    @PluginMethod
    public void get(PluginCall call) {
        last = scale();
        JSObject r = new JSObject();
        r.put("scale", last);
        call.resolve(r);
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        report(newConfig.fontScale);
    }

    // a backstop for a change delivered while the app was in the background
    @Override
    protected void handleOnResume() {
        report(scale());
    }
}
