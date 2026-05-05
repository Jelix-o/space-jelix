package com.jelix.hermeshub;

import android.content.res.Configuration;
import android.graphics.Color;
import android.webkit.JavascriptInterface;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.getDecorView().setBackgroundColor(Color.TRANSPARENT);
        getBridge().getWebView().addJavascriptInterface(new HermesNativeTheme(), "HermesNativeTheme");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }

    private class HermesNativeTheme {
        @JavascriptInterface
        public String getSystemTheme() {
            int currentNightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            return currentNightMode == Configuration.UI_MODE_NIGHT_YES ? "dark" : "light";
        }

        @JavascriptInterface
        public void setTheme(String theme, String background) {
            runOnUiThread(() -> {
                int color = Color.parseColor(background);
                boolean lightBars = !"dark".equals(theme);
                Window window = getWindow();
                View decorView = window.getDecorView();
                View webViewParent = (View) getBridge().getWebView().getParent();

                decorView.setBackgroundColor(color);
                webViewParent.setBackgroundColor(color);
                getBridge().getWebView().setBackgroundColor(color);
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(color);

                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
                controller.setAppearanceLightStatusBars(lightBars);
                controller.setAppearanceLightNavigationBars(lightBars);
            });
        }
    }
}
