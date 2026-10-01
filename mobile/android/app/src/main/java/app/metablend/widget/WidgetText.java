package app.metablend.widget;

import java.util.HashMap;
import java.util.Map;

// The few texts the widgets and their settings screen show, in the app's
// five languages (the language arrives with the app's sync).
public final class WidgetText {
    private static final String[] KEYS = {
        "settings", "city", "home", "show", "hours", "days", "style", "sky", "system", "save",
        "openOnce", "pickCity", "planHike", "offline",
    };
    private static final Map<String, String[]> T = new HashMap<>();

    static {
        T.put("en", new String[] {
            "Widget settings", "City", "Home city", "Show", "Next hours", "Next days", "Style", "Living sky", "System", "Save",
            "Open MetaBlend once to pick a city", "Pick a city in MetaBlend", "Plan a hike in the app", "No connection — tap to open MetaBlend",
        });
        T.put("de", new String[] {
            "Widget-Einstellungen", "Ort", "Heimatstadt", "Anzeigen", "Nächste Stunden", "Nächste Tage", "Stil", "Lebendiger Himmel", "System", "Speichern",
            "Öffne MetaBlend einmal, um einen Ort zu wählen", "Wähle einen Ort in MetaBlend", "Plane eine Tour in der App", "Keine Verbindung – tippen, um MetaBlend zu öffnen",
        });
        T.put("fr", new String[] {
            "Réglages du widget", "Ville", "Ville principale", "Afficher", "Prochaines heures", "Prochains jours", "Style", "Ciel vivant", "Système", "Enregistrer",
            "Ouvrez MetaBlend une fois pour choisir une ville", "Choisissez une ville dans MetaBlend", "Planifiez une randonnée dans l’app", "Pas de connexion — touchez pour ouvrir MetaBlend",
        });
        T.put("es", new String[] {
            "Ajustes del widget", "Ciudad", "Ciudad principal", "Mostrar", "Próximas horas", "Próximos días", "Estilo", "Cielo vivo", "Sistema", "Guardar",
            "Abre MetaBlend una vez para elegir una ciudad", "Elige una ciudad en MetaBlend", "Planifica una excursión en la app", "Sin conexión: toca para abrir MetaBlend",
        });
        T.put("it", new String[] {
            "Impostazioni widget", "Città", "Città principale", "Mostra", "Prossime ore", "Prossimi giorni", "Stile", "Cielo vivo", "Sistema", "Salva",
            "Apri MetaBlend una volta per scegliere una città", "Scegli una città in MetaBlend", "Pianifica un’escursione nell’app", "Nessuna connessione: tocca per aprire MetaBlend",
        });
    }

    private final String[] row;

    public WidgetText(String lang) {
        String[] r = T.get(lang);
        row = r != null ? r : T.get("en");
    }

    public String get(String key) {
        for (int i = 0; i < KEYS.length; i++) if (KEYS[i].equals(key)) return row[i];
        return key;
    }
}
