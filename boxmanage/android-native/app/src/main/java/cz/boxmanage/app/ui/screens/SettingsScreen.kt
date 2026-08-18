package cz.boxmanage.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.OkResponse
import cz.boxmanage.app.data.Store
import cz.boxmanage.app.ui.humanMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onOpenRemote: () -> Unit) {
    val state by Store.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var serverDialog by remember { mutableStateOf(false) }
    var passwordDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Více") }) },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Card(Modifier.fillMaxWidth().padding(16.dp)) {
                ListItem(
                    headlineContent = { Text(state.username.ifEmpty { "—" }, fontWeight = FontWeight.Bold) },
                    supportingContent = {
                        Text("Role: ${state.role.ifEmpty { "—" }}")
                    },
                    leadingContent = {
                        Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                    },
                )
            }

            Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Column {
                    ListItem(
                        headlineContent = { Text("Dálkový skener") },
                        supportingContent = { Text("Vytvořit QR kód a sledovat naskenované krabice.") },
                        leadingContent = {
                            Icon(Icons.Filled.QrCode, null, tint = MaterialTheme.colorScheme.primary)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    TextButton(onClick = onOpenRemote, modifier = Modifier.align(Alignment.End).padding(end = 8.dp)) {
                        Text("Otevřít")
                    }
                }
            }

            Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Column {
                    ListItem(
                        headlineContent = { Text("Adresa serveru") },
                        supportingContent = { Text(state.serverUrl) },
                        leadingContent = {
                            Icon(Icons.Default.Link, null, tint = MaterialTheme.colorScheme.primary)
                        },
                    )
                    TextButton(onClick = { serverDialog = true }, modifier = Modifier.align(Alignment.End).padding(end = 8.dp)) {
                        Text("Změnit")
                    }
                }
            }

            Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Column {
                    ListItem(
                        headlineContent = { Text("Změnit heslo") },
                        leadingContent = {
                            Icon(Icons.Default.Lock, null, tint = MaterialTheme.colorScheme.primary)
                        },
                    )
                    TextButton(onClick = { passwordDialog = true }, modifier = Modifier.align(Alignment.End).padding(end = 8.dp)) {
                        Text("Změnit")
                    }
                }
            }

            Card(Modifier.fillMaxWidth().padding(16.dp)) {
                Column {
                    ListItem(
                        headlineContent = { Text("Odhlásit se") },
                        leadingContent = {
                            Icon(Icons.Default.Logout, null, tint = MaterialTheme.colorScheme.error)
                        },
                    )
                    TextButton(onClick = {
                        CoroutineScope(Dispatchers.IO).launch { Store.clearSession() }
                    }, modifier = Modifier.align(Alignment.End).padding(end = 8.dp)) {
                        Text("Odhlásit", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }

    if (serverDialog) {
        ServerEditDialog(
            initial = state.serverUrl,
            onDismiss = { serverDialog = false },
            onSave = { url ->
                CoroutineScope(Dispatchers.IO).launch {
                    Store.setServerUrl(url)
                    scope.launch { snackbar.showSnackbar("Adresa serveru uložena.") }
                }
                serverDialog = false
            },
        )
    }
    if (passwordDialog) {
        PasswordDialog(
            onDismiss = { passwordDialog = false },
            onSave = { current, new ->
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        Api.patch<OkResponse>(
                            "/api/auth/password",
                            buildJsonObject {
                                put("currentPassword", current)
                                put("newPassword", new)
                            },
                        )
                        scope.launch { snackbar.showSnackbar("Heslo změněno.") }
                    } catch (e: Exception) {
                        scope.launch { snackbar.showSnackbar(humanMessage(e)) }
                    }
                }
                passwordDialog = false
            },
        )
    }
}

@Composable
private fun ServerEditDialog(
    initial: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var url by rememberSaveable { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adresa serveru") },
        text = {
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("https://host:8090") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = { onSave(url) }, enabled = url.isNotBlank()) { Text("Uložit") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

@Composable
private fun PasswordDialog(
    onDismiss: () -> Unit,
    onSave: (current: String, new: String) -> Unit,
) {
    var current by rememberSaveable { mutableStateOf("") }
    var newPw by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Změnit heslo") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = current,
                    onValueChange = { current = it },
                    label = { Text("Současné heslo") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = newPw,
                    onValueChange = { newPw = it },
                    label = { Text("Nové heslo") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(current, newPw) },
                enabled = current.isNotBlank() && newPw.isNotBlank(),
            ) { Text("Uložit") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}
