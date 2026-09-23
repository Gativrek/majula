package dev.majula.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * SPECS §2.2, Back: the back button undoes one step inside the app and only leaves it from
 * the list.
 *
 * Capacitor's Android core does not route back to the web layer at all; that lives in the
 * @capacitor/app plugin, which this app does not take on for one function (DECISIONS.md,
 * 2026-09-23). So back is handled here: while the WebView has history to go back through,
 * back goes back through it, and the web side turns each step into a cancel or a close
 * (src/services/back-stack.ts). With no history left, Android's own behaviour applies.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                // Hand this one press to the system so it leaves the app, then take back
                // over for the next time the activity is shown.
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
