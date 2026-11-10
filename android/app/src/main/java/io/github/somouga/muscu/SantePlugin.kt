package io.github.somouga.muscu

import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Pas, sommeil et nutrition lus dans Health Connect (src/lib/sante.ts) : ce que la montre (Mi Fitness, Samsung
 * Health…), le téléphone ou l'appli de repas (MyFitnessPal…) y écrivent. Lecture seulement, appli au premier plan, rien n'est envoyé ailleurs.
 */
@CapacitorPlugin(name = "Sante")
class SantePlugin : Plugin() {

    private val portee = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val lirePas = HealthPermission.getReadPermission(StepsRecord::class)
    private val lireSommeil = HealthPermission.getReadPermission(SleepSessionRecord::class)
    private val lireNutrition = HealthPermission.getReadPermission(NutritionRecord::class)
    private val demandees = setOf(lirePas, lireSommeil, lireNutrition)

    /** Health Connect existe sur ce téléphone (intégré depuis Android 14). */
    private fun disponible(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    private fun client() = HealthConnectClient.getOrCreate(context)

    private fun reponseEtat(accordees: Set<String>): JSObject {
        val r = JSObject()
        r.put("disponible", true)
        r.put("pas", accordees.contains(lirePas))
        r.put("sommeil", accordees.contains(lireSommeil))
        r.put("nutrition", accordees.contains(lireNutrition))
        return r
    }

    @PluginMethod
    fun etat(call: PluginCall) {
        if (!disponible()) {
            call.resolve(JSObject().put("disponible", false).put("pas", false).put("sommeil", false).put("nutrition", false))
            return
        }
        portee.launch {
            try {
                call.resolve(reponseEtat(client().permissionController.getGrantedPermissions()))
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect ne répond pas")
            }
        }
    }

    /** Ouvre l'écran d'autorisation de Health Connect. */
    @PluginMethod
    fun autoriser(call: PluginCall) {
        if (!disponible()) {
            call.resolve(JSObject().put("disponible", false).put("pas", false).put("sommeil", false).put("nutrition", false))
            return
        }
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, demandees)
        startActivityForResult(call, intent, "apresAutorisation")
    }

    @ActivityCallback
    fun apresAutorisation(call: PluginCall?, resultat: ActivityResult) {
        if (call == null) return
        etat(call)
    }

    /**
     * Les `jours` derniers jours : pas par jour (dédoublonnés par Health Connect entre la montre et le téléphone),
     * et chaque période de sommeil (début, fin, minutes dormies sans les éveils).
     */
    @PluginMethod
    fun lire(call: PluginCall) {
        if (!disponible()) {
            call.reject("Health Connect absent")
            return
        }
        val jours = (call.getInt("jours") ?: 14).coerceIn(1, 30).toLong()
        portee.launch {
            try {
                val c = client()
                val accordees = c.permissionController.getGrantedPermissions()
                val r = JSObject()
                val pas = JSArray()
                if (accordees.contains(lirePas)) {
                    val debut = LocalDate.now().minusDays(jours - 1).atStartOfDay()
                    val fin = LocalDate.now().plusDays(1).atStartOfDay()
                    val groupes = c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(debut, fin), Period.ofDays(1)))
                    for (g in groupes) {
                        val n = g.result[StepsRecord.COUNT_TOTAL] ?: continue
                        pas.put(JSObject().put("date", g.startTime.toLocalDate().toString()).put("pas", n))
                    }
                }
                val nuits = JSArray()
                if (accordees.contains(lireSommeil)) {
                    val maintenant = Instant.now()
                    val reponse = c.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(maintenant.minus(Duration.ofDays(jours + 1)), maintenant)))
                    for (s in reponse.records) {
                        val eveil = setOf(SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED)
                        val total = Duration.between(s.startTime, s.endTime).toMinutes()
                        val eveille = s.stages.filter { it.stage in eveil }.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                        nuits.put(JSObject().put("debut", s.startTime.toEpochMilli()).put("fin", s.endTime.toEpochMilli()).put("minutes", (total - eveille).coerceAtLeast(0)))
                    }
                }
                // Repas : total du jour (calories et macros), dédoublonné par Health Connect.
                val repas = JSArray()
                if (accordees.contains(lireNutrition)) {
                    val debut = LocalDate.now().minusDays(jours - 1).atStartOfDay()
                    val fin = LocalDate.now().plusDays(1).atStartOfDay()
                    val mesures = setOf(NutritionRecord.ENERGY_TOTAL, NutritionRecord.PROTEIN_TOTAL, NutritionRecord.TOTAL_CARBOHYDRATE_TOTAL, NutritionRecord.TOTAL_FAT_TOTAL)
                    val groupes = c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(mesures, TimeRangeFilter.between(debut, fin), Period.ofDays(1)))
                    for (g in groupes) {
                        val kcal = g.result[NutritionRecord.ENERGY_TOTAL]?.inKilocalories ?: continue
                        val o = JSObject().put("date", g.startTime.toLocalDate().toString()).put("kcal", kcal)
                        g.result[NutritionRecord.PROTEIN_TOTAL]?.let { o.put("proteines", it.inGrams) }
                        g.result[NutritionRecord.TOTAL_CARBOHYDRATE_TOTAL]?.let { o.put("glucides", it.inGrams) }
                        g.result[NutritionRecord.TOTAL_FAT_TOTAL]?.let { o.put("lipides", it.inGrams) }
                        repas.put(o)
                    }
                }
                r.put("pas", pas)
                r.put("nuits", nuits)
                r.put("repas", repas)
                call.resolve(r)
            } catch (e: Exception) {
                call.reject(e.message ?: "Lecture impossible")
            }
        }
    }

    override fun handleOnDestroy() {
        portee.cancel()
    }
}
