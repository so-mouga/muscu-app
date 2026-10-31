package io.github.somouga.muscu;

import android.Manifest;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Pont entre l'appli (src/lib/natif.ts) et le repos tenu par Android. */
@CapacitorPlugin(name = "MinuteurRepos", permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class MinuteurReposPlugin extends Plugin {

    private static MinuteurReposPlugin instance;

    @Override
    public void load() {
        instance = this;
        MinuteurRepos.auPremierPlan = true;
    }

    @Override
    protected void handleOnResume() {
        MinuteurRepos.auPremierPlan = true;
    }

    @Override
    protected void handleOnPause() {
        MinuteurRepos.auPremierPlan = false;
    }

    /** Un bouton de la notification a été touché : l'appli suit (si elle tourne encore). */
    static void signaler(String type, long fin) {
        if (instance == null) return;
        JSObject d = new JSObject();
        d.put("type", type);
        d.put("fin", fin);
        instance.notifyListeners("action", d);
    }

    @PluginMethod
    public void demarrer(PluginCall call) {
        if (fin(call) == null) {
            call.reject("fin manquante");
            return;
        }
        if (android.os.Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "apresPermission");
            return;
        }
        lancer(call);
    }

    @PermissionCallback
    private void apresPermission(PluginCall call) {
        lancer(call);
    }

    private void lancer(PluginCall call) {
        MinuteurRepos.demarrer(getContext(), fin(call), call.getString("titre", "Repos"), call.getString("texte", ""));
        call.resolve();
    }

    /** Horodatage de fin : arrive en entier (Date.now()), parfois en décimal. */
    private static Long fin(PluginCall call) {
        Long l = call.getLong("fin");
        if (l != null) return l;
        Double d = call.getDouble("fin");
        return d == null ? null : d.longValue();
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        MinuteurRepos.arreter(getContext());
        call.resolve();
    }

    /** Où en est le repos côté Android : fin (0 = aucun) et s'il a été passé depuis la notification. */
    @PluginMethod
    public void etat(PluginCall call) {
        JSObject r = new JSObject();
        r.put("fin", MinuteurRepos.prefs(getContext()).getLong("fin", 0));
        r.put("passe", MinuteurRepos.prefs(getContext()).getBoolean("passe", false));
        MinuteurRepos.prefs(getContext()).edit().putBoolean("passe", false).apply();
        call.resolve(r);
    }
}
