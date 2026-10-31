package io.github.somouga.muscu;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * La séance en cours, tenue par Android : une notification affichée du début à la fin de la séance
 * (écran verrouillé, volet), qui suit l'état du repos :
 * - « seance » : chrono de la séance, un appui ramène dans l'appli ;
 * - « repos » : décompte, boutons Pause / +30 s / Passer, alarme à la fin même écran éteint ;
 * - « pause » : temps restant figé, boutons Reprendre / Passer.
 * L'état est gardé dans les préférences pour survivre à la mise en veille de l'appli.
 */
public final class MinuteurRepos {

    /** Canal visible sur l'écran verrouillé (Samsung y cache les canaux « silencieux ») mais sans son. */
    static final String CANAL_SEANCE = "seance";
    static final String CANAL_FIN = "fin-repos";
    private static final String ANCIEN_CANAL = "repos";
    static final int ID_SEANCE = 1;
    static final int ID_FIN = 2;
    static final String PLUS = "io.github.somouga.muscu.PLUS";
    static final String PASSER = "io.github.somouga.muscu.PASSER";
    static final String PAUSE = "io.github.somouga.muscu.PAUSE";
    static final String REPRENDRE = "io.github.somouga.muscu.REPRENDRE";
    static final String FIN = "io.github.somouga.muscu.FIN";
    private static final long[] VIBRATION = { 0, 300, 150, 300, 150, 600 };

    /** Vrai quand l'appli est à l'écran : c'est elle qui bipe, pas la notification. */
    static volatile boolean auPremierPlan = false;

