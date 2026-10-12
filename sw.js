const CACHE_NAME = 'jurnal-smanema-v6'; // Versi dinaikkan untuk memaksa pembaruan

// HANYA masukkan file inti. Hindari memasukkan terlalu banyak file 
// di awal agar proses instalasi Service Worker tidak rentan gagal.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Logo.png',
  '/style.css',
  '/auth.js'
];

// Install: Cache semua file penting saat pertama kali dibuka
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Membuka cache dan menyimpan file PWA Jurnal');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate: Bersihkan cache lama jika versi berubah
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache versi lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Memastikan service worker baru langsung mengendalikan klien/halaman yang sedang terbuka
  return self.clients.claim();
});

// Fetch: Layani request dari Cache dulu (Offline First), kecuali database Supabase
self.addEventListener('fetch', event => {
  // PENTING: Jangan pernah melakukan cache pada komunikasi ke Database Supabase
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Gunakan file dari HP (Bisa buka tanpa internet)
        }
        return fetch(event.request); // Tarik dari internet jika belum ada di HP
      })
  );
});

// Message Listener: Menerima perintah dari index.html untuk langsung menerapkan update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Menerapkan update Service Worker Jurnal ke versi baru...');
    self.skipWaiting();
  }
});
