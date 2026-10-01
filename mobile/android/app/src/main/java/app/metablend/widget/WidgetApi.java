package app.metablend.widget;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONObject;

// GET /api/app-widget — the server already turned the forecast into text.
public final class WidgetApi {
    private WidgetApi() {}

    public static final class Result {
        public final int status;
        public final JSONObject json;

        Result(int status, JSONObject json) {
            this.status = status;
            this.json = json;
        }
    }

    static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return "";
        }
    }

    public static String weatherQuery(String city, String lang, String unit) {
        return "city=" + enc(city) + "&lang=" + enc(lang) + "&unit=" + enc(unit);
    }

    public static String hikeQuery(JSONObject plan, String lang, String unit) {
        return "kind=hike&name=" + enc(plan.optString("name")) + "&lat=" + plan.optDouble("lat") + "&lon=" + plan.optDouble("lon")
            + "&elev=" + Math.round(plan.optDouble("elev")) + "&date=" + enc(plan.optString("date"))
            + "&lang=" + enc(lang) + "&unit=" + enc(unit);
    }

    public static Result get(String base, String query) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(base + "/api/app-widget?" + query).openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(8000);
            int status = con.getResponseCode();
            if (status != 200) return new Result(status, null);
            try (InputStream in = con.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                return new Result(200, new JSONObject(out.toString("UTF-8")));
            }
        } catch (Exception e) {
            return new Result(0, null);
        } finally {
            if (con != null) con.disconnect();
        }
    }
}
