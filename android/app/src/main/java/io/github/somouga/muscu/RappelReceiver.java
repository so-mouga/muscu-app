package io.github.somouga.muscu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Heure du rappel de séance ; après un redémarrage ou une mise à jour de l'appli, on le replanifie. */
public class RappelReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        if (RappelSeance.ACTION.equals(intent.getAction())) RappelSeance.sonner(c);
        else RappelSeance.planifier(c);
    }
}
