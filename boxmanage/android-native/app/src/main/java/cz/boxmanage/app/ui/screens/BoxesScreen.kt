package cz.boxmanage.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.BoxSummary
import cz.boxmanage.app.data.BoxesResponse
import cz.boxmanage.app.ui.ErrorBox
import cz.boxmanage.app.ui.LoadingBox
import cz.boxmanage.app.ui.UiState
import cz.boxmanage.app.ui.humanMessage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.net.URLEncoder

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun BoxesScreen(onOpenBox: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var debounced by rememberSaveable { mutableStateOf("") }
    var page by remember { mutableIntStateOf(1) }
    var boxes by remember { mutableStateOf<List<BoxSummary>>(emptyList()) }
    var total by remember { mutableIntStateOf(0) }
    var pages by remember { mutableIntStateOf(1) }
    var ui by remember { mutableStateOf<UiState<Unit>>(UiState.Loading) }
    var loadingMore by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }

    val search by remember { derivedStateOf { query.trim() } }
    LaunchedEffect(search) {
        if (search.isNotBlank()) delay(400)
        debounced = search
    }

    LaunchedEffect(debounced, attempt) {
        page = 1
        ui = UiState.Loading
        try {
            val resp = Api.get<BoxesResponse>(boxQuery(debounced, 1))
            boxes = resp.items
            total = resp.total
            pages = resp.pages
            ui = UiState.Data(Unit)
        } catch (e: Exception) {
            ui = UiState.Error(humanMessage(e))
        }
    }

    fun loadMore() {
        if (loadingMore || page >= pages) return
        loadingMore = true
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val resp = Api.get<BoxesResponse>(boxQuery(debounced, page + 1))
                boxes = boxes + resp.items
                page = page + 1
            } catch (_: Exception) {
            }
            loadingMore = false
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Krabice") }) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                label = { Text("Hledat krabice…") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true,
            )
            when (val s = ui) {
                is UiState.Loading -> LoadingBox()
                is UiState.Error -> ErrorBox(s.message, onRetry = { attempt++ })
                is UiState.Data -> {
                    if (boxes.isEmpty()) {
                        cz.boxmanage.app.ui.EmptyBox("Žádné krabice nenalezeny.")
                    } else {
                        LazyColumn(
                            Modifier.fillMaxSize(),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                                horizontal = 16.dp,
                                vertical = 8.dp,
                            ),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(boxes, key = { it.id }) { box ->
                                BoxCard(box, onClick = { onOpenBox(box.id) })
                            }
                            if (pages > page) {
                                item {
                                    Button(
                                        onClick = { loadMore() },
                                        modifier = Modifier.fillMaxWidth(),
                                        enabled = !loadingMore,
                                    ) {
                                        Text(if (loadingMore) "Načítám…" else "Načíst další")
                                    }
                                }
                            }
                            item {
                                Text(
                                    "Celkem: $total krabic",
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(bottom = 8.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BoxCard(box: BoxSummary, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            if (!box.photo.isNullOrBlank()) {
                AsyncImage(
                    model = Api.photoUrl(box.photo),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(64.dp),
                )
            } else {
                Icon(
                    Icons.Default.Inventory2,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(64.dp).padding(8.dp),
                )
            }
            androidx.compose.foundation.layout.Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(box.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                box.position.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    box.locationName?.let {
                        Icon(Icons.Default.LocationOn, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.outline)
                        Text(" $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                    }
                }
            }
            Text(
                "${box.itemCount}×",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(end = 8.dp),
            )
        }
    }
}

private fun boxQuery(search: String, page: Int): String {
    val sb = StringBuilder("/api/boxes?page=$page&limit=20")
    if (search.isNotBlank()) sb.append("&search=").append(URLEncoder.encode(search, "UTF-8"))
    return sb.toString()
}
