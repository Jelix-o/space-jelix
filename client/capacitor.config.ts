import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jelix.hermeshub',
  appName: 'Space Jelix',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
      animation: 'NONE',
    },
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#f7f4ff',
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
  },
};

export default config;
