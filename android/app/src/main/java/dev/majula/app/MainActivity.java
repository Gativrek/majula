package dev.majula.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

/**
 * SPECS §2.2, Back: the back button undoes one step inside the app and only leaves it from
 * the list.
 *
 * Capacitor's Android core does not route back to the web layer at all; that lives in the
 * @capacitor/app plugin, which this app does not take on for one function (DECISIONS.md,
 * 2026-09-23). So back is handled here: while the WebView has history to go back through,
 * back goes back through it, and the web side turns each step into a cancel or a close
 * (src/services/back-stack.ts). With no history left, Android's own behaviour applies.
 *
 * It also receives text shared to Majula from Google Maps (docs/modules/places.md) and
 * hands it to ShareInboxPlugin.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins written inside the app must be registered before the bridge starts.
        registerPlugin(ShareInboxPlugin.class);
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

        // A share that started the app from cold.
        deliverShare(getIntent());
    }

    /** A share that arrived while the app was already running (launchMode singleTask). */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        deliverShare(intent);
    }

    private void deliverShare(Intent intent) {
        PluginHandle handle = getBridge().getPlugin("ShareInbox");
        if (handle == null || !(handle.getInstance() instanceof ShareInboxPlugin)) return;
        ((ShareInboxPlugin) handle.getInstance()).deliver(intent);
        // Consumed: if Android recreates the activity from its saved intent, the same share
        // must not arrive a second time. (A repeat would only reopen the same place, since
        // places are matched by their link, but it should not happen at all.)
        setIntent(new Intent(Intent.ACTION_MAIN));
    }
}
