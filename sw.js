const CACHE_NAME = 'jurnal-smanema-v1';

// Daftar file yang akan disimpan permanen di HP
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/guru.html',
    '/walikelas.html',
    '/siswa.html',
    '/dashboard.html',
    '/style.css',
    '/auth.js',
    '/guru.js',
    '/siswa.js',
    '/dashboard.js',
    '/walikelas.js',
    '/manifest.json',
    'https://raw.githubusercontent.com/Wahyudi-1/JurnalPembelajaranSMANEMA/main/Logo.png'
];

// Saat Aplikasi diinstal, simpan semua file ke memori HP
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching files...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Hapus cache lama jika ada versi aplikasi baru
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Menghapus cache lama...');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Strategi "Cache First, then Network"
// Jika buka web tanpa internet, ambil tampilan dari memori HP
self.addEventListener('fetch', (event) => {
    // Kita hanya meng-cache tampilan web, BUKAN request ke database Supabase
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Jika ada di memori HP, tampilkan. Jika tidak, ambil dari internet.
            return cachedResponse || fetch(event.request);
        })
    );
});
