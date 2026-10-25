package br.tvgeise.escolhe;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * Casca mínima: um WebView em tela cheia que abre o app web guardado em assets/www.
 * Os arquivos são servidos em https://appassets.local/ (mesma origem, localStorage funciona
 * e nada vai para a internet). O botão Voltar do controle é repassado para o app web.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.local";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(20, 17, 31));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setTextZoom(100); // ignora o "tamanho da fonte" do sistema: o app já se ajusta à tela

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl().getHost(), req.getUrl().getPath());
            }

            @SuppressWarnings("deprecation")
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                android.net.Uri u = android.net.Uri.parse(url);
                return serve(u.getHost(), u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith("https://" + HOST + "/"); // não sai do app
            }
        });

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);
        web.requestFocus(View.FOCUS_DOWN);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private WebResourceResponse serve(String host, String path) {
        if (!HOST.equals(host)) return null;
        if (path == null || path.equals("/")) path = "/index.html";
        try {
            InputStream in = getAssets().open("www" + path);
            return new WebResourceResponse(mime(path), "utf-8", in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
        }
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // O app web decide: true = tratou (voltou uma tela), false = já está no início
            web.evaluateJavascript("(window.tvBack ? window.tvBack() : false)", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if (!"true".equals(value)) finish();
                }
            });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
