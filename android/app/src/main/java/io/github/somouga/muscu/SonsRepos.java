package io.github.somouga.muscu;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.SoundPool;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Le tintement de l'appli (style « Fonte », rendu en WAV dans res/raw) joué par Android quand l'appli n'est pas à l'écran.
 * Comme les annonces d'un GPS : il suit le volume de la musique et passe par-dessus, la musique baisse un instant
 * sans être coupée. L'ancien bip de notification, court et au volume des notifications, se perdait sous la musique.
 */
final class SonsRepos {
    static final AudioAttributes ATTRIBUTS = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();
    /** Filet de sécurité : la musique remonte toujours, même si la fin du repos n'arrive jamais. */
    private static final long RENDRE_AU_PLUS_TARD = 15000;
    private static final Handler PRINCIPAL = new Handler(Looper.getMainLooper());
    private static Object focus;

    private SonsRepos() {}

    /** La musique baisse le temps du décompte et du son de fin. */
    static synchronized void baisserMusique(Context c) {
        if (focus != null) return;
        AudioManager am = c.getSystemService(AudioManager.class);
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest r = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(ATTRIBUTS).build();
            am.requestAudioFocus(r);
            focus = r;
        } else {
            AudioManager.OnAudioFocusChangeListener l = changement -> {};
            am.requestAudioFocus(l, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            focus = l;
        }
        PRINCIPAL.removeCallbacksAndMessages(null);
        PRINCIPAL.postDelayed(() -> rendreMusique(c), RENDRE_AU_PLUS_TARD);
    }

    static synchronized void rendreMusique(Context c) {
        if (focus == null) return;
        AudioManager am = c.getSystemService(AudioManager.class);
        if (am != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) am.abandonAudioFocusRequest((AudioFocusRequest) focus);
            else am.abandonAudioFocus((AudioManager.OnAudioFocusChangeListener) focus);
        }
        focus = null;
        PRINCIPAL.removeCallbacksAndMessages(null);
    }

    /** Les tics du décompte, chargés d'avance : un tic par seconde doit partir sans attendre. */
    static final class Tics {
        private final SoundPool pool;
        private final int tic;
        private final int dernier;

        Tics(Context c) {
            pool = new SoundPool.Builder().setMaxStreams(2).setAudioAttributes(ATTRIBUTS).build();
            CountDownLatch charges = new CountDownLatch(2);
            pool.setOnLoadCompleteListener((p, id, etat) -> charges.countDown());
            tic = pool.load(c, R.raw.tic, 1);
            dernier = pool.load(c, R.raw.tic_dernier, 1);
            try {
                charges.await(800, TimeUnit.MILLISECONDS);
            } catch (InterruptedException ignored) {}
        }

        void jouer(boolean estDernier) {
            pool.play(estDernier ? dernier : tic, 1f, 1f, 1, 0, 1f);
        }

        void liberer() {
            pool.release();
        }
    }

    /** Les trois coups de la fin du repos ; `fini` est appelé une fois le son terminé (ou s'il n'a pas pu partir). */
    static void jouerFin(Context c, Runnable fini) {
        baisserMusique(c);
        MediaPlayer mp = new MediaPlayer();
        Runnable terminer = () -> {
            mp.release();
            rendreMusique(c);
            if (fini != null) fini.run();
        };
        try (AssetFileDescriptor f = c.getResources().openRawResourceFd(R.raw.fin_repos)) {
            mp.setAudioAttributes(ATTRIBUTS);
            mp.setDataSource(f.getFileDescriptor(), f.getStartOffset(), f.getLength());
            mp.setOnCompletionListener(m -> terminer.run());
            mp.setOnErrorListener((m, quoi, extra) -> {
                terminer.run();
                return true;
            });
            mp.prepare();
            mp.start();
        } catch (Exception e) {
            terminer.run();
        }
    }
}
