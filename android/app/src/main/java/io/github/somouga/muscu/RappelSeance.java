package io.github.somouga.muscu;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Rappel de séance : les jours prévus par le planning (1 = lundi … 7 = dimanche), à l'heure choisie,
 * une notification « C'est jour de … ». Rien si une séance a déjà été démarrée ce jour-là. L'appli
 * envoie le planning et l'heure (Réglages) ; Android garde tout dans ses préférences et replanifie
 * chaque jour, et après un redémarrage du téléphone.
 */
public final class RappelSeance {

    static final String CANAL = "rappel";
    static final int ID = 3;
    static final String ACTION = "io.github.somouga.muscu.RAPPEL";

    private RappelSeance() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("rappel-seance", Context.MODE_PRIVATE);
    }

    /** Réglage venu de l'appli : actif ou non, heure, et nom de la séance de chaque jour prévu. */
    static void regler(Context c, boolean actif, int heure, int minute, JSONObject jours) {
        prefs(c).edit().putBoolean("actif", actif).putInt("heure", heure).putInt("minute", minute).putString("jours", jours.toString()).apply();
        planifier(c);
    }

    /** Une séance est démarrée aujourd'hui : pas de rappel ce jour-là (et on retire celui déjà affiché). */
    static void fait(Context c, String date) {
        prefs(c).edit().putString("faitLe", date).apply();
        if (date.equals(aujourdhui())) NotificationManagerCompat.from(c).cancel(ID);
    }

    private static String aujourdhui() {
        Calendar k = Calendar.getInstance();
        return String.format(Locale.ROOT, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    /** 1 = lundi … 7 = dimanche, comme dans l'appli. */
    private static int jourSemaine(Calendar k) {
        return ((k.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1;
    }

    private static PendingIntent alarme(Context c) {
        Intent i = new Intent(c, RappelReceiver.class).setAction(ACTION);
        return PendingIntent.getBroadcast(c, 10, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Prochaine heure de rappel (aujourd'hui si elle n'est pas passée, sinon demain) ; on vérifie le jour au moment de sonner. */
    static void planifier(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        am.cancel(alarme(c));
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("actif", false)) return;
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, p.getInt("heure", 18));
        k.set(Calendar.MINUTE, p.getInt("minute", 0));
        k.set(Calendar.SECOND, 0);
        k.set(Calendar.MILLISECOND, 0);
        if (k.getTimeInMillis() <= System.currentTimeMillis()) k.add(Calendar.DAY_OF_MONTH, 1);
        long t = k.getTimeInMillis();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, alarme(c));
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, alarme(c));
    }

    /** L'heure est venue : rappel si c'est un jour prévu et que rien n'a été démarré aujourd'hui, puis le prochain. */
    static void sonner(Context c) {
        SharedPreferences p = prefs(c);
        String nom = null;
        try {
            nom = new JSONObject(p.getString("jours", "{}")).optString(String.valueOf(jourSemaine(Calendar.getInstance())), null);
        } catch (org.json.JSONException ignore) {}
        if (p.getBoolean("actif", false) && nom != null && !aujourdhui().equals(p.getString("faitLe", ""))) afficher(c, nom);
        planifier(c);
    }

    private static void afficher(Context c, String nom) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel canal = new NotificationChannel(CANAL, "Rappel de séance", NotificationManager.IMPORTANCE_DEFAULT);
            canal.setDescription("Les jours d'entraînement prévus, à l'heure choisie dans Réglages");
            c.getSystemService(NotificationManager.class).createNotificationChannel(canal);
        }
        Intent ouvrir = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_rappel)
            .setContentTitle("C’est jour de " + nom)
            .setContentText("Ta séance est prête dans Cran.")
            .setContentIntent(PendingIntent.getActivity(c, 11, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER);
        try {
            NotificationManagerCompat.from(c).notify(ID, b.build());
        } catch (SecurityException ignore) {
            // Notifications refusées : rien à faire, le rappel reste coupé de fait.
        }
    }
}
