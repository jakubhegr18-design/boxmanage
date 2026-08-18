package cz.boxmanage.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.ApiException
import cz.boxmanage.app.data.BoxDetail
import cz.boxmanage.app.data.OkResponse
import cz.boxmanage.app.data.RemoteJoinResponse
import cz.boxmanage.app.data.Store
import cz.boxmanage.app.ui.humanMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.net.URLDecoder
import java.net.URLEncoder

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(
    onOpenBox: (String) -> Unit,
    onOpenItem: (String, String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val storeState by Store.state.collectAsState()

    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> hasPermission = granted }

    var manual by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf<String?>(null) }
    var pairCode by rememberSaveable { mutableStateOf("") }
    var notFound by rememberSaveable { mutableStateOf<String?>(null) }
    var createName by rememberSaveable { mutableStateOf("") }
    var lastScan by remember { mutableStateOf(0L) }

    fun openBox(id: String, itemId: String?) {
        val now = System.currentTimeMillis()
        if (now - lastScan < 2000) return
        lastScan = now
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Api.get<BoxDetail>("/api/boxes/${URLEncoder.encode(id, "UTF-8")}")
                val st = Store.state.value
                if (st.remoteMode && st.remoteSessionToken.isNotEmpty()) {
                    try {
                        Api.post<OkResponse>(
                            "/api/boxes/${URLEncoder.encode(id, "UTF-8")}/scan",
                            buildJsonObject { put("session", st.remoteSessionToken) },
                        )
                    } catch (_: Exception) {
                    }
                }
                withContext(Dispatchers.Main) {
                    if (itemId != null) onOpenItem(id, itemId) else onOpenBox(id)
                }
            } catch (e: ApiException) {
                if (e.status == 404) {
                    notFound = id
                    createName = id
                } else {
                    message = humanMessage(e)
                }
            } catch (e: Exception) {
                message = humanMessage(e)
            }
        }
    }

    fun parseQs(raw: String): Map<String, String> {
        return raw.substringAfter("?", "")
            .split("&")
            .mapNotNull {
                val kv = it.split("=", limit = 2)
                if (kv.size == 2) URLDecoder.decode(kv[0], "UTF-8") to URLDecoder.decode(kv[1], "UTF-8") else null
            }
            .toMap()
    }

    fun handlePairing(raw: String) {
        val params = parseQs(raw)
        val url = params["url"]
        if (url.isNullOrBlank()) {
            message = "Neplatný párovací QR kód."
            return
        }
        val s = params["s"] ?: ""
        CoroutineScope(Dispatchers.IO).launch {
            Store.setServerUrl(url)
            Store.setRemoteMode(true)
            if (s.isNotEmpty()) Store.setRemoteSession(s, "")
            message = "Server nastaven na:\n${Store.state.value.serverUrl}\n\nSkenujte krabice."
        }
    }

    fun handleCode(raw: String) {
        val text = raw.trim()
        if (text.startsWith("bm://remote")) {
            handlePairing(text)
            return
        }
        if (text.startsWith("bm://item")) {
            val p = parseQs(text)
            val b = p["b"] ?: return
            val i = p["i"] ?: return
            if (b.isBlank() || i.isBlank()) return
            openBox(b, i)
            return
        }
        val id = if (text.startsWith("bm://")) text.substring(5) else text
        openBox(id, null)
    }

    fun joinScanner() {
        val code = pairCode.trim().uppercase()
        if (code.isEmpty()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val r = Api.post<RemoteJoinResponse>("/api/remote/join", buildJsonObject { put("code", code) })
                Store.setRemoteSession(r.token, r.code)
                Store.setRemoteMode(true)
                message = "Připojeno ke skeneru (kód ${r.code}). Skenované krabice se na PC objeví živě."
                pairCode = ""
            } catch (e: Exception) {
                message = humanMessage(e)
            }
        }
    }

    LaunchedEffect(Unit) {
        if (!hasPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Sken QR kódu") }) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Card(Modifier.fillMaxWidth().height(260.dp)) {
                if (hasPermission) {
                    Box(Modifier.fillMaxSize()) {
                        CameraView(lifecycleOwner, onCode = { handleCode(it) })
                        Text(
                            "Namiř kameru na QR kód na krabici",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            modifier = Modifier.align(Alignment.BottomCenter).padding(8.dp),
                        )
                    }
                } else {
                    Column(
                        Modifier.fillMaxSize().padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text("Pro skenování je potřeba povolit přístup ke kameře.")
                        Button(
                            onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                            modifier = Modifier.padding(top = 8.dp),
                        ) { Text("Povolit kameru") }
                    }
                }
            }

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = manual,
                    onValueChange = { manual = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("ID krabice (bm-…)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    singleLine = true,
                )
                Button(
                    onClick = {
                        if (manual.isNotBlank()) {
                            openBox(manual.trim(), null)
                            manual = ""
                        }
                    },
                    modifier = Modifier.padding(start = 8.dp),
                ) { Text("Otevřít") }
            }

            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Link, null, tint = MaterialTheme.colorScheme.primary)
                        Text("  Dálkový režim", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Switch(
                            checked = storeState.remoteMode,
                            onCheckedChange = {
                                CoroutineScope(Dispatchers.IO).launch { Store.setRemoteMode(it) }
                            },
                        )
                    }
                    Text(
                        "Zapněte, když skenujete na dálku — naskenované krabice se živě objeví na PC (stránka Dálkový skener).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (storeState.remoteSessionToken.isNotEmpty()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.CheckCircle,
                                null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                "  Připojeno ke skeneru" +
                                    (storeState.remoteSessionCode.takeIf { it.isNotEmpty() }?.let { " ($it)" } ?: ""),
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(onClick = {
                                CoroutineScope(Dispatchers.IO).launch { Store.clearRemoteSession() }
                            }) { Text("Odpojit") }
                        }
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = pairCode,
                                onValueChange = { pairCode = it.take(6).uppercase() },
                                modifier = Modifier.weight(1f),
                                label = { Text("Kód ze skeneru (6 znaků)") },
                                singleLine = true,
                            )
                            Button(onClick = { joinScanner() }, modifier = Modifier.padding(start = 8.dp)) {
                                Text("Připojit")
                            }
                        }
                    }
                    Text(
                        "QR kód z Dálkového skeneru nastaví adresu serveru i připojení ke skeneru automaticky.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            message?.let {
                Surface(
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        IconButton(onClick = { message = null }) {
                            Icon(Icons.Default.Close, "Zavřít")
                        }
                    }
                }
            }
        }
    }

    notFound?.let { id ->
        AlertDialog(
            onDismissRequest = { notFound = null },
            title = { Text("Krabice neexistuje") },
            text = {
                Column {
                    Text("Krabice <$id> nebyla nalezena.")
                    OutlinedTextField(
                        value = createName,
                        onValueChange = { createName = it },
                        label = { Text("Název nové krabice") },
                        singleLine = true,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val name = createName.trim()
                    if (name.isNotEmpty()) {
                        CoroutineScope(Dispatchers.IO).launch {
                            try {
                                Api.post<BoxDetail>(
                                    "/api/boxes",
                                    buildJsonObject {
                                        put("name", name)
                                        put("id", id)
                                    },
                                )
                                notFound = null
                                openBox(id, null)
                            } catch (e: Exception) {
                                message = humanMessage(e)
                            }
                        }
                    }
                }) { Text("Vytvořit") }
            },
            dismissButton = { TextButton(onClick = { notFound = null }) { Text("Zrušit") } },
        )
    }
}

@kotlin.OptIn(ExperimentalGetImage::class)
@Composable
private fun CameraView(
    lifecycleOwner: LifecycleOwner,
    onCode: (String) -> Unit,
) {
    val context = LocalContext.current
    val previewView = remember { PreviewView(context) }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    val analyzer = remember {
        ImageAnalysis.Analyzer { imageProxy ->
            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                imageProxy.close()
                return@Analyzer
            }
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            val scanner = BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .build(),
            )
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    barcodes.firstOrNull()?.rawValue?.let { onCode(it) }
                }
                .addOnCompleteListener { imageProxy.close() }
        }
    }

    LaunchedEffect(Unit) {
        val provider = cameraProviderFuture.get()
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.setAnalyzer(context.mainExecutor, analyzer) }
        provider.unbindAll()
        provider.bindToLifecycle(
            lifecycleOwner,
            CameraSelector.DEFAULT_BACK_CAMERA,
            preview,
            analysis,
        )
    }

    DisposableEffect(Unit) {
        onDispose {
            cameraProviderFuture.get().unbindAll()
        }
    }

    AndroidView(
        factory = { previewView },
        modifier = Modifier.fillMaxSize(),
    )
}
