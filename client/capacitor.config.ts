import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jelix.hermeshub',
  appName: 'Space Jelix',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      backgroundColor: '#6d35f6',
      style: 'DARK',
    },
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