    private MinuteurRepos() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("minuteur-repos", Context.MODE_PRIVATE);
    }

    static void canaux(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.deleteNotificationChannel(ANCIEN_CANAL);
        NotificationChannel seance = new NotificationChannel(CANAL_SEANCE, "Séance en cours", NotificationManager.IMPORTANCE_DEFAULT);
        seance.setDescription("Le chrono de la séance et le décompte du repos");
        seance.setSound(null, null);
        seance.enableVibration(false);
        seance.setShowBadge(false);
        seance.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(seance);
        NotificationChannel fin = new NotificationChannel(CANAL_FIN, "Fin du repos", NotificationManager.IMPORTANCE_HIGH);
        fin.setDescription("Sonne et vibre quand le repos est fini");
        fin.enableVibration(true);
        fin.setVibrationPattern(VIBRATION);
        fin.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        );
        fin.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(fin);
    }

    private static PendingIntent diffusion(Context c, String action, int code) {
        Intent i = new Intent(c, ReposReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent ouvrirAppli(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String chrono(long ms) {
        long s = Math.max(0, Math.round(ms / 1000.0));
        return (s / 60) + ":" + String.format(java.util.Locale.ROOT, "%02d", s % 60);
    }

    /** Pas de repos en cours : chrono de la séance (depuis `debut`). */
    static void seance(Context c, long debut, String nom, String ensuite) {
        prefs(c).edit().putString("mode", "seance").putLong("debut", debut).putString("nom", nom).putString("texte", ensuite).putLong("fin", 0).putLong("reste", 0).apply();
        annulerAlarme(c);
        afficher(c);
    }

    /** Repos jusqu'à `fin` (ms depuis 1970). */
    static void repos(Context c, long fin, String ensuite) {
        prefs(c).edit().putString("mode", "repos").putLong("fin", fin).putString("texte", ensuite).putLong("reste", 0).apply();
        NotificationManagerCompat.from(c).cancel(ID_FIN);
        afficher(c);
        programmer(c, fin);
    }

    /** Repos en pause : `reste` ms figées. */
    static void pause(Context c, long reste, String ensuite) {
        prefs(c).edit().putString("mode", "pause").putLong("reste", reste).putString("texte", ensuite).putLong("fin", 0).apply();
        annulerAlarme(c);
        afficher(c);
    }

    static void afficher(Context c) {
        canaux(c);
        SharedPreferences p = prefs(c);
        String mode = p.getString("mode", "");
        String nom = p.getString("nom", "Séance");
        String texte = p.getString("texte", "");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL_SEANCE)
            .setSmallIcon(R.drawable.ic_minuteur)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(ouvrirAppli(c))
            // Android 16 : suivi en direct (Now Bar sur Samsung) quand le système l'accepte.
            .setRequestPromotedOngoing(true);
        if ("repos".equals(mode)) {
            b.setContentTitle("⏱ Repos · " + nom)
                .setContentText(texte)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setWhen(p.getLong("fin", 0))
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .addAction(0, "Pause", diffusion(c, PAUSE, 4))
                .addAction(0, "+30 s", diffusion(c, PLUS, 1))
                .addAction(0, "Passer", diffusion(c, PASSER, 2));
        } else if ("pause".equals(mode)) {
            b.setContentTitle("⏸ Repos en pause · " + chrono(p.getLong("reste", 0)) + " restantes")
                .setContentText(texte)
                .setShowWhen(false)
                .addAction(0, "Reprendre", diffusion(c, REPRENDRE, 5))
                .addAction(0, "Passer", diffusion(c, PASSER, 2));
        } else if ("seance".equals(mode)) {
            b.setContentTitle("🏋️ " + nom + " · séance en cours")
                .setContentText(texte)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setWhen(p.getLong("debut", System.currentTimeMillis()))
                .setShowWhen(true)
                .setUsesChronometer(true);
        } else return;
        try {
            NotificationManagerCompat.from(c).notify(ID_SEANCE, b.build());
        } catch (SecurityException e) {
            // Notifications refusées : l'appli garde son minuteur à l'écran.
        }
    }

    private static void programmer(Context c, long fin) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = diffusion(c, FIN, 3);
        am.cancel(pi);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fin, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fin, pi);
    }

    private static void annulerAlarme(Context c) {
        c.getSystemService(AlarmManager.class).cancel(diffusion(c, FIN, 3));
    }

    /** Fin de la séance : plus rien. */
    static void arreter(Context c) {
        prefs(c).edit().putString("mode", "").putLong("fin", 0).putLong("reste", 0).apply();
        annulerAlarme(c);
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(ID_SEANCE);
        nm.cancel(ID_FIN);
    }

    private static void versSeance(Context c) {
        SharedPreferences p = prefs(c);
        seance(c, p.getLong("debut", System.currentTimeMillis()), p.getString("nom", "Séance"), p.getString("texte", ""));
    }

    static void plus30(Context c) {
        SharedPreferences p = prefs(c);
        if ("pause".equals(p.getString("mode", ""))) {
            pause(c, p.getLong("reste", 0) + 30000, p.getString("texte", ""));
            return;
        }
        long fin = p.getLong("fin", 0);
        if (fin <= 0) return;
        repos(c, Math.max(fin, System.currentTimeMillis()) + 30000, p.getString("texte", ""));
    }

    static void mettreEnPause(Context c) {
        SharedPreferences p = prefs(c);
        long fin = p.getLong("fin", 0);
        if (!"repos".equals(p.getString("mode", "")) || fin <= 0) return;
        pause(c, Math.max(0, fin - System.currentTimeMillis()), p.getString("texte", ""));
    }

    static void reprendre(Context c) {
        SharedPreferences p = prefs(c);
        if (!"pause".equals(p.getString("mode", ""))) return;
        repos(c, System.currentTimeMillis() + p.getLong("reste", 0), p.getString("texte", ""));
    }

    static void passer(Context c) {
        NotificationManagerCompat.from(c).cancel(ID_FIN);
        versSeance(c);
    }

    /** L'alarme : la notification revient au chrono de séance, et « C'est l'heure » sonne (appli en arrière-plan). */
    static void sonner(Context c) {
        versSeance(c);
        if (auPremierPlan) return;
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL_FIN)
            .setSmallIcon(R.drawable.ic_minuteur)
            .setContentTitle("C’est l’heure de ta série 💪")
            .setContentText(prefs(c).getString("texte", ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVibrate(VIBRATION)
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setTimeoutAfter(120000)
            .setContentIntent(ouvrirAppli(c));
        try {
            NotificationManagerCompat.from(c).notify(ID_FIN, b.build());
        } catch (SecurityException e) {
            // Notifications refusées.
        }
    }
}
