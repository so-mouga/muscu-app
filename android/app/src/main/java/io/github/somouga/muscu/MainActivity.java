package io.github.somouga.muscu;

import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    /** L'appli a affiché son contenu (plugin, `pret`) : le logo du démarrage peut partir. */
    static volatile boolean appliPrete;

    private static final long ATTENTE_MAX_LOGO = 3000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le logo reste jusqu'au contenu, plutôt qu'un écran vide ; jamais plus de 3 s (pas de réseau, ancien site).
        appliPrete = false;
        long limite = SystemClock.uptimeMillis() + ATTENTE_MAX_LOGO;
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> !appliPrete && SystemClock.uptimeMillis() < limite);
        registerPlugin(MinuteurReposPlugin.class);
        registerPlugin(SantePlugin.class);
        super.onCreate(savedInstanceState);
        bridge.getWebView().setBackgroundColor(Color.parseColor("#0C0B0A"));
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
        // Bouton retour : c'est l'appli qui décide (fermer la fenêtre, revenir à l'écran d'avant…, voir
        // src/lib/nav.ts). On ne quitte que quand elle n'a plus rien à fermer.
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView vue = bridge.getWebView();
                    // On demande directement à l'appli s'il y a quelque chose à fermer (src/lib/nav.ts,
                    // window.__retourCran) : l'historique ne suffit pas, la WebView saute les entrées
                    // ajoutées sans geste de l'utilisateur et le retour fermait l'appli par erreur.
                    vue.evaluateJavascript("(function(){return window.__retourCran ? window.__retourCran() : null})()", r -> {
                        if ("true".equals(r)) return;
                        if (!"false".equals(r) && vue.canGoBack() && !vue.copyBackForwardList().getItemAtIndex(vue.copyBackForwardList().getCurrentIndex() - 1).getUrl().startsWith("data:")) {
                            vue.goBack(); // page sans __retourCran (« Pas de connexion », ancienne version du site)
                            return;
                        }
                        quitter();
                    });
                }

                private void quitter() {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
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
