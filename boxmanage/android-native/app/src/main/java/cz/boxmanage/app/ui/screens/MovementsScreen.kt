package cz.boxmanage.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.Movement
import cz.boxmanage.app.data.MovementsResponse
import cz.boxmanage.app.ui.EmptyBox
import cz.boxmanage.app.ui.ErrorBox
import cz.boxmanage.app.ui.LoadingBox
import cz.boxmanage.app.ui.UiState
import cz.boxmanage.app.ui.humanMessage
import cz.boxmanage.app.util.Fmt
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun MovementsScreen(boxId: String, onBack: () -> Unit) {
    var page by remember { mutableIntStateOf(1) }
    var items by remember { mutableStateOf<List<Movement>>(emptyList()) }
    var total by remember { mutableIntStateOf(0) }
    var pages by remember { mutableIntStateOf(1) }
    var ui by remember { mutableStateOf<UiState<Unit>>(UiState.Loading) }
    var loadingMore by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }

    val boxIdKey = boxId

    fun loadFirst() {
        page = 1
        ui = UiState.Loading
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val resp = Api.get<MovementsResponse>(movementQuery(boxIdKey, 1))
                items = resp.items
                total = resp.total
                pages = resp.pages
                ui = UiState.Data(Unit)
            } catch (e: Exception) {
                ui = UiState.Error(humanMessage(e))
            }
        }
    }

    remember { loadFirst() }

    fun loadMore() {
        if (loadingMore || page >= pages) return
        loadingMore = true
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val resp = Api.get<MovementsResponse>(movementQuery(boxIdKey, page + 1))
                items = items + resp.items
                page = page + 1
            } catch (_: Exception) {
            }
            loadingMore = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (boxId.isBlank()) "Historie" else "Historie krabice") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět") }
                },
            )
        },
    ) { padding ->
        when (val s = ui) {
            is UiState.Loading -> LoadingBox()
            is UiState.Error -> ErrorBox(s.message, onRetry = { attempt++; loadFirst() })
            is UiState.Data -> {
                if (items.isEmpty()) {
                    EmptyBox("Žádné záznamy.")
                } else {
                    LazyColumn(
                        Modifier.fillMaxSize().padding(padding),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        items(items, key = { it.id }) { m ->
                            ListItem(
                                headlineContent = {
                                    Text(m.actionLabel ?: m.action)
                                },
                                supportingContent = {
                                    Column {
                                        val detail = movementDetail(m)
                                        if (detail.isNotBlank()) Text(detail)
                                        val who = if (boxId.isBlank()) (m.boxName ?: "Krabice") else ""
                                        Text(
                                            listOf(who, m.username ?: "").filter { it.isNotBlank() }.joinToString(" • ") +
                                                " • ${Fmt.date(m.createdAt)}",
                                        )
                                    }
                                },
                                leadingContent = {
                                    Icon(
                                        Icons.Filled.History,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                    )
                                },
                            )
                        }
                        if (pages > page) {
                            item {
                                Button(
                                    onClick = { loadMore() },
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                                    enabled = !loadingMore,
                                ) {
                                    Text(if (loadingMore) "Načítám…" else "Načíst další")
                                }
                            }
                        }
                        item {
                            Text(
                                "Celkem: $total záznamů",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun movementQuery(boxId: String, page: Int): String {
    val sb = StringBuilder("/api/movements?page=$page&limit=50")
    if (boxId.isNotBlank()) sb.append("&box_id=").append(java.net.URLEncoder.encode(boxId, "UTF-8"))
    return sb.toString()
}

private fun movementDetail(m: Movement): String {
    val d = m.detail
    fun g(key: String): String =
        (d[key] as? JsonPrimitive)?.let { if (it.isString) it.content else it.content } ?: ""
    return when (m.action) {
        "quantity_added" -> "${g("item")} +${g("quantity")} ${g("unit")}".trim()
        "quantity_removed" -> "${g("item")} −${g("quantity")} ${g("unit")}".trim()
        "item_added" -> "${g("item")} (${g("quantity")} ${g("unit")})".trim()
        "created" -> listOf(g("name"), g("position")).filter { it.isNotBlank() }.joinToString(" ")
        "position_changed" -> g("position")
        "moved" -> g("location")
        else -> ""
    }
}
