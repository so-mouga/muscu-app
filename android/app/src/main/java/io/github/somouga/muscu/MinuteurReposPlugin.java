package io.github.somouga.muscu;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Pont entre l'appli (src/lib/natif.ts) et la notification de séance tenue par Android. */
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

    private static JSObject etatDe(Context c) {
        SharedPreferences p = MinuteurRepos.prefs(c);
        JSObject d = new JSObject();
        d.put("mode", p.getString("mode", ""));
        d.put("fin", p.getLong("fin", 0));
        d.put("reste", p.getLong("reste", 0));
        return d;
    }

    /** Un bouton de la notification a été touché : l'appli suit (si elle tourne encore). */
    static void signaler(Context c) {
        if (instance != null) instance.notifyListeners("action", etatDe(c));
    }

    /** Toutes les méthodes : la 1re fois, on demande l'autorisation d'afficher des notifications. */
    private boolean autorise(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "apresPermission");
            return false;
        }
        return true;
    }

    @PermissionCallback
    private void apresPermission(PluginCall call) {
        executer(call);
    }

    /** Horodatage ou durée : arrive en entier (Date.now()), parfois en décimal. */
    private static long nombre(PluginCall call, String cle) {
        Long l = call.getLong(cle);
        if (l != null) return l;
        Double d = call.getDouble(cle);
        return d == null ? 0 : d.longValue();
    }

    private void executer(PluginCall call) {
        Context c = getContext();
        String texte = call.getString("texte", "");
        // Nom et début de la séance : gardés pour le titre et pour revenir au chrono de séance après un repos.
        SharedPreferences.Editor e = MinuteurRepos.prefs(c).edit();
        if (call.getString("nom") != null) e.putString("nom", call.getString("nom"));
        if (nombre(call, "debut") > 0) e.putLong("debut", nombre(call, "debut"));
        e.apply();
        switch (call.getMethodName()) {
            case "seance" -> MinuteurRepos.seance(c, nombre(call, "debut"), call.getString("nom", "Séance"), texte);
            case "demarrer" -> MinuteurRepos.repos(c, nombre(call, "fin"), texte);
            case "pause" -> MinuteurRepos.pause(c, nombre(call, "reste"), texte);
            default -> {}
        }
        call.resolve();
    }

    @PluginMethod
    public void seance(PluginCall call) {
        if (autorise(call)) executer(call);
    }

    @PluginMethod
    public void demarrer(PluginCall call) {
        if (autorise(call)) executer(call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (autorise(call)) executer(call);
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        MinuteurRepos.arreter(getContext());
        call.resolve();
    }

    /** Mettre l'appli en arrière-plan (plus utilisé par l'appli web depuis la 1.4, gardé pour ne pas republier d'APK). */
    @PluginMethod
    public void quitter(PluginCall call) {
        getActivity().moveTaskToBack(true);
        call.resolve();
    }

    /** Version de l'appli installée : l'appli web propose d'installer un APK plus récent. */
    @PluginMethod
    public void version(PluginCall call) {
        JSObject r = new JSObject();
        try {
            r.put("versionName", getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName);
            call.resolve(r);
        } catch (android.content.pm.PackageManager.NameNotFoundException e) {
            call.reject("version inconnue");
        }
    }

    /** Où en est la séance côté Android : mode (seance, repos, pause), fin du repos, temps restant en pause. */
    @PluginMethod
    public void etat(PluginCall call) {
        call.resolve(etatDe(getContext()));
    }
}
