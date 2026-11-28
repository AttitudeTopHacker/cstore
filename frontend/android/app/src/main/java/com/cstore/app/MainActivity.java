package com.cstore.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.browser.BrowserPlugin;
import com.capacitorjs.plugins.app.AppPlugin;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import io.bixbyte.capacitor_apk_installer.ApkInstallerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BrowserPlugin.class);
        registerPlugin(AppPlugin.class);
        registerPlugin(FilesystemPlugin.class);
        registerPlugin(ApkInstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
