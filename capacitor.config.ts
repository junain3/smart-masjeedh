import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartmasjeedh.app',
  appName: 'SmartMasjeedh',
  webDir: 'public',
  server: {
    // For development, use Next.js dev server
    url: 'http://localhost:3000',
    cleartext: true
  },
  android: {
    // Android-specific configuration
  }
};

export default config;
