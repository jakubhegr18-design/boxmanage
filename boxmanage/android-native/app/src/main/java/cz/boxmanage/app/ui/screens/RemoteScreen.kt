package cz.boxmanage.app.ui.screens

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.OkResponse
import cz.boxmanage.app.data.RemoteEvent
import cz.boxmanage.app.data.RemoteEventsResponse
import cz.boxmanage.app.data.RemoteSessionCreate
import cz.boxmanage.app.data.Store
import cz.boxmanage.app.ui.EmptyBox
import cz.boxmanage.app.ui.humanMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.sse.EventSource

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun RemoteScreen(onBack: () -> Unit) {
    val storeState by Store.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val sourceRef = remember { mutableStateOf<EventSource?>(null) }

    var creating by remember { mutableStateOf(false) }
    var events by remember { mutableStateOf<List<RemoteEvent>>(emptyList()) }
    var sessionCode by remember { mutableStateOf("") }

    val token = storeState.remoteSessionToken

    fun closeStream() {
        sourceRef.value?.cancel()
        sourceRef.value = null
    }

    fun openStream(sessionToken: String) {
        closeStream()
        sourceRef.value = Api.openSse(
            "/api/remote/$sessionToken/stream",
            onEvent = { data ->
                try {
                    val e = Api.json.decodeFromString<RemoteEvent>(data)
                    if (e.closed) {
                        closeStream()
                    } else if (e.id > 0) {
                        events = (listOf(e) + events).distinctBy { it.id }.take(200)
                    }
                } catch (_: Exception) {
                }
            },
            onClosed = {},
        )
    }

    fun connect(sessionToken: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val resp = Api.get<RemoteEventsResponse>("/api/remote/$sessionToken/events")
                sessionCode = resp.session?.code ?: ""
                events = resp.events
                kotlinx.coroutines.withContext(Dispatchers.Main) { openStream(sessionToken) }
            } catch (e: Exception) {
                scope.launch { snackbar.showSnackbar(humanMessage(e)) }
            }
        }
    }

    LaunchedEffect(token) {
        if (token.isNotEmpty()) connect(token)
    }

    DisposableEffect(Unit) {
        onDispose { sourceRef.value?.cancel() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dálkový skener") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět") }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (token.isEmpty()) {
                Card(Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Tento režim promění telefon v dálkový skener — krabice naskenované z jiného telefonu (v dálkovém režimu) se zde objeví živě.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Button(
                            onClick = {
                                creating = true
                                CoroutineScope(Dispatchers.IO).launch {
                                    try {
                                        val r = Api.post<RemoteSessionCreate>("/api/remote/sessions")
                                        Store.setRemoteSession(r.token, r.code)
                                    } catch (e: Exception) {
                                        scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                                    }
                                    creating = false
                                }
                            },
                            enabled = !creating,
                        ) { Text(if (creating) "Vytvářím…" else "Vytvořit skener") }
                    }
                }
            } else {
                Card(Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(
                        Modifier.fillMaxWidth().padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Kód skeneru", style = MaterialTheme.typography.labelMedium)
                        Text(
                            sessionCode,
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
                        )
                        RemoteQr(serverUrl = storeState.serverUrl, token = token)
                        Text(
                            "Telefon: zapněte dálkový režim a zadejte tento kód (nebo naskenujte QR).",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        TextButton(onClick = {
                            CoroutineScope(Dispatchers.IO).launch {
                                try {
                                    Api.delete<OkResponse>("/api/remote/$token")
                                } catch (_: Exception) {
                                }
                                closeStream()
                                Store.clearRemoteSession()
                                events = emptyList()
                            }
                        }) { Text("Zavřít skener") }
                    }
                }
                Text(
                    "Události",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                if (events.isEmpty()) {
                    EmptyBox("Zatím žádné naskenované krabice.", Modifier.weight(1f))
                } else {
                    LazyColumn(
                        Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        items(events, key = { it.id }) { e ->
                            Card(Modifier.fillMaxWidth()) {
                                ListItem(
                                    headlineContent = {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                Icons.Default.Inventory2,
                                                null,
                                                Modifier.size(18.dp),
                                                tint = MaterialTheme.colorScheme.primary,
                                            )
                                            Text("  ${e.boxName}", fontWeight = FontWeight.Medium)
                                        }
                                    },
                                    supportingContent = {
                                        Column {
                                            if (e.boxPosition.isNotBlank()) Text("Pozice: ${e.boxPosition}")
                                            Text("${e.username} • ${cz.boxmanage.app.util.Fmt.date(e.createdAt)}")
                                        }
                                    },
                                    trailingContent = {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                if (e.resolved != 0) "Hotovo" else "Čeká",
                                                style = MaterialTheme.typography.labelMedium,
                                                color = if (e.resolved != 0) MaterialTheme.colorScheme.primary
                                                else MaterialTheme.colorScheme.outline,
                                            )
                                            Checkbox(
                                                checked = e.resolved != 0,
                                                onCheckedChange = {
                                                    CoroutineScope(Dispatchers.IO).launch {
                                                        try {
                                                            Api.post<OkResponse>("/api/remote/$token/events/${e.id}/resolve")
                                                            events = events.map { it.copy(resolved = 1) }
                                                        } catch (ex: Exception) {
                                                            scope.launch { snackbar.showSnackbar(humanMessage(ex)) }
                                                        }
                                                    }
                                                },
                                            )
                                        }
                                    },
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
private fun RemoteQr(serverUrl: String, token: String) {
    val data = "bm://remote?url=$serverUrl&s=$token"
    val bitmap = remember(data) {
        runCatching {
            val size = 256
            val matrix: BitMatrix = MultiFormatWriter().encode(data, BarcodeFormat.QR_CODE, size, size)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bmp.setPixel(x, y, if (matrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
                }
            }
            bmp
        }.getOrNull()
    }
    if (bitmap != null) {
        Image(bitmap = bitmap.asImageBitmap(), contentDescription = "QR kód pro připojení", modifier = Modifier.size(220.dp))
    }
}
