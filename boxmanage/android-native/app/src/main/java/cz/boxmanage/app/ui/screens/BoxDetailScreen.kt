package cz.boxmanage.app.ui.screens

import android.content.ContentValues
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExposurePlus1
import androidx.compose.material.icons.filled.Flare
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.RemoveCircleOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.ApiException
import cz.boxmanage.app.data.BoxDetail
import cz.boxmanage.app.data.BoxSummary
import cz.boxmanage.app.data.BoxesResponse
import cz.boxmanage.app.data.ChildBox
import cz.boxmanage.app.data.Item
import cz.boxmanage.app.data.Location
import cz.boxmanage.app.data.OkResponse
import cz.boxmanage.app.data.SettingsResponse
import cz.boxmanage.app.data.Store
import cz.boxmanage.app.ui.EmptyBox
import cz.boxmanage.app.ui.ErrorBox
import cz.boxmanage.app.ui.LoadingBox
import cz.boxmanage.app.ui.UiState
import cz.boxmanage.app.ui.humanMessage
import cz.boxmanage.app.ui.loadUiState
import cz.boxmanage.app.util.Actions
import cz.boxmanage.app.util.Fmt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.Request

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun BoxDetailScreen(
    boxId: String,
    onBack: () -> Unit,
    onOpenMovements: (String) -> Unit,
    onOpenBox: (String) -> Unit = {},
    itemId: String = "",
) {
    var reload by remember { mutableIntStateOf(0) }
    val boxResult = loadUiState("box_$boxId#$reload") { Api.get<BoxDetail>("/api/boxes/$boxId") }
    val locResult = loadUiState("locs") { Api.get<List<Location>>("/api/locations") }
    val settingsResult = loadUiState("settings") { Api.get<SettingsResponse>("/api/settings") }
    val locations = (locResult.state as? UiState.Data)?.value ?: emptyList()
    val showItemQr = (settingsResult.state as? UiState.Data)?.value?.labels?.showItemQr ?: true
    val listState = rememberLazyListState()

    var editBox by remember { mutableStateOf(false) }
    var positionDialog by remember { mutableStateOf(false) }
    var moveDialog by remember { mutableStateOf(false) }
    var addItem by remember { mutableStateOf(false) }
    var addChildDialog by remember { mutableStateOf(false) }
    var newChildName by remember { mutableStateOf("") }
    var moveIntoDialog by remember { mutableStateOf(false) }
    var boxOptions by remember { mutableStateOf<List<BoxSummary>>(emptyList()) }
    var targetParent by remember { mutableStateOf<String?>(null) }
    var qtyDialog by remember { mutableStateOf<QtyDialog?>(null) }
    var editItem by remember { mutableStateOf<Item?>(null) }
    var labelItem by remember { mutableStateOf<Item?>(null) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var findMsg by remember { mutableStateOf<String?>(null) }

    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(boxResult.state, itemId) {
        val box = (boxResult.state as? UiState.Data)?.value ?: return@LaunchedEffect
        if (itemId.isNotEmpty()) {
            val idx = box.items.indexOfFirst { it.id.toString() == itemId }
            if (idx >= 0) listState.scrollToItem(4 + box.children.size + idx)
        }
    }

    fun reloadBox() {
        reload++
    }

    fun runAction(block: suspend () -> Unit) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                block()
                scope.launch { snackbar.showSnackbar("Hotovo.") }
            } catch (e: Exception) {
                val msg = humanMessage(e)
                scope.launch { snackbar.showSnackbar(msg) }
            }
            reloadBox()
        }
    }

    fun saveLabelToGallery(item: Item) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = Api.baseUrl() + "/api/items/${item.id}/label.png?t=${Store.state.value.token}"
                val resp = Api.client.newCall(Request.Builder().url(url).build()).execute()
                if (!resp.isSuccessful) throw ApiException(resp.code, "Chyba při stahování štítku (HTTP ${resp.code})")
                val bytes = resp.body?.bytes() ?: error("Prázdná odpověď")
                val name = "${item.name}-label.png".replace(Regex("[^A-Za-z0-9._-]"), "_")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, name)
                        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/BoxManage")
                    }
                    val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        ?: error("Nelze uložit obrázek")
                    context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                } else {
                    @Suppress("DEPRECATION")
                    MediaStore.Images.Media.insertImage(
                        context.contentResolver,
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size),
                        name,
                        "BoxManage",
                    )
                }
                scope.launch { snackbar.showSnackbar("Štítek uložen do galerie.") }
            } catch (e: Exception) {
                scope.launch { snackbar.showSnackbar(humanMessage(e)) }
            }
        }
    }

    fun addChildBox() {
        val name = newChildName.trim()
        if (name.isEmpty()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val created = Api.post<BoxDetail>(
                    "/api/boxes",
                    buildJsonObject {
                        put("name", name)
                        put("parentId", boxId)
                    },
                )
                addChildDialog = false
                newChildName = ""
                withContext(Dispatchers.Main) { onOpenBox(created.id) }
            } catch (e: Exception) {
                scope.launch { snackbar.showSnackbar(humanMessage(e)) }
            }
        }
    }

    fun openMoveInto() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val r = Api.get<BoxesResponse>("/api/boxes?limit=100")
                boxOptions = r.items.filter { it.id != boxId }
                targetParent = null
                moveIntoDialog = true
            } catch (e: Exception) {
                scope.launch { snackbar.showSnackbar(humanMessage(e)) }
            }
        }
    }

    fun confirmMoveInto() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Api.post<OkResponse>(
                    "/api/boxes/$boxId/into",
                    buildJsonObject {
                        if (targetParent != null) put("parentId", targetParent!!) else put("parentId", JsonNull)
                    },
                )
                moveIntoDialog = false
                reloadBox()
            } catch (e: Exception) {
                scope.launch { snackbar.showSnackbar(humanMessage(e)) }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        (boxResult.state as? UiState.Data)?.value?.name ?: "Krabice",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět") }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when (val s = boxResult.state) {
            is UiState.Loading -> LoadingBox()
            is UiState.Error -> ErrorBox(s.message, boxResult.retry)
            is UiState.Data -> {
                val box = s.value
                LazyColumn(
                    Modifier.fillMaxSize().padding(padding),
                    state = listState,
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        horizontal = 16.dp,
                        vertical = 8.dp,
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.Inventory2,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                    )
                                    Text(
                                        "  ${box.name}",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                if (box.position.isNotBlank()) {
                                    Text(
                                        "Pozice: ${box.position}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                                if (box.parentId != null) {
                                    TextButton(
                                        onClick = { onOpenBox(box.parentId) },
                                        modifier = Modifier.padding(top = 2.dp),
                                    ) {
                                        Icon(Icons.Default.Inventory2, null, Modifier.size(16.dp))
                                        Text("  Uvnitř: ${box.parentName ?: ""}")
                                    }
                                }
                                if (box.locationName != null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Default.LocationOn,
                                            null,
                                            Modifier.size(16.dp),
                                            tint = MaterialTheme.colorScheme.outline,
                                        )
                                        Text(
                                            " ${box.locationName}",
                                            style = MaterialTheme.typography.bodyMedium,
                                        )
                                    }
                                }
                                if (box.description.isNotBlank()) {
                                    Text(
                                        box.description,
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                                if (box.photos.isNotEmpty()) {
                                    Row(
                                        Modifier.padding(top = 8.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        box.photos.take(4).forEach { p ->
                                            AsyncImage(
                                                model = Api.photoUrl(p.filename),
                                                contentDescription = null,
                                                modifier = Modifier.size(72.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    findMsg = null
                                    CoroutineScope(Dispatchers.IO).launch {
                                        try {
                                            val r = Api.post<FindResult>("/api/boxes/$boxId/find")
                                            findMsg = "Světlo \"${r.entity}\" (${r.location}) bliká – jdi tam!"
                                        } catch (e: Exception) {
                                            findMsg = humanMessage(e)
                                        }
                                    }
                                },
                            ) {
                                Icon(Icons.Default.Flare, null, Modifier.size(18.dp))
                                Text("  Najít")
                            }
                        }
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 4.dp),
                        ) {
                            OutlinedButton(onClick = { editBox = true }) { Text("Upravit") }
                            OutlinedButton(onClick = { positionDialog = true }) { Text("Pozice") }
                            OutlinedButton(onClick = { moveDialog = true }) { Text("Lokace") }
                            OutlinedButton(onClick = { openMoveInto() }) { Text("Do krabice") }
                            OutlinedButton(onClick = { deleteConfirm = true }) {
                                Icon(Icons.Default.Delete, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error)
                            }
                        }
                        findMsg?.let {
                            Text(
                                it,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Krabice uvnitř", style = MaterialTheme.typography.titleMedium)
                            TextButton(onClick = {
                                newChildName = ""
                                addChildDialog = true
                            }) {
                                Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                                Text("  Přidat")
                            }
                        }
                    }
                    if (box.children.isEmpty()) {
                        item {
                            Text(
                                "Žádné vnořené krabice. Vnitřní krabice má vlastní QR štítek, fotky i položky.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 4.dp),
                            )
                        }
                    } else {
                        items(box.children, key = { it.id }) { c ->
                            ChildBoxRow(child = c, onClick = { onOpenBox(c.id) })
                        }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Položky", style = MaterialTheme.typography.titleMedium)
                            TextButton(onClick = { addItem = true }) {
                                Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                                Text("  Přidat")
                            }
                        }
                    }
                    if (box.items.isEmpty()) {
                        item { EmptyBox("Krabice nemá žádné položky.", Modifier.height(80.dp)) }
                    } else {
                        items(box.items, key = { it.id }) { item ->
                            ItemRow(
                                item = item,
                                highlight = item.id.toString() == itemId,
                                showLabel = showItemQr,
                                onLabel = { labelItem = item },
                                onAdd = { qtyDialog = QtyDialog(item.id, item.name, "add") },
                                onRemove = { qtyDialog = QtyDialog(item.id, item.name, "remove") },
                                onEdit = { editItem = item },
                                onDelete = {
                                    runAction { Api.delete<OkResponse>("/api/items/${item.id}") }
                                },
                            )
                        }
                    }
                    item {
                        Text(
                            "Historie",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                    }
                    if (box.movements.isEmpty()) {
                        item { EmptyBox("Zatím žádná historie.", Modifier.height(80.dp)) }
                    } else {
                        items(box.movements.take(10)) { m ->
                            ListItem(
                                headlineContent = { Text(Actions.label(m.action)) },
                                supportingContent = {
                                    Text("${m.username ?: ""} • ${Fmt.date(m.createdAt)}")
                                },
                                leadingContent = {
                                    Icon(Icons.Filled.History, null, tint = MaterialTheme.colorScheme.primary)
                                },
                            )
                        }
                        item {
                            TextButton(onClick = { onOpenMovements(boxId) }) {
                                Text("Zobrazit celou historii")
                            }
                        }
                    }
                }
            }
        }
    }

    if (editBox && boxResult.state is UiState.Data) {
        EditBoxDialog(
            box = (boxResult.state as UiState.Data).value,
            onDismiss = { editBox = false },
            onSave = { name, desc, pos ->
                runAction {
                    Api.patch<OkResponse>(
                        "/api/boxes/$boxId",
                        buildJsonObject {
                            put("name", name)
                            put("description", desc)
                            put("position", pos)
                        },
                    )
                }
                editBox = false
            },
        )
    }
    if (positionDialog) {
        PositionDialog(
            onDismiss = { positionDialog = false },
            onSave = { pos ->
                runAction {
                    Api.post<OkResponse>(
                        "/api/boxes/$boxId/position",
                        buildJsonObject { put("position", pos) },
                    )
                }
                positionDialog = false
            },
        )
    }
    if (moveDialog) {
        MoveLocationDialog(
            locations = locations,
            onDismiss = { moveDialog = false },
            onSave = { locId ->
                runAction {
                    Api.post<OkResponse>(
                        "/api/boxes/$boxId/move",
                        buildJsonObject { put("locationId", locId) },
                    )
                }
                moveDialog = false
            },
        )
    }
    if (addItem) {
        AddItemDialog(
            onDismiss = { addItem = false },
            onSave = { name, qty, unit, alert ->
                runAction {
                    Api.post<OkResponse>(
                        "/api/boxes/$boxId/items",
                        buildJsonObject {
                            put("name", name)
                            put("quantity", qty)
                            put("unit", unit)
                            put("alertEnabled", alert)
                        },
                    )
                }
                addItem = false
            },
        )
    }
    qtyDialog?.let { d ->
        QtyDialogBox(
            d = d,
            onDismiss = { qtyDialog = null },
            onConfirm = { qty ->
                runAction {
                    Api.post<OkResponse>(
                        "/api/items/${d.itemId}/${d.action}",
                        buildJsonObject { put("quantity", qty) },
                    )
                }
                qtyDialog = null
            },
        )
    }
    editItem?.let { item ->
        EditItemDialog(
            item = item,
            onDismiss = { editItem = null },
            onSave = { name, qty, unit, alert, threshold ->
                runAction {
                    Api.patch<OkResponse>(
                        "/api/items/${item.id}",
                        buildJsonObject {
                            put("name", name)
                            put("quantity", qty)
                            put("unit", unit)
                            put("alertEnabled", alert)
                            put("alertThreshold", threshold)
                        },
                    )
                }
                editItem = null
            },
        )
    }
    labelItem?.let { item ->
        ItemLabelDialog(
            item = item,
            onDismiss = { labelItem = null },
            onSave = {
                labelItem = null
                saveLabelToGallery(item)
            },
        )
    }
    if (addChildDialog) {
        AlertDialog(
            onDismissRequest = { addChildDialog = false },
            title = { Text("Nová krabice uvnitř") },
            text = {
                OutlinedTextField(
                    value = newChildName,
                    onValueChange = { newChildName = it },
                    label = { Text("Název krabice") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = { addChildBox() }, enabled = newChildName.isNotBlank()) { Text("Vytvořit") }
            },
            dismissButton = { TextButton(onClick = { addChildDialog = false }) { Text("Zrušit") } },
        )
    }
    if (moveIntoDialog) {
        AlertDialog(
            onDismissRequest = { moveIntoDialog = false },
            title = { Text("Přesunout do krabice") },
            text = {
                Column {
                    Text(
                        "Cílová krabice — nebo „na úroveň“ pro vyndání ven.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    LazyColumn(Modifier.height(300.dp).padding(top = 4.dp)) {
                        item {
                            ListItem(
                                modifier = Modifier.fillMaxWidth().clickable { targetParent = null },
                                headlineContent = { Text("— na úroveň —") },
                                leadingContent = {
                                    Icon(Icons.Default.Inventory2, null, tint = MaterialTheme.colorScheme.outline)
                                },
                            )
                        }
                        items(boxOptions) { b ->
                            ListItem(
                                modifier = Modifier.fillMaxWidth().clickable { targetParent = b.id },
                                headlineContent = { Text(b.name) },
                                supportingContent = {
                                    b.parentName?.takeIf { it.isNotBlank() }?.let { Text("uvnitř $it") }
                                },
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { confirmMoveInto() }) { Text("Přesunout") }
            },
            dismissButton = { TextButton(onClick = { moveIntoDialog = false }) { Text("Zrušit") } },
        )
    }
    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Smazat krabici?") },            text = { Text("Krabice i její položky budou trvale smazány.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteConfirm = false
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            Api.delete<OkResponse>("/api/boxes/$boxId")
                        } catch (_: Exception) {
                        }
                        onBack()
                    }
                }) { Text("Smazat") }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirm = false }) { Text("Zrušit") }
            },
        )
    }
}

