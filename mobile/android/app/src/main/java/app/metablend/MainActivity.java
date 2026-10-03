package app.metablend;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class); // before super: the bridge is built there
        registerPlugin(AppIconPlugin.class);
        registerPlugin(TextScalePlugin.class);
        super.onCreate(savedInstanceState);
        // Larger Text comes from TextScalePlugin (root font size), so the web
        // view must not scale text by the system setting a second time.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
