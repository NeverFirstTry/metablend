package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

// Fetch → cache → render for each widget, off the main thread. A failed
// fetch keeps the last good payload on screen with its time.
public final class WidgetUpdater {
    private WidgetUpdater() {}

    public static final String WEATHER = "weather", HIKE = "hike";

    public static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        update(c, m.getAppWidgetIds(new ComponentName(c, WeatherWidgetProvider.class)), WEATHER, null);
        update(c, m.getAppWidgetIds(new ComponentName(c, HikeWidgetProvider.class)), HIKE, null);
    }

    public static void update(Context context, int[] ids, String kind, BroadcastReceiver.PendingResult pending) {
        Context c = context.getApplicationContext();
        if (ids == null || ids.length == 0) {
            if (pending != null) pending.finish();
            return;
        }
        for (int id : ids) showCached(c, id, kind);
        new Thread(() -> {
            CountDownLatch done = new CountDownLatch(ids.length);
            for (int id : ids) {
                new Thread(() -> {
                    try {
                        refresh(c, id, kind);
                    } catch (RuntimeException ignored) {
                        // one broken widget must not stop the others
                    } finally {
                        done.countDown();
                    }
                }).start();
            }
            try {
                done.await(9, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            if (pending != null) pending.finish();
        }).start();
    }

    // the cached payload as it is, e.g. after a resize on Android 11 and older
    public static void showCached(Context c, int id, String kind) {
        JSONObject p = WidgetStore.cached(c, id);
        if (p != null) show(c, id, kind, p, false);
    }

    static void refresh(Context c, int id, String kind) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        JSONObject s = WidgetStore.settings(c);
        WidgetText tx = new WidgetText(s == null ? Locale.getDefault().getLanguage() : s.optString("lang", "en"));
        if (s == null) {
            m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("openOnce")));
            return;
        }
        String lang = s.optString("lang", "en"), unit = s.optString("unit", "C"), base = s.optString("base", "https://metablend.app");
        WidgetApi.Result r;
        if (HIKE.equals(kind)) {
            JSONObject plan = nextPlan(s.optJSONArray("hikes"));
            if (plan == null) {
                m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("planHike")));
                return;
            }
            r = WidgetApi.get(base, WidgetApi.hikeQuery(plan, lang, unit));
        } else {
            String home = s.isNull("home") ? "" : s.optString("home", "");
            String city = WidgetStore.get(c, id, "city", "");
            if (city.isEmpty()) city = home;
            if (city.isEmpty()) {
                m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("pickCity")));
                return;
            }
            r = WidgetApi.get(base, WidgetApi.weatherQuery(city, lang, unit));
            if (r.status == 404 && !home.isEmpty() && !home.equals(city)) r = WidgetApi.get(base, WidgetApi.weatherQuery(home, lang, unit));
        }
        if (r.json != null) {
            WidgetStore.cache(c, id, r.json);
            show(c, id, kind, r.json, false);
            return;
        }
        JSONObject old = WidgetStore.cached(c, id);
        if (old != null) show(c, id, kind, old, true);
        else m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("offline")));
    }

    private static void show(Context c, int id, String kind, JSONObject p, boolean stale) {
        WidgetRenderer.Look look = new WidgetRenderer.Look(
            !"system".equals(WidgetStore.get(c, id, "style", "sky")), stale, WidgetStore.cachedAt(c, id), WidgetStore.get(c, id, "show", "hours"));
        RemoteViews v = HIKE.equals(kind) ? WidgetRenderer.hike(c, id, p, look) : WidgetRenderer.weather(c, id, p, look);
        AppWidgetManager.getInstance(c).updateAppWidget(id, v);
    }

    // the earliest plan dated today or later (the phone's calendar)
    static JSONObject nextPlan(JSONArray hikes) {
        if (hikes == null) return null;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        JSONObject best = null;
        for (int i = 0; i < hikes.length(); i++) {
            JSONObject h = hikes.optJSONObject(i);
            if (h == null) continue;
            String d = h.optString("date");
            if (d.compareTo(today) >= 0 && (best == null || d.compareTo(best.optString("date")) < 0)) best = h;
        }
        return best;
    }
}
