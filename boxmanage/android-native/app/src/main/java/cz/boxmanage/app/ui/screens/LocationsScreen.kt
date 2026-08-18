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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flare
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.Location
import cz.boxmanage.app.data.OkResponse
import cz.boxmanage.app.ui.EmptyBox
import cz.boxmanage.app.ui.ErrorBox
import cz.boxmanage.app.ui.LoadingBox
import cz.boxmanage.app.ui.UiState
import cz.boxmanage.app.ui.humanMessage
import cz.boxmanage.app.ui.loadUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun LocationsScreen() {
    var reload by remember { mutableIntStateOf(0) }
    val result = loadUiState("locs_$reload") { Api.get<List<Location>>("/api/locations") }

    var addDialog by remember { mutableStateOf(false) }
    var editLocation by remember { mutableStateOf<Location?>(null) }
    var deleteLocation by remember { mutableStateOf<Location?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Lokace") },
                actions = {
                    IconButton(onClick = { addDialog = true }) {
                        Icon(Icons.Default.Add, "Přidat lokaci")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when (val s = result.state) {
            is UiState.Loading -> LoadingBox()
            is UiState.Error -> ErrorBox(s.message, result.retry)
            is UiState.Data -> {
                if (s.value.isEmpty()) {
                    EmptyBox("Žádné lokace. Přidejte první přes ikonu +.")
                } else {
                    LazyColumn(
                        Modifier.fillMaxSize().padding(padding),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            horizontal = 16.dp,
                            vertical = 8.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(s.value, key = { it.id }) { loc ->
                            Card(Modifier.fillMaxWidth()) {
                                ListItem(
                                    headlineContent = { Text(loc.name) },
                                    supportingContent = {
                                        Column {
                                            if (loc.description.isNotBlank()) Text(loc.description)
                                            Text(
                                                "${loc.boxCount} krabic" +
                                                    if (loc.lightEntity.isNotBlank()) " • světlo: ${loc.lightEntity}" else "",
                                            )
                                        }
                                    },
                                    leadingContent = {
                                        Icon(
                                            Icons.Default.Inventory2,
                                            null,
                                            tint = MaterialTheme.colorScheme.primary,
                                        )
                                    },
                                    trailingContent = {
                                        Row {
                                            if (loc.lightEntity.isNotBlank()) {
                                                IconButton(onClick = {
                                                    CoroutineScope(Dispatchers.IO).launch {
                                                        try {
                                                            Api.post<OkResponse>("/api/locations/${loc.id}/find")
                                                            scope.launch {
                                                                snackbar.showSnackbar("Světlo \"${loc.lightEntity}\" bliká.")
                                                            }
                                                        } catch (e: Exception) {
                                                            scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                                                        }
                                                    }
                                                }) {
                                                    Icon(
                                                        Icons.Default.Flare,
                                                        "Najít",
                                                        Modifier.size(20.dp),
                                                        tint = MaterialTheme.colorScheme.primary,
                                                    )
                                                }
                                            }
                                            IconButton(onClick = { editLocation = loc }) {
                                                Icon(Icons.Default.Edit, "Upravit", Modifier.size(20.dp))
                                            }
                                            IconButton(onClick = { deleteLocation = loc }) {
                                                Icon(
                                                    Icons.Default.Delete,
                                                    "Smazat",
                                                    Modifier.size(20.dp),
                                                    tint = MaterialTheme.colorScheme.error,
                                                )
                                            }
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

    if (addDialog) {
        LocationEditDialog(
            title = "Nová lokace",
            onDismiss = { addDialog = false },
            onSave = { name, desc, light ->
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        Api.post<OkResponse>(
                            "/api/locations",
                            buildJsonObject {
                                put("name", name)
                                put("description", desc)
                                put("lightEntity", light)
                            },
                        )
                        scope.launch { snackbar.showSnackbar("Lokace vytvořena.") }
                    } catch (e: Exception) {
                        scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                    }
                    reload++
                }
                addDialog = false
            },
        )
    }
    editLocation?.let { loc ->
        LocationEditDialog(
            title = "Upravit lokaci",
            initialName = loc.name,
            initialDesc = loc.description,
            initialLight = loc.lightEntity,
            onDismiss = { editLocation = null },
            onSave = { name, desc, light ->
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        Api.patch<OkResponse>(
                            "/api/locations/${loc.id}",
                            buildJsonObject {
                                put("name", name)
                                put("description", desc)
                                put("lightEntity", light)
                            },
                        )
                        scope.launch { snackbar.showSnackbar("Lokace uložena.") }
                    } catch (e: Exception) {
                        scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                    }
                    reload++
                }
                editLocation = null
            },
        )
    }
    deleteLocation?.let { loc ->
        AlertDialog(
            onDismissRequest = { deleteLocation = null },
            title = { Text("Smazat lokaci?") },
            text = { Text("Lokace \"${loc.name}\" bude smazána. Krabice v ní zůstanou bez lokace.") },
            confirmButton = {
                TextButton(onClick = {
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            Api.delete<OkResponse>("/api/locations/${loc.id}")
                        } catch (e: Exception) {
                            scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                        }
                        reload++
                    }
                    deleteLocation = null
                }) { Text("Smazat") }
            },
            dismissButton = { TextButton(onClick = { deleteLocation = null }) { Text("Zrušit") } },
        )
    }
}

@Composable
private fun LocationEditDialog(
    title: String,
    initialName: String = "",
    initialDesc: String = "",
    initialLight: String = "",
    onDismiss: () -> Unit,
    onSave: (name: String, desc: String, light: String) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var desc by rememberSaveable { mutableStateOf(initialDesc) }
    var light by rememberSaveable { mutableStateOf(initialLight) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Název") }, singleLine = true)
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Popis") })
                OutlinedTextField(
                    value = light,
                    onValueChange = { light = it },
                    label = { Text("Světlo (entity, např. light.kitchen)") },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name.trim(), desc.trim(), light.trim()) }, enabled = name.isNotBlank()) {
                Text("Uložit")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}
