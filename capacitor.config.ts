import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartmasjeedh.app',
  appName: 'Smart Masjeedh',
  server: {
    url: 'https://smart-masjeedh.vercel.app',
    cleartext: true
  }
};

export default config;
