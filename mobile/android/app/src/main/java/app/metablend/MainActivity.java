package app.metablend;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class); // before super: the bridge is built there
        registerPlugin(AppIconPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
