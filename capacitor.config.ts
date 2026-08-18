import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartmasjeedh.app',
  appName: 'SmartMasjeedh',
  webDir: '.next',
  server: {
    url: 'https://smart-masjeedh.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;