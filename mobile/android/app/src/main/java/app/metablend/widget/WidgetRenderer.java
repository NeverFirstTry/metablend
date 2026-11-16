package app.metablend.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import app.metablend.R;
import java.text.DateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// Payload → RemoteViews in the widget's theme (docs/widgets-spec.md). Small, medium (and for the weather, large)
// layouts: Android 12+ picks between them by size itself, older launchers by the reported width and height.
// Colours are resources with a dark variant: on Android 12+ they follow the phone's appearance without a new render,
// before that they are resolved now and catch up at the next update.
public final class WidgetRenderer {
    private WidgetRenderer() {}

    private static final long DIM_AFTER_MS = 3L * 60 * 60 * 1000;
    static final int DEFAULT = 0, MONO = 1, WINTER = 2, SKY = 3;

    public static final class Look {
        final int theme;
        final boolean stale;
        final long at;
        final String show;

        public Look(int theme, boolean stale, long at, String show) {
            this.theme = theme;
            this.stale = stale;
            this.at = at;
            this.show = show;
        }
    }

    // the theme the app syncs ('default', 'mono', 'winter', 'sky'); anything else is the default
    static int theme(JSONObject settings) {
        String t = settings == null ? "" : settings.optString("theme", "");
        for (int i = 0; i < WidgetText.THEMES.length; i++) if (WidgetText.THEMES[i].equals(t)) return i;
        return DEFAULT;
    }

    static final int SMALL = 0, MEDIUM = 1, LARGE = 2;

    interface Maker {
        RemoteViews make(int size);
    }

