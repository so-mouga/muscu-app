package io.github.somouga.muscu

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView

/** Ce que Cran fait de tes pas et de ton sommeil : page demandée par Health Connect, ouverte depuis ses réglages. */
class ConfidentialiteSante : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val marge = (24 * resources.displayMetrics.density).toInt()
        val texte = TextView(this).apply {
            setTextColor(Color.parseColor("#F5F4F2"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setLineSpacing(0f, 1.3f)
            setPadding(marge, marge * 2, marge, marge)
            text = """
                Cran et Health Connect

                Cran lit seulement trois choses : tes pas par jour, tes nuits de sommeil, et le total de tes repas (calories, protéines, glucides, lipides), tels que ta montre, ton téléphone ou ton appli de repas les écrivent dans Health Connect.

                Elles restent sur ton téléphone, dans Cran. Elles servent à remplir la case Sommeil de l'accueil, ton Journal, ton Bilan, et les textes que tu choisis toi-même de partager.

                Cran n'écrit rien dans Health Connect, n'a pas de serveur et n'envoie rien ailleurs.

                Pour arrêter : Réglages du téléphone, Health Connect, Cran, et retire les autorisations.
            """.trimIndent()
        }
        setContentView(ScrollView(this).apply { setBackgroundColor(Color.parseColor("#0C0B0A")); addView(texte) })
    }
}
