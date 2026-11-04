package io.github.somouga.muscu;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Pont entre l'appli (src/lib/natif.ts) et la notification de séance tenue par Android. */
@CapacitorPlugin(name = "MinuteurRepos", permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class MinuteurReposPlugin extends Plugin {

    private static MinuteurReposPlugin instance;
    private static final String APPLI_CHOISIE = "io.github.somouga.muscu.APPLI_CHOISIE";

    private BroadcastReceiver surChoix;
    private boolean appliChoisie;

    @Override
    public void load() {
        instance = this;
        MinuteurRepos.auPremierPlan = true;
    }

    @Override
    protected void handleOnResume() {
        MinuteurRepos.auPremierPlan = true;
        Context c = getContext();
        if (c != null) {
            NotificationManagerCompat.from(c).cancel(MinuteurRepos.ID_FIN);
            MinuteurRepos.afficher(c);
        }
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
            case "demarrer" -> MinuteurRepos.repos(c, nombre(call, "fin"), texte, call.getInt("bips", 5));
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

    /**
     * Rappel de séance (Réglages) : actif, heure (« 18:30 ») et nom de la séance de chaque jour prévu
     * ({ "1": "Haut A", "4": "Bas A" }). L'activer demande l'autorisation des notifications la 1re fois.
     */
    @PluginMethod
    public void rappel(PluginCall call) {
        boolean actif = Boolean.TRUE.equals(call.getBoolean("actif", false));
        if (actif && android.os.Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "apresPermissionRappel");
            return;
        }
        reglerRappel(call);
    }

    @PermissionCallback
    private void apresPermissionRappel(PluginCall call) {
        reglerRappel(call);
    }

    private void reglerRappel(PluginCall call) {
        String[] h = call.getString("heure", "18:00").split(":");
        JSObject jours = call.getObject("jours", new JSObject());
        RappelSeance.regler(getContext(), Boolean.TRUE.equals(call.getBoolean("actif", false)), Integer.parseInt(h[0]), Integer.parseInt(h[1]), jours);
        JSObject r = new JSObject();
        r.put("autorise", android.os.Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    /** Une séance démarrée aujourd'hui : pas de rappel ce jour-là. */
    @PluginMethod
    public void seanceDuJour(PluginCall call) {
        RappelSeance.fait(getContext(), call.getString("date", ""));
        call.resolve();
    }

    /** Dossier du fichier à partager, dans le cache de l'appli : seul le dernier est gardé. */
    private File fichierPartage(String nom) {
        return new File(new File(getContext().getCacheDir(), "partage"), new File(nom).getName());
    }

    /** Écrit un morceau du fichier à partager (la WebView ne sait pas le faire, et un gros fichier ne passe pas d'un coup). */
    @PluginMethod
    public void fichierAjouter(PluginCall call) {
        File f = fichierPartage(call.getString("nom", "sauvegarde.json"));
        boolean debut = Boolean.TRUE.equals(call.getBoolean("debut", false));
        File dossier = f.getParentFile();
        if (debut) {
            File[] anciens = dossier.listFiles();
            if (anciens != null) for (File a : anciens) a.delete();
        }
        dossier.mkdirs();
        try (FileOutputStream o = new FileOutputStream(f, !debut)) {
            String texte = call.getString("texte", "");
            o.write(Boolean.TRUE.equals(call.getBoolean("base64", false)) ? Base64.decode(texte, Base64.DEFAULT) : texte.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (IOException e) {
            call.reject("Le fichier n’a pas pu être écrit sur le téléphone.");
        }
    }

    /** Menu de partage Android pour un texte (le bilan complet) : collé tel quel dans la conversation choisie. */
    @PluginMethod
    public void partagerTexte(PluginCall call) {
        String titre = call.getString("titre", "");
        Intent envoi = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, call.getString("texte", "")).putExtra(Intent.EXTRA_SUBJECT, titre);
        getActivity().startActivity(Intent.createChooser(envoi, titre));
        call.resolve();
    }

    /** Menu de partage Android pour le fichier écrit. `choisi` : faux si on l'a fermé sans choisir d'appli. */
    @PluginMethod
    public void partagerFichier(PluginCall call) {
        Context c = getContext();
        File f = fichierPartage(call.getString("nom", "sauvegarde.json"));
        if (!f.exists()) {
            call.reject("Le fichier à partager est introuvable.");
            return;
        }
        Uri lien = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", f);
        Intent envoi = new Intent(Intent.ACTION_SEND).setType(call.getString("type", "application/json")).putExtra(Intent.EXTRA_STREAM, lien).putExtra(Intent.EXTRA_SUBJECT, f.getName()).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        envoi.setClipData(ClipData.newRawUri(f.getName(), lien));
        appliChoisie = false;
        arreterEcoute();
        surChoix = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent i) {
                appliChoisie = true;
            }
        };
        ContextCompat.registerReceiver(c, surChoix, new IntentFilter(APPLI_CHOISIE), ContextCompat.RECEIVER_NOT_EXPORTED);
        PendingIntent choix = PendingIntent.getBroadcast(c, 0, new Intent(APPLI_CHOISIE).setPackage(c.getPackageName()), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        startActivityForResult(call, Intent.createChooser(envoi, f.getName(), choix.getIntentSender()), "apresPartage");
    }

    @ActivityCallback
    private void apresPartage(PluginCall call, ActivityResult resultat) {
        arreterEcoute();
        JSObject r = new JSObject();
        r.put("choisi", appliChoisie);
        call.resolve(r);
    }

    private void arreterEcoute() {
        if (surChoix != null) getContext().unregisterReceiver(surChoix);
        surChoix = null;
    }

    /** Où en est la séance côté Android : mode (seance, repos, pause), fin du repos, temps restant en pause. */
    @PluginMethod
    public void etat(PluginCall call) {
        call.resolve(etatDe(getContext()));
    }
}
