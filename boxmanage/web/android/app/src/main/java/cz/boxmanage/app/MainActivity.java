package cz.boxmanage.app;

import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        super.load();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }
        });
    }
}
