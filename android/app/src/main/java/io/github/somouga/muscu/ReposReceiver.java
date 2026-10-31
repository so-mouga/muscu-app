package io.github.somouga.muscu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Boutons de la notification (+30 s, Passer) et alarme de fin de repos. */
public class ReposReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        if (MinuteurRepos.PLUS.equals(action)) {
            MinuteurRepos.plus30(c);
            MinuteurReposPlugin.signaler("plus", MinuteurRepos.prefs(c).getLong("fin", 0));
        } else if (MinuteurRepos.PASSER.equals(action)) {
            MinuteurRepos.passer(c);
            MinuteurReposPlugin.signaler("passer", 0);
        } else if (MinuteurRepos.FIN.equals(action)) {
            MinuteurRepos.sonner(c);
        }
    }
}
