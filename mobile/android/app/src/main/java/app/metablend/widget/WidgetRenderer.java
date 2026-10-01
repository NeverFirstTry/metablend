package app.metablend.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import app.metablend.R;
import java.text.DateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// Payload → RemoteViews. Small, medium (and for the weather, large) layouts:
// Android 12+ picks between them by size itself, older launchers by the
// reported width and height.
public final class WidgetRenderer {
    private WidgetRenderer() {}

    private static final int WHITE = 0xFFFFFFFF, WHITE_DIM = 0xD9FFFFFF, GOOD_ON_SKY = 0xFFA7F3D0, GOOD = 0xFF059669;
    private static final long DIM_AFTER_MS = 3L * 60 * 60 * 1000;

    public static final class Look {
        final boolean sky, stale;
        final long at;
        final String show;

        public Look(boolean sky, boolean stale, long at, String show) {
            this.sky = sky;
            this.stale = stale;
            this.at = at;
            this.show = show;
        }
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

    public static RemoteViews message(Context c, int id, String text) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_message);
        v.setTextViewText(R.id.message, text);
        v.setOnClickPendingIntent(android.R.id.background, open(c, id, "/"));
        return v;
    }

    private static RemoteViews weatherViews(Context c, int id, JSONObject p, Look look, int size) {
        int layout = size == LARGE ? R.layout.widget_weather_large : size == MEDIUM ? R.layout.widget_weather_medium : R.layout.widget_weather_small;
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        JSONObject now = obj(p, "now"), today = obj(p, "today");
        v.setTextViewText(R.id.city, p.optString("city"));
        v.setTextViewText(R.id.temp, now.optString("temp"));
        v.setTextViewText(R.id.icon, now.optString("icon"));
        v.setTextViewText(R.id.text, now.optString("text"));
        v.setTextViewText(R.id.hilo, "↑ " + today.optString("hi") + "   ↓ " + today.optString("lo"));
        if (size == MEDIUM) {
            strip(c, v, R.id.strip, p, "days".equals(look.show), look);
        } else if (size == LARGE) {
            strip(c, v, R.id.strip, p, false, look);
            strip(c, v, R.id.strip_days, p, true, look);
        }
        if (size != SMALL) v.setTextViewText(R.id.detail, now.optString("detail"));
        int[] dim = size == SMALL ? new int[] { R.id.text, R.id.hilo, R.id.updated } : new int[] { R.id.text, R.id.hilo, R.id.detail, R.id.updated };
        finish(c, v, id, p, look, now.optString("sky"), new int[] { R.id.city, R.id.temp }, dim);
        return v;
    }

    // a row of cells: the next hours (time, icon, temperature, rain) or days (weekday, icon, high, low)
    private static void strip(Context c, RemoteViews v, int stripId, JSONObject p, boolean days, Look look) {
        v.removeAllViews(stripId);
        JSONArray list = p.optJSONArray(days ? "days" : "hours");
        int n = list == null ? 0 : Math.min(list.length(), days ? 5 : 6);
        for (int i = 0; i < n; i++) {
            JSONObject it = list.optJSONObject(i);
            if (it == null) continue;
            RemoteViews cell = new RemoteViews(c.getPackageName(), R.layout.widget_cell);
            cell.setTextViewText(R.id.cell_top, it.optString(days ? "day" : "t"));
            cell.setTextViewText(R.id.cell_icon, it.optString("icon"));
            cell.setTextViewText(R.id.cell_main, it.optString(days ? "hi" : "temp"));
            cell.setTextViewText(R.id.cell_sub, it.optString(days ? "lo" : "rain"));
            if (look.sky) {
                tint(cell, WHITE, R.id.cell_main);
                tint(cell, WHITE_DIM, R.id.cell_top, R.id.cell_sub);
            }
            v.addView(stripId, cell);
        }
    }

    private static RemoteViews hikeViews(Context c, int id, JSONObject p, Look look, boolean medium) {
        RemoteViews v = new RemoteViews(c.getPackageName(), medium ? R.layout.widget_hike_medium : R.layout.widget_hike_small);
        v.setTextViewText(R.id.peak, "⛰ " + p.optString("peak"));
        v.setTextViewText(R.id.day, p.optString("day"));
        v.setTextViewText(R.id.line, p.isNull("line") ? "💨 " + p.optString("wind") : p.optString("line"));
        v.setTextViewText(R.id.icon, p.optString("icon"));
        v.setTextViewText(R.id.hilo, "↑ " + p.optString("hi") + "   ↓ " + p.optString("lo"));
        int[] dim;
        if (medium) {
            v.setTextViewText(R.id.wind, "💨 " + p.optString("wind"));
            v.setTextViewText(R.id.rain, "💧 " + p.optString("rain"));
            v.setTextViewText(R.id.storm, p.isNull("storm") ? "" : "⚡ " + p.optString("storm"));
            dim = new int[] { R.id.day, R.id.hilo, R.id.updated, R.id.wind, R.id.rain, R.id.storm };
        } else {
            dim = new int[] { R.id.day, R.id.hilo, R.id.updated };
        }
        finish(c, v, id, p, look, p.optString("sky"), new int[] { R.id.peak, R.id.line }, dim);
        if (!p.isNull("good") && p.optBoolean("good")) v.setTextColor(R.id.line, look.sky ? GOOD_ON_SKY : GOOD);
        return v;
    }

    // sky or system background, the stale marker, and the tap
    private static void finish(Context c, RemoteViews v, int id, JSONObject p, Look look, String sky, int[] strong, int[] dim) {
        JSONObject skies = p.optJSONObject("skies");
        JSONArray colors = skies == null ? null : skies.optJSONArray(sky);
        if (look.sky && colors != null) {
            v.setImageViewBitmap(R.id.sky, gradient(colors));
            v.setViewVisibility(R.id.sky, View.VISIBLE);
            tint(v, WHITE, strong);
            tint(v, WHITE_DIM, dim);
        } else {
            v.setViewVisibility(R.id.sky, View.GONE);
        }
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

    // a 1-pixel-wide vertical gradient, stretched over the widget
    private static Bitmap gradient(JSONArray colors) {
        int n = Math.max(colors.length(), 2);
        int[] cs = new int[n];
        for (int i = 0; i < n; i++) {
            try {
                cs[i] = Color.parseColor(colors.optString(Math.min(i, colors.length() - 1), "#101d45"));
            } catch (IllegalArgumentException e) {
                cs[i] = 0xFF101D45;
            }
        }
        Bitmap b = Bitmap.createBitmap(1, 96, Bitmap.Config.ARGB_8888);
        Paint paint = new Paint();
        paint.setShader(new LinearGradient(0, 0, 0, 96, cs, null, Shader.TileMode.CLAMP));
        new Canvas(b).drawRect(0, 0, 1, 96, paint);
        return b;
    }

    static PendingIntent open(Context c, int id, String path) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("metablend://open?path=" + Uri.encode(path)));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void tint(RemoteViews v, int color, int... ids) {
        for (int id : ids) v.setTextColor(id, color);
    }

    private static JSONObject obj(JSONObject p, String key) {
        JSONObject o = p.optJSONObject(key);
        return o != null ? o : new JSONObject();
    }
}
