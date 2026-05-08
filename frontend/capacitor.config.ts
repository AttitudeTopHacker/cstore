import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cstore.app',
  appName: 'CStore',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['drive.google.com', 'supabase.co', '*.supabase.co'],
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
