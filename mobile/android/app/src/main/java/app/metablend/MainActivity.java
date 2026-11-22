package app.metablend;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class); // before super: the bridge is built there
        registerPlugin(AppIconPlugin.class);
        registerPlugin(TextScalePlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        // Edge to edge on every Android version (15+ forces it, 14 and older did not):
        // transparent bars over the app background, no 3-button scrim; the icons'
        // light or dark follows the app theme through SystemBars.setStyle (lib/native.js).
        // After super: BridgeActivity sets the no-action-bar theme there, and touching
        // the window earlier builds it with the splash theme and its action bar.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        // Larger Text comes from TextScalePlugin (root font size), so the web
        // view must not scale text by the system setting a second time.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