    static RemoteViews sized(Context c, int id, boolean large, Maker maker) {
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> map = new HashMap<>();
            map.put(new SizeF(100f, 100f), maker.make(SMALL));
            map.put(new SizeF(250f, 100f), maker.make(MEDIUM));
            if (large) map.put(new SizeF(250f, 230f), maker.make(LARGE));
            return new RemoteViews(map);
        }
        Bundle o = AppWidgetManager.getInstance(c).getAppWidgetOptions(id);
        int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110), h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
        return maker.make(w < 250 ? SMALL : large && h >= 230 ? LARGE : MEDIUM);
    }

    public static RemoteViews weather(Context c, int id, JSONObject p, Look look) {
        return sized(c, id, true, size -> weatherViews(c, id, p, look, size));
    }

    public static RemoteViews hike(Context c, int id, JSONObject p, Look look) {
        return sized(c, id, false, size -> hikeViews(c, id, p, look, size != SMALL));
    }

    public static RemoteViews message(Context c, int id, String text, int theme) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_message);
        scenery(v, theme, "");
        v.setTextViewText(R.id.message, text);
        color(c, v, theme, WidgetText.MUTED, R.id.message);
        v.setOnClickPendingIntent(android.R.id.background, open(c, id, "/"));
        return v;
    }

    private static RemoteViews weatherViews(Context c, int id, JSONObject p, Look look, int size) {
        int layout = size == LARGE ? R.layout.widget_weather_large : size == MEDIUM ? R.layout.widget_weather_medium : R.layout.widget_weather_small;
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        int t = look.theme;
        JSONObject now = obj(p, "now"), today = obj(p, "today");
        v.setTextViewText(R.id.city, p.optString("city"));
        v.setTextViewText(R.id.temp, now.optString("temp"));
        glyph(c, v, t, now.optString("icon"), R.id.glyph, R.id.glyph2);
        v.setTextViewText(R.id.text, now.optString("text"));
        v.setTextViewText(R.id.hilo, hilo(today));
        color(c, v, t, WidgetText.INK, R.id.city, R.id.temp);
        color(c, v, t, WidgetText.MUTED, R.id.text, R.id.hilo, R.id.updated);
        if (size == MEDIUM) {
            strip(c, v, R.id.strip, p, "days".equals(look.show), t, 5);
        } else if (size == LARGE) {
            strip(c, v, R.id.strip, p, false, t, 6);
            strip(c, v, R.id.strip_days, p, true, t, 5);
        }
        if (size != SMALL) {
            // rain and wind on their own (servers before 2026-11-16 send only the old combined line: then no row)
            String rain = now.optString("rain", ""), wind = now.optString("wind", "");
            boolean row = !rain.isEmpty() && !wind.isEmpty() && !(look.stale && size == MEDIUM); // the medium one shows the time there
            v.setViewVisibility(R.id.rainwind, row ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.rain, rain);
            v.setTextViewText(R.id.wind, wind);
            color(c, v, t, WidgetText.MUTED, R.id.rain, R.id.wind);
            tint(c, v, t, WidgetText.RAIN, R.id.rain_icon);
            tint(c, v, t, WidgetText.MUTED, R.id.wind_icon);
        }
        finish(c, v, id, p, look, now.optString("sky"));
        return v;
    }

    // a row of cells: the next hours (time, glyph, temperature, rain) or days (weekday, glyph, high, low)
    private static void strip(Context c, RemoteViews v, int stripId, JSONObject p, boolean days, int t, int max) {
        v.removeAllViews(stripId);
        JSONArray list = p.optJSONArray(days ? "days" : "hours");
        int n = list == null ? 0 : Math.min(list.length(), max);
        for (int i = 0; i < n; i++) {
            JSONObject it = list.optJSONObject(i);
            if (it == null) continue;
            RemoteViews cell = new RemoteViews(c.getPackageName(), R.layout.widget_cell);
            cell.setTextViewText(R.id.cell_top, it.optString(days ? "day" : "t"));
            glyph(c, cell, t, it.optString("icon"), R.id.cell_glyph, R.id.cell_glyph2);
            cell.setTextViewText(R.id.cell_main, it.optString(days ? "hi" : "temp"));
            cell.setTextViewText(R.id.cell_sub, it.optString(days ? "lo" : "rain"));
            color(c, cell, t, WidgetText.MUTED, R.id.cell_top);
            color(c, cell, t, WidgetText.INK, R.id.cell_main);
            color(c, cell, t, days ? WidgetText.MUTED : WidgetText.RAIN, R.id.cell_sub);
            v.addView(stripId, cell);
        }
    }

    private static RemoteViews hikeViews(Context c, int id, JSONObject p, Look look, boolean medium) {
        RemoteViews v = new RemoteViews(c.getPackageName(), medium ? R.layout.widget_hike_medium : R.layout.widget_hike_small);
        int t = look.theme;
        v.setTextViewText(R.id.peak, p.optString("peak"));
        v.setTextViewText(R.id.day, p.optString("day"));
        color(c, v, t, WidgetText.INK, R.id.peak, R.id.hilo);
        color(c, v, t, WidgetText.MUTED, R.id.day, R.id.label, R.id.updated);
        tint(c, v, t, WidgetText.INK, R.id.peak_icon);

        // the window block: a window with its label, a sentence alone, or nothing (the day is beyond tomorrow)
        boolean hasLine = !p.isNull("line") && !p.optString("line").isEmpty();
        boolean window = hasLine && !p.isNull("label") && !p.optString("label").isEmpty();
        v.setViewVisibility(R.id.label, window ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.line, hasLine ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.gap, hasLine ? View.GONE : View.VISIBLE);
        if (window) v.setTextViewText(R.id.label, p.optString("label"));
        if (hasLine) {
            v.setTextViewText(R.id.line, p.optString("line"));
            v.setTextViewTextSize(R.id.line, TypedValue.COMPLEX_UNIT_SP, window ? (medium ? 24 : 22) : 15);
            v.setInt(R.id.line, "setMaxLines", window ? 1 : 2);
            boolean good = window && !p.isNull("good") && p.optBoolean("good");
            color(c, v, t, good ? WidgetText.WINDOW : WidgetText.INK, R.id.line);
        }
        glyph(c, v, t, p.optString("icon"), R.id.glyph, R.id.glyph2);
        v.setTextViewText(R.id.hilo, hilo(p));
        if (medium) {
            v.setTextViewText(R.id.wind, p.optString("wind"));
            v.setTextViewText(R.id.rain, p.optString("rain"));
            boolean storm = !p.isNull("storm") && !p.optString("storm").isEmpty();
            v.setViewVisibility(R.id.storm_row, storm ? View.VISIBLE : View.GONE);
            if (storm) v.setTextViewText(R.id.storm, p.optString("storm"));
            color(c, v, t, WidgetText.INK, R.id.wind, R.id.rain, R.id.storm);
            tint(c, v, t, WidgetText.MUTED, R.id.wind_icon);
            tint(c, v, t, WidgetText.RAIN, R.id.rain_icon);
            tint(c, v, t, WidgetText.MUTED, R.id.storm_icon);
        }
        finish(c, v, id, p, look, p.optString("sky"));
        return v;
    }

    // the theme's background and scenery, the time of old data, the dimming, and the tap
    private static void finish(Context c, RemoteViews v, int id, JSONObject p, Look look, String sky) {
        scenery(v, look.theme, sky);
        if (look.stale && look.at > 0) {
            v.setTextViewText(R.id.updated, DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(look.at)));
            v.setViewVisibility(R.id.updated, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.updated, View.GONE);
        }
        boolean old = look.stale && System.currentTimeMillis() - look.at > DIM_AFTER_MS;
        v.setFloat(R.id.content, "setAlpha", old ? 0.55f : 1f);
        v.setOnClickPendingIntent(android.R.id.background, open(c, id, p.optString("path", "/")));
    }

    // section 3: Default has the sun's sheen (its drawables are empty in light mode), Sky the peach edge and two
    // clouds, Winter the specks and the snow band, Mono nothing
    private static void scenery(RemoteViews v, int theme, String sky) {
        v.setInt(android.R.id.background, "setBackgroundResource", WidgetText.BACKGROUNDS[theme]);
        int sheen = theme != DEFAULT ? 0 : "dawn".equals(sky) ? R.drawable.w_sheen_dawn : "day".equals(sky) ? R.drawable.w_sheen_day : "dusk".equals(sky) ? R.drawable.w_sheen_dusk : 0;
        if (sheen != 0) v.setImageViewResource(R.id.sheen, sheen);
        show(v, sheen != 0, R.id.sheen);
        show(v, theme == SKY, R.id.peach, R.id.cloud_large, R.id.cloud_small);
        show(v, theme == WINTER, R.id.specks, R.id.snow);
    }

    // section 5: the website's drawn icons for the payload's emoji (as app/components/Glyph.jsx); partly cloudy is
    // two drawings, the sun's rays and the cloud, each in its own colour
    static void glyph(Context c, RemoteViews v, int t, String emoji, int a, int b) {
        int[] g = glyphFor(emoji == null ? "" : emoji.replace("️", ""));
        show(v, g != null, a);
        show(v, g != null && g.length == 4, b);
        if (g == null) return;
        v.setImageViewResource(a, g[0]);
        tint(c, v, t, g[1], a);
        if (g.length == 4) {
            v.setImageViewResource(b, g[2]);
            tint(c, v, t, g[3], b);
        }
    }

    static int[] glyphFor(String e) {
        switch (e) {
            case "☀": return new int[] { R.drawable.w_ic_sun, WidgetText.SUN };
            case "🌙": return new int[] { R.drawable.w_ic_moon, WidgetText.MOON };
            case "☁": return new int[] { R.drawable.w_ic_cloud, WidgetText.CLOUD };
            case "⛅": case "🌤": case "🌥": return new int[] { R.drawable.w_ic_cloud_sun_rays, WidgetText.SUN, R.drawable.w_ic_cloud_sun_cloud, WidgetText.CLOUD };
            case "🌦": return new int[] { R.drawable.w_ic_cloud_drizzle, WidgetText.RAIN };
            case "🌧": return new int[] { R.drawable.w_ic_cloud_rain, WidgetText.RAIN };
            case "🌨": case "❄": return new int[] { R.drawable.w_ic_cloud_snow, WidgetText.RAIN };
            case "⛈": case "🌩": return new int[] { R.drawable.w_ic_cloud_lightning, WidgetText.RAIN };
            case "🌫": return new int[] { R.drawable.w_ic_cloud_fog, WidgetText.CLOUD };
            default: return null;
        }
    }

    private static String hilo(JSONObject o) {
        return "↑ " + o.optString("hi") + "  ↓ " + o.optString("lo");
    }

    static PendingIntent open(Context c, int id, String path) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("metablend://open?path=" + Uri.encode(path)));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void color(Context c, RemoteViews v, int theme, int role, int... ids) {
        int res = WidgetText.COLORS[theme][role];
        for (int id : ids) {
            if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(id, "setTextColor", res);
            else v.setTextColor(id, c.getColor(res));
        }
    }

    private static void tint(Context c, RemoteViews v, int theme, int role, int id) {
        int res = WidgetText.COLORS[theme][role];
        if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(id, "setImageTintList", res);
        else v.setInt(id, "setColorFilter", c.getColor(res));
    }

    private static void show(RemoteViews v, boolean on, int... ids) {
        for (int id : ids) v.setViewVisibility(id, on ? View.VISIBLE : View.GONE);
    }

    private static JSONObject obj(JSONObject p, String key) {
        JSONObject o = p.optJSONObject(key);
        return o != null ? o : new JSONObject();
    }
}
