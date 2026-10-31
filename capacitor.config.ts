import type { CapacitorConfig } from '@capacitor/cli'

// L'appli Android charge le site en ligne : chaque push sur main la met à jour, sans réinstaller.
// Le service worker garde l'appli utilisable sans réseau. Seul le code natif (android/) demande un nouvel APK.
const config: CapacitorConfig = {
  appId: 'io.github.somouga.muscu',
  appName: 'Muscu',
  webDir: 'dist',
  server: {
    // MUSCU_URL : pour essayer une version locale (ex. http://10.0.2.2:4173/ depuis l'émulateur).
    url: process.env.MUSCU_URL ?? 'https://so-mouga.github.io/muscu-app/',
    cleartext: !!process.env.MUSCU_URL?.startsWith('http:'),
    androidScheme: 'https',
  },
}

export default config
