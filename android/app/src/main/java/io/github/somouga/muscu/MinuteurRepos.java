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
 * Repos entre les séries, tenu par Android : une notification avec le décompte (écran verrouillé,
 * volet, Now Bar) et une alarme à la fin qui sonne même écran éteint. L'état est gardé dans les
 * préférences pour survivre à la mise en veille de l'appli.
 */
public final class MinuteurRepos {

    static final String CANAL_DECOMPTE = "repos";
    static final String CANAL_FIN = "fin-repos";
    static final int ID_DECOMPTE = 1;
    static final int ID_FIN = 2;
    static final String PLUS = "io.github.somouga.muscu.PLUS";
    static final String PASSER = "io.github.somouga.muscu.PASSER";
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
        NotificationChannel decompte = new NotificationChannel(CANAL_DECOMPTE, "Repos en cours", NotificationManager.IMPORTANCE_LOW);
        decompte.setDescription("Le décompte du repos entre les séries");
        decompte.setShowBadge(false);
        decompte.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(decompte);
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

    /** Lance (ou met à jour) le repos jusqu'à `fin` (ms depuis 1970). */
    static void demarrer(Context c, long fin, String titre, String texte) {
        prefs(c).edit().putLong("fin", fin).putString("titre", titre).putString("texte", texte).putBoolean("passe", false).apply();
        canaux(c);
        NotificationManagerCompat.from(c).cancel(ID_FIN);
        afficher(c);
        programmer(c, fin);
    }

    static void afficher(Context c) {
        SharedPreferences p = prefs(c);
        long fin = p.getLong("fin", 0);
        if (fin <= System.currentTimeMillis()) return;
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL_DECOMPTE)
            .setSmallIcon(R.drawable.ic_minuteur)
            .setContentTitle(p.getString("titre", "Repos"))
            .setContentText(p.getString("texte", ""))
            .setWhen(fin)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(ouvrirAppli(c))
            .setTimeoutAfter(fin - System.currentTimeMillis() + 1000)
            .addAction(0, "+30 s", diffusion(c, PLUS, 1))
            .addAction(0, "Passer", diffusion(c, PASSER, 2))
            // Android 16 : suivi en direct (Now Bar sur Samsung) quand le système l'accepte.
            .setRequestPromotedOngoing(true);
        try {
            NotificationManagerCompat.from(c).notify(ID_DECOMPTE, b.build());
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

    /** Arrête tout : notification et alarme. */
    static void arreter(Context c) {
        prefs(c).edit().putLong("fin", 0).apply();
        c.getSystemService(AlarmManager.class).cancel(diffusion(c, FIN, 3));
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(ID_DECOMPTE);
        nm.cancel(ID_FIN);
    }

    static void plus30(Context c) {
        long fin = prefs(c).getLong("fin", 0);
        if (fin <= 0) return;
        fin = Math.max(fin, System.currentTimeMillis()) + 30000;
        prefs(c).edit().putLong("fin", fin).apply();
        afficher(c);
        programmer(c, fin);
    }

    static void passer(Context c) {
        arreter(c);
        prefs(c).edit().putBoolean("passe", true).apply();
    }

    /** L'alarme : la notification de décompte laisse place à « C'est l'heure ». */
    static void sonner(Context c) {
        prefs(c).edit().putLong("fin", 0).apply();
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(ID_DECOMPTE);
        if (auPremierPlan) return;
        canaux(c);
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
            nm.notify(ID_FIN, b.build());
        } catch (SecurityException e) {
            // Notifications refusées.
        }
    }
}
