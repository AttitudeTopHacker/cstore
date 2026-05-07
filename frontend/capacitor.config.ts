import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cstore.app',
  appName: 'CStore',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
    // hostname removed: app now loads from local dist/ bundle inside APK
    // This prevents WebView from caching old remote JS files
  }
};

export default config;
