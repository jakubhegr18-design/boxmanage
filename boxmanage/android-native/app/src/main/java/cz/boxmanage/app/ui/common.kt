package cz.boxmanage.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cz.boxmanage.app.data.ApiException
import kotlinx.coroutines.CancellationException

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
    data class Data<T>(val value: T) : UiState<T>
}

class LoadResult<T>(val state: UiState<T>, val retry: () -> Unit)

@Composable
fun <T> loadUiState(key: Any?, loader: suspend () -> T): LoadResult<T> {
    var state by remember { mutableStateOf<UiState<T>>(UiState.Loading) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(key, attempt) {
        state = UiState.Loading
        state = try {
            UiState.Data(loader())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            UiState.Error(humanMessage(e))
        }
    }
    return LoadResult(state, retry = { attempt++ })
}

fun humanMessage(e: Throwable): String = when (e) {
    is ApiException -> e.message ?: "Chyba serveru"
    is java.net.UnknownHostException -> "Nelze se připojit k serveru. Zkontrolujte adresu a připojení."
    is javax.net.ssl.SSLException -> "Nepodařilo se navázat zabezpečené připojení."
    is java.net.SocketTimeoutException -> "Vypršel časový limit připojení."
    is java.io.IOException -> "Chyba sítě: ${e.message ?: "nelze se připojit"}"
    else -> e.message ?: "Neočekávaná chyba"
}

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
fun ErrorBox(message: String, onRetry: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
        if (onRetry != null) {
            Button(onClick = onRetry, modifier = Modifier.padding(top = 12.dp)) {
                Text("Zkusit znovu")
            }
        }
    }
}

@Composable
fun EmptyBox(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.outline)
    }
}
