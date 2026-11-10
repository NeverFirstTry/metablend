package app.metablend;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;

// More → App icon. Each icon is a launcher activity-alias of MainActivity
// (AndroidManifest.xml, ".Launcher" + the name with a capital); exactly one is
// enabled. Slate is the default (the first name).
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String[] NAMES = { "slate", "glow", "gold", "light", "butter", "summit", "weather", "dots", "mono", "winter", "sky" };

    private ComponentName component(int i) {
        String name = NAMES[i];
        return new ComponentName(getContext().getPackageName(), getContext().getPackageName() + ".Launcher" + Character.toUpperCase(name.charAt(0)) + name.substring(1));
    }

    private boolean enabled(PackageManager pm, int i) {
        int state = pm.getComponentEnabledSetting(component(i));
        if (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) return i == 0; // the manifest enables only Slate
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    // After an update that changes the default, an icon picked by hand before (switched on by hand) and the new
    // default (switched on by the manifest) would both be on the home screen: the one picked by hand stays.
    @Override
    public void load() {
        PackageManager pm = getContext().getPackageManager();
        if (pm.getComponentEnabledSetting(component(0)) != PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) return;
        for (int i = 1; i < NAMES.length; i++) {
            if (pm.getComponentEnabledSetting(component(i)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                pm.setComponentEnabledSetting(component(0), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                return;
            }
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String name = NAMES[0];
        for (int i = 0; i < NAMES.length; i++) if (enabled(pm, i)) { name = NAMES[i]; break; }
        JSObject r = new JSObject();
        r.put("name", name);
        r.put("platform", "android");
        // the icons this build has: the website shows the picker only for these (lib/app-icon-choices.js)
        r.put("icons", new JSArray(Arrays.asList(NAMES)));
        call.resolve(r);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("name", NAMES[0]);
        int chosen = -1;
        for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(name)) chosen = i;
        if (chosen < 0) {
            call.reject("unknown icon: " + name);
            return;
        }
        PackageManager pm = getContext().getPackageManager();
        // switch the new one on before the old one off, so there is always a launcher entry
        pm.setComponentEnabledSetting(component(chosen), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (int i = 0; i < NAMES.length; i++) {
            if (i != chosen) pm.setComponentEnabledSetting(component(i), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
        call.resolve();
    }
}
