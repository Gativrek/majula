import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.majula.app',
  appName: 'Majula',
  webDir: 'dist',
  android: {
    // ADR-003: the app never talks to a network. A cleartext exception would only
    // ever serve something this app does not do.
    allowMixedContent: false,
  },
};

export default config;