private class QtyDialog(val itemId: Long, val itemName: String, val action: String)

@Composable
private fun ItemRow(
    item: Item,
    highlight: Boolean,
    showLabel: Boolean,
    onLabel: () -> Unit,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth().then(
            if (highlight) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.medium)
            else Modifier,
        ),
        colors = if (highlight) {
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f).padding(start = 8.dp)) {
                Text(item.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(
                    "${Fmt.qty(item.quantity)} ${item.unit}".trim(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (item.alertEnabled != 0) {
                    Text(
                        "Alarm nízké zásoby",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                }
            }
            IconButton(onClick = onRemove) { Icon(Icons.Default.RemoveCircleOutline, "Odebrat") }
            Text(
                Fmt.qty(item.quantity),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            IconButton(onClick = onAdd) { Icon(Icons.Default.ExposurePlus1, "Přidat") }
            IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Upravit", Modifier.size(18.dp)) }
            if (showLabel) {
                IconButton(onClick = onLabel) {
                    Icon(Icons.Default.QrCode, "QR štítek", Modifier.size(18.dp))
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, "Smazat", Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun ChildBoxRow(
    child: ChildBox,
    onClick: () -> Unit,
) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (child.photo != null) {
                AsyncImage(
                    model = Api.photoUrl(child.photo),
                    contentDescription = null,
                    modifier = Modifier.size(44.dp),
                )
            } else {
                Icon(
                    Icons.Default.Inventory2,
                    null,
                    Modifier.size(40.dp),
                    tint = MaterialTheme.colorScheme.outline,
                )
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(
                    child.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(
                        child.position.takeIf { it.isNotBlank() }?.let { "Pozice: $it" },
                        "${child.itemCount} položek",
                    ).filterNotNull().joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(Icons.Filled.ChevronRight, null, tint = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
private fun ItemLabelDialog(
    item: Item,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    val url = Api.baseUrl() + "/api/items/${item.id}/label.png?t=${Store.state.value.token}"
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("QR štítek položky") },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                AsyncImage(
                    model = url,
                    contentDescription = "QR štítek ${item.name}",
                    modifier = Modifier.size(260.dp),
                )
                Text(
                    item.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onSave) { Text("Uložit do galerie") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zavřít") } },
    )
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun MoveLocationDialog(
    locations: List<Location>,
    onDismiss: () -> Unit,
    onSave: (Long?) -> Unit,
) {
    var selected by remember { mutableStateOf<Long?>(null) }
    var expanded by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Změnit lokaci") },
        text = {
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                OutlinedTextField(
                    value = locations.firstOrNull { it.id == selected }?.name ?: "Bez lokace",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Lokace") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryEditable, enabled = true).fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    DropdownMenuItem(text = { Text("Bez lokace") }, onClick = {
                        selected = null
                        expanded = false
                    })
                    locations.forEach { loc ->
                        DropdownMenuItem(text = { Text(loc.name) }, onClick = {
                            selected = loc.id
                            expanded = false
                        })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(selected) }) { Text("Uložit") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Zrušit") }
        },
    )
}

@Composable
private fun PositionDialog(
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var pos by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Změnit pozici") },
        text = {
            OutlinedTextField(
                value = pos,
                onValueChange = { pos = it.uppercase() },
                label = { Text("Pozice (např. A3)") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = { onSave(pos.trim()) }, enabled = pos.isNotBlank()) { Text("Uložit") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

@Composable
private fun EditBoxDialog(
    box: BoxDetail,
    onDismiss: () -> Unit,
    onSave: (name: String, desc: String, pos: String) -> Unit,
) {
    var name by rememberSaveable(box.id) { mutableStateOf(box.name) }
    var desc by rememberSaveable(box.id) { mutableStateOf(box.description) }
    var pos by rememberSaveable(box.id) { mutableStateOf(box.position) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Upravit krabici") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Název") }, singleLine = true)
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Popis") })
                OutlinedTextField(value = pos, onValueChange = { pos = it.uppercase() }, label = { Text("Pozice") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name.trim(), desc, pos.trim()) }, enabled = name.isNotBlank()) {
                Text("Uložit")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

@Composable
private fun AddItemDialog(
    onDismiss: () -> Unit,
    onSave: (name: String, qty: Double, unit: String, alert: Boolean) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf("") }
    var qty by rememberSaveable { mutableStateOf("1") }
    var unit by rememberSaveable { mutableStateOf("ks") }
    var alert by rememberSaveable { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nová položka") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Název") }, singleLine = true)
                OutlinedTextField(
                    value = qty,
                    onValueChange = { qty = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text("Množství") },
                    singleLine = true,
                )
                OutlinedTextField(value = unit, onValueChange = { unit = it }, label = { Text("Jednotka") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Upozornit na nízkou zásobu", modifier = Modifier.weight(1f))
                    Checkbox(checked = alert, onCheckedChange = { alert = it })
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), parseQty(qty), unit.trim(), alert) },
                enabled = name.isNotBlank(),
            ) { Text("Přidat") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

@Composable
private fun EditItemDialog(
    item: Item,
    onDismiss: () -> Unit,
    onSave: (name: String, qty: Double, unit: String, alert: Boolean, threshold: Double?) -> Unit,
) {
    var name by rememberSaveable(item.id) { mutableStateOf(item.name) }
    var qty by rememberSaveable(item.id) { mutableStateOf(Fmt.qty(item.quantity)) }
    var unit by rememberSaveable(item.id) { mutableStateOf(item.unit) }
    var alert by rememberSaveable(item.id) { mutableStateOf(item.alertEnabled != 0) }
    var threshold by rememberSaveable(item.id) {
        mutableStateOf(item.alertThreshold?.let { Fmt.qty(it) } ?: "")
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Upravit položku") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Název") }, singleLine = true)
                OutlinedTextField(
                    value = qty,
                    onValueChange = { qty = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text("Množství") },
                    singleLine = true,
                )
                OutlinedTextField(value = unit, onValueChange = { unit = it }, label = { Text("Jednotka") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Upozornit na nízkou zásobu", modifier = Modifier.weight(1f))
                    Checkbox(checked = alert, onCheckedChange = { alert = it })
                }
                if (alert) {
                    OutlinedTextField(
                        value = threshold,
                        onValueChange = { threshold = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Limit") },
                        singleLine = true,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        name.trim(),
                        parseQty(qty),
                        unit.trim(),
                        alert,
                        threshold.trim().takeIf { it.isNotEmpty() }?.let { parseQty(it) },
                    )
                },
                enabled = name.isNotBlank(),
            ) { Text("Uložit") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

@Composable
private fun QtyDialogBox(
    d: QtyDialog,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit,
) {
    var qty by rememberSaveable(d.itemId) { mutableStateOf("1") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (d.action == "add") "Přidat množství" else "Odebrat množství") },
        text = {
            Column {
                Text(d.itemName, style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = qty,
                    onValueChange = { qty = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text("Množství") },
                    singleLine = true,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(parseQty(qty)) }, enabled = parseQty(qty) > 0) {
                Text(if (d.action == "add") "Přidat" else "Odebrat")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Zrušit") } },
    )
}

private fun parseQty(s: String): Double = s.trim().replace(',', '.').toDoubleOrNull() ?: 0.0

@kotlinx.serialization.Serializable
private data class FindResult(
    val ok: Int = 0,
    val entity: String = "",
    val location: String = "",
)
