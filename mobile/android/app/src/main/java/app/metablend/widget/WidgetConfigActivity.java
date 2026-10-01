package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

// A widget's settings: on adding (Android 11 and older) and via long-press →
// reconfigure. City and Show only for the weather widget, Style for both.
public class WidgetConfigActivity extends AppCompatActivity {
    private int id = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) id = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
        final boolean hike = info != null && HikeWidgetProvider.class.getName().equals(info.provider.getClassName());
        JSONObject s = WidgetStore.settings(this);
        WidgetText tx = new WidgetText(s == null ? Locale.getDefault().getLanguage() : s.optString("lang", "en"));
        setTitle(tx.get("settings"));

        int pad = dp(20);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(pad, dp(4), pad, pad);

        RadioGroup cities = null, show = null;
        if (!hike) {
            String home = s == null || s.isNull("home") ? "" : s.optString("home", "");
            String chosen = WidgetStore.get(this, id, "city", "");
            List<String> names = new ArrayList<>();
            names.add("");
            JSONArray recent = s == null ? null : s.optJSONArray("recent");
            for (int i = 0; recent != null && i < recent.length(); i++) {
                String n = recent.optString(i);
                if (!n.isEmpty() && !n.equals(home) && !names.contains(n)) names.add(n);
            }
            if (!chosen.isEmpty() && !names.contains(chosen)) names.add(chosen); // keeps working when it left the list
            cities = group(col, tx.get("city"));
            for (String n : names) {
                String label = n.isEmpty() ? tx.get("home") + (home.isEmpty() ? "" : " (" + home + ")") : n;
                option(cities, n, label, n.equals(chosen));
            }
            String sh = WidgetStore.get(this, id, "show", "hours");
            show = group(col, tx.get("show"));
            option(show, "hours", tx.get("hours"), !"days".equals(sh));
            option(show, "days", tx.get("days"), "days".equals(sh));
        }
        String st = WidgetStore.get(this, id, "style", "sky");
        RadioGroup style = group(col, tx.get("style"));
        option(style, "sky", tx.get("sky"), !"system".equals(st));
        option(style, "system", tx.get("system"), "system".equals(st));

        Button save = new Button(this);
        save.setText(tx.get("save"));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(16);
        col.addView(save, lp);
        final RadioGroup fCities = cities, fShow = show;
        save.setOnClickListener(v -> {
            if (fCities != null) WidgetStore.put(this, id, "city", picked(fCities));
            if (fShow != null) WidgetStore.put(this, id, "show", picked(fShow));
            WidgetStore.put(this, id, "style", picked(style));
            WidgetStore.dropCache(this, id); // don't flash the previous city
            WidgetUpdater.update(this, new int[] { id }, hike ? WidgetUpdater.HIKE : WidgetUpdater.WEATHER, null);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
            finish();
        });

        ScrollView scroll = new ScrollView(this);
        scroll.addView(col);
        setContentView(scroll);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private RadioGroup group(LinearLayout col, String title) {
        TextView label = new TextView(this);
        label.setText(title);
        label.setTextSize(13);
        label.setPadding(0, dp(14), 0, dp(2));
        col.addView(label);
        RadioGroup g = new RadioGroup(this);
        col.addView(g);
        return g;
    }

    private void option(RadioGroup g, String value, String text, boolean checked) {
        RadioButton b = new RadioButton(this);
        b.setId(View.generateViewId());
        b.setText(text);
        b.setTag(value);
        g.addView(b);
        if (checked) g.check(b.getId());
    }

    private static String picked(RadioGroup g) {
        View b = g.findViewById(g.getCheckedRadioButtonId());
        return b == null ? "" : String.valueOf(b.getTag());
    }
}
