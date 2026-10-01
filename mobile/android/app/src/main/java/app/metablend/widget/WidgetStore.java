package app.metablend.widget;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONException;
import org.json.JSONObject;

// What the widgets keep: the app's synced settings, each widget's choices
// (city, show, style) and its last good payload with the time it arrived.
public final class WidgetStore {
    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("widget", Context.MODE_PRIVATE);
    }

    private static JSONObject parse(String s) {
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    public static void saveSettings(Context c, String json) {
        prefs(c).edit().putString("settings", json).apply();
    }

    public static JSONObject settings(Context c) {
        return parse(prefs(c).getString("settings", null));
    }

    public static String get(Context c, int id, String key, String fallback) {
        return prefs(c).getString(id + "." + key, fallback);
    }

    public static void put(Context c, int id, String key, String value) {
        prefs(c).edit().putString(id + "." + key, value).apply();
    }

    public static void cache(Context c, int id, JSONObject payload) {
        prefs(c).edit().putString(id + ".payload", payload.toString()).putLong(id + ".at", System.currentTimeMillis()).apply();
    }

    public static JSONObject cached(Context c, int id) {
        return parse(prefs(c).getString(id + ".payload", null));
    }

    public static long cachedAt(Context c, int id) {
        return prefs(c).getLong(id + ".at", 0L);
    }

    public static void dropCache(Context c, int id) {
        prefs(c).edit().remove(id + ".payload").remove(id + ".at").apply();
    }

    public static void forget(Context c, int id) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (String k : new String[] { "city", "show", "style", "payload", "at" }) e.remove(id + "." + k);
        e.apply();
    }
}
