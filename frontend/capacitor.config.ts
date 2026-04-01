import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cstore.app',
  appName: 'CStore',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'willowy-cheesecake-d05a89.netlify.app'
  }
};

export default config;
