package io.github.somouga.muscu;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MinuteurReposPlugin.class);
        super.onCreate(savedInstanceState);
        // Toute première ouverture sans réseau : le site n'est pas encore en cache, on le dit clairement.
        bridge.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public void onReceivedError(WebView vue, WebResourceRequest demande, WebResourceError erreur) {
                    super.onReceivedError(vue, demande, erreur);
                    if (demande.isForMainFrame()) vue.loadDataWithBaseURL(null, pageHorsLigne(bridge.getAppUrl()), "text/html", "utf-8", null);
                }
            }
        );
    }

    private static String pageHorsLigne(String adresse) {
        return "<!doctype html><html lang=fr><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<body style='margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:#f1f3f7;font-family:system-ui,sans-serif;text-align:center'>"
            + "<div style='padding:24px;max-width:340px'><div style='font-size:48px'>📶</div>"
            + "<h2 style='margin:12px 0'>Pas de connexion</h2>"
            + "<p style='color:#a9b0bf;line-height:1.5'>Pour la toute première ouverture, l’appli a besoin d’Internet. Ensuite, elle marche aussi sans réseau, même en salle.</p>"
            + "<a href='" + adresse + "' style='display:inline-block;margin-top:16px;padding:14px 28px;border-radius:14px;background:#ff8a3d;color:#1a0d03;font-weight:700;text-decoration:none'>Réessayer</a>"
            + "</div></body></html>";
    }
}
