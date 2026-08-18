package cz.boxmanage.app.util

import java.text.DecimalFormat
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

object Actions {
    val labels = mapOf(
        "scan" to "Sken",
        "found" to "Nalezeno",
        "put" to "Vloženo",
        "remove" to "Odebráno",
        "create" to "Vytvořeno",
        "edit" to "Upraveno",
        "delete" to "Smazáno",
        "move" to "Přesunuto",
        "scanRemote" to "Sken (vzdálený)",
    )

    fun label(action: String): String = labels[action] ?: action
}

object Fmt {
    private val df = DecimalFormat("#.##")

    fun qty(q: Double): String = df.format(q)

    private val dateFormatter = DateTimeFormatter.ofPattern("d.M.yyyy HH:mm", Locale("cs", "CZ"))

    fun date(s: String): String {
        if (s.isBlank()) return ""
        return try {
            val normalized = s.trim().replace(' ', 'T').let { if (it.endsWith("Z")) it else "$it" }
            val odt = OffsetDateTime.parse(if (s.contains("Z")) normalized else normalized + "Z")
            odt.format(dateFormatter)
        } catch (_: Exception) {
            s
        }
    }
}
