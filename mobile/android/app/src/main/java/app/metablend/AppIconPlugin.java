package app.metablend;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// More → App icon. Each icon is a launcher activity-alias of MainActivity
// (AndroidManifest.xml); exactly one is enabled. Sky is the default.
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String[] NAMES = { "sky", "light", "dark" };
    private static final String[] ALIASES = { ".LauncherSky", ".LauncherLight", ".LauncherDark" };

    private ComponentName component(int i) {
        return new ComponentName(getContext().getPackageName(), getContext().getPackageName() + ALIASES[i]);
    }

    private boolean enabled(PackageManager pm, int i) {
        int state = pm.getComponentEnabledSetting(component(i));
        if (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) return i == 0; // the manifest enables only Sky
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    @PluginMethod
    public void get(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String name = NAMES[0];
        for (int i = 0; i < NAMES.length; i++) if (enabled(pm, i)) { name = NAMES[i]; break; }
        JSObject r = new JSObject();
        r.put("name", name);
        r.put("platform", "android");
        call.resolve(r);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("name", "sky");
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
