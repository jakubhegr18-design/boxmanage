package cz.boxmanage.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.Stats
import cz.boxmanage.app.ui.EmptyBox
import cz.boxmanage.app.ui.ErrorBox
import cz.boxmanage.app.ui.LoadingBox
import cz.boxmanage.app.ui.loadUiState
import cz.boxmanage.app.util.Actions
import cz.boxmanage.app.util.Fmt

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onOpenBox: (String) -> Unit,
    onOpenMovements: (String?) -> Unit,
) {
    val result = loadUiState(null) { Api.get<Stats>("/api/stats") }

    Scaffold(
        topBar = { TopAppBar(title = { Text("BoxManage") }) },
    ) { padding ->
        when (val state = result.state) {
            is cz.boxmanage.app.ui.UiState.Loading -> LoadingBox()
            is cz.boxmanage.app.ui.UiState.Error -> ErrorBox(state.message, result.retry)
            is cz.boxmanage.app.ui.UiState.Data -> {
                val stats = state.value
                LazyColumn(
                    Modifier.fillMaxSize().padding(padding).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatCard("Krabice", stats.boxes.toString(), Modifier.weight(1f))
                            StatCard("Lokace", stats.locations.toString(), Modifier.weight(1f))
                            StatCard("Položky", stats.items.toString(), Modifier.weight(1f))
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatCard("Kusů celkem", Fmt.qty(stats.itemTotal), Modifier.weight(1f))
                            StatCard("Uživatelé", stats.users.toString(), Modifier.weight(1f))
                            Spacer(Modifier.weight(1f))
                        }
                    }
                    item {
                        Text(
                            "Poslední aktivita",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                    if (stats.recent.isEmpty()) {
                        item { EmptyBox("Zatím žádná aktivita.", Modifier.height(120.dp)) }
                    } else {
                        items(stats.recent.take(10)) { m ->
                            Card(Modifier.fillMaxWidth()) {
                                ListItem(
                                    headlineContent = { Text(m.boxName ?: "Krabice", fontWeight = FontWeight.Medium) },
                                    supportingContent = {
                                        Text(
                                            "${Actions.label(m.action)} • ${m.username ?: ""} • ${Fmt.date(m.createdAt)}",
                                        )
                                    },
                                    leadingContent = {
                                        Icon(
                                            Icons.Filled.History,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                        )
                                    },
                                )
                            }
                        }
                    }
                    if (stats.recent.isNotEmpty()) {
                        item {
                            androidx.compose.material3.TextButton(onClick = { onOpenMovements(null) }) {
                                Text("Zobrazit celou historii")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodySmall)
        }
    }
}
