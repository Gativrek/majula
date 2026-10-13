package dev.majula.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands text shared to Majula from another app — a Google Maps listing — to the web layer
 * (docs/modules/places.md 15-21). Written inside the app rather than taken as a package,
 * for the same reason as MainActivity's back handling (DECISIONS.md, 2026-10-13).
 *
 * The shared text is passed on as it arrived. Deciding whether it is a Google Maps
 * listing, and refusing it if not, happens in the web layer, where it is tested
 * (src/services/maps-link.ts).
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    /**
     * Pass on a text share, if the intent is one.
     *
     * The event is retained until a listener takes it, because a share that starts the app
     * from cold arrives before the page has loaded and started listening.
     */
    void deliver(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;

        JSObject share = new JSObject();
        share.put("text", text);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (subject != null) share.put("subject", subject);
        notifyListeners("share", share, true);
    }
}
