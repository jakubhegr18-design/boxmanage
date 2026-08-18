package cz.boxmanage.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import cz.boxmanage.app.ui.BoxManageApp
import cz.boxmanage.app.ui.theme.BoxManageTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BoxManageTheme {
                BoxManageApp()
            }
        }
    }
}
