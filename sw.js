self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activated');
});

self.addEventListener('fetch', (e) => {
    // Membiarkan browser menarik data secara normal melalui jaringan
});
