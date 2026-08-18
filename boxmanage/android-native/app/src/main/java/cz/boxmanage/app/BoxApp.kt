package cz.boxmanage.app

import android.app.Application
import coil.Coil
import coil.ImageLoader
import cz.boxmanage.app.data.Api
import cz.boxmanage.app.data.Store

class BoxApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Store.setup(this)
        val imageLoader = ImageLoader.Builder(this)
            .okHttpClient(Api.client)
            .crossfade(true)
            .build()
        Coil.setImageLoader(imageLoader)
    }
}
