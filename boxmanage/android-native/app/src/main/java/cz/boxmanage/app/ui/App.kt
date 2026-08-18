package cz.boxmanage.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import cz.boxmanage.app.data.Store
import cz.boxmanage.app.ui.screens.BoxDetailScreen
import cz.boxmanage.app.ui.screens.BoxesScreen
import cz.boxmanage.app.ui.screens.DashboardScreen
import cz.boxmanage.app.ui.screens.LocationsScreen
import cz.boxmanage.app.ui.screens.LoginScreen
import cz.boxmanage.app.ui.screens.MovementsScreen
import cz.boxmanage.app.ui.screens.RemoteScreen
import cz.boxmanage.app.ui.screens.ScannerScreen
import cz.boxmanage.app.ui.screens.ServerScreen
import cz.boxmanage.app.ui.screens.SettingsScreen

@Composable
fun BoxManageApp() {
    val state by Store.state.collectAsState()
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    LaunchedEffect(state.serverUrl, state.token) {
        val target = when {
            state.serverUrl.isEmpty() -> "server"
            state.token.isEmpty() -> "login"
            else -> null
        }
        if (target != null && currentRoute != target) {
            navController.navigate(target) {
                popUpTo(0) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    NavHost(navController, startDestination = "server") {
        composable("server") {
            ServerScreen(onDone = {
                navController.navigate("login") { popUpTo(0) { inclusive = true } }
            })
        }
        composable("login") {
            LoginScreen(onLoggedIn = {
                navController.navigate("home") { popUpTo(0) { inclusive = true } }
            })
        }
        composable("home") {
            HomeScreen(
                onOpenBox = { id -> navController.navigate("box/${java.net.URLEncoder.encode(id, "UTF-8")}") },
                onOpenItem = { boxId, itemId ->
                    navController.navigate(
                        "box/${java.net.URLEncoder.encode(boxId, "UTF-8")}?item=${java.net.URLEncoder.encode(itemId, "UTF-8")}",
                    )
                },
                onOpenMovements = { boxId ->
                    navController.navigate("movements?boxId=${boxId ?: ""}")
                },
                onOpenRemote = { navController.navigate("remote") },
            )
        }
        composable(
            "box/{boxId}?item={itemId}",
            arguments = listOf(
                navArgument("boxId") { type = NavType.StringType },
                navArgument("itemId") {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
        ) { entry ->
            val boxId = entry.arguments?.getString("boxId").orEmpty()
            val itemId = entry.arguments?.getString("itemId").orEmpty()
            BoxDetailScreen(
                boxId = boxId,
                itemId = itemId,
                onBack = { navController.popBackStack() },
                onOpenBox = { id -> navController.navigate("box/${java.net.URLEncoder.encode(id, "UTF-8")}") },
                onOpenMovements = {
                    navController.navigate("movements?boxId=${java.net.URLEncoder.encode(it, "UTF-8")}")
                },
            )
        }
        composable(
            "movements?boxId={boxId}",
            arguments = listOf(navArgument("boxId") {
                type = NavType.StringType
                defaultValue = ""
            }),
        ) { entry ->
            MovementsScreen(
                boxId = entry.arguments?.getString("boxId").orEmpty(),
                onBack = { navController.popBackStack() },
            )
        }
        composable("remote") {
            RemoteScreen(onBack = { navController.popBackStack() })
        }
    }
}

private enum class HomeTab(val label: String, val icon: ImageVector) {
    Dashboard("Přehled", Icons.Default.Dashboard),
    Boxes("Krabice", Icons.Default.Inventory2),
    Scan("Sken", Icons.Default.QrCodeScanner),
    Locations("Lokace", Icons.Default.LocationOn),
    Settings("Více", Icons.Default.Settings),
}

@Composable
private fun HomeScreen(
    onOpenBox: (String) -> Unit,
    onOpenItem: (String, String) -> Unit,
    onOpenMovements: (String?) -> Unit,
    onOpenRemote: () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(HomeTab.Dashboard) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                HomeTab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                HomeTab.Dashboard -> DashboardScreen(onOpenBox, onOpenMovements)
                HomeTab.Boxes -> BoxesScreen(onOpenBox)
                HomeTab.Scan -> ScannerScreen(onOpenBox, onOpenItem)
                HomeTab.Locations -> LocationsScreen()
                HomeTab.Settings -> SettingsScreen(onOpenRemote)
            }
        }
    }
}
