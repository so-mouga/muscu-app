package io.github.somouga.muscu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Boutons de la notification (Pause, Reprendre, +30 s, Passer) et alarme de fin de repos. */
public class ReposReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        if (MinuteurRepos.PLUS.equals(action)) MinuteurRepos.plus30(c);
        else if (MinuteurRepos.PAUSE.equals(action)) MinuteurRepos.mettreEnPause(c);
        else if (MinuteurRepos.REPRENDRE.equals(action)) MinuteurRepos.reprendre(c);
        else if (MinuteurRepos.PASSER.equals(action)) MinuteurRepos.passer(c);
        else if (MinuteurRepos.ENCORE.equals(action)) MinuteurRepos.encore(c);
        else if (MinuteurRepos.FIN.equals(action)) {
            // Le son de fin dure près de 2 s : Android garde l'appli éveillée jusqu'à ce qu'il soit joué.
            final PendingResult pr = goAsync();
            MinuteurRepos.sonner(c, pr::finish);
            return;
        } else if (MinuteurRepos.DECOMPTE.equals(action)) {
            final PendingResult pr = goAsync();
            new Thread(() -> {
                try {
                    MinuteurRepos.lancerDecompte(c);
                } finally {
                    pr.finish();
                }
            }).start();
            return;
        } else return;
        // L'appli suit l'état choisi depuis la notification (si elle tourne encore ; sinon au retour, par `etat`).
        MinuteurReposPlugin.signaler(c);
    }
}
