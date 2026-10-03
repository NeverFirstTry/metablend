package app.metablend;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The phone's font-size setting for the web view's Larger Text (lib/text-scale.js).
@CapacitorPlugin(name = "TextScale")
public class TextScalePlugin extends Plugin {
    private float last = -1f;

    private float scale() { return getContext().getResources().getConfiguration().fontScale; }

    @PluginMethod
    public void get(PluginCall call) {
        last = scale();
        JSObject r = new JSObject();
        r.put("scale", last);
        call.resolve(r);
    }

    // the setting can change while the app is in the background
    @Override
    protected void handleOnResume() {
        float s = scale();
        if (last >= 0 && s != last) {
            JSObject r = new JSObject();
            r.put("scale", s);
            notifyListeners("change", r);
        }
        last = s;
    }
}
