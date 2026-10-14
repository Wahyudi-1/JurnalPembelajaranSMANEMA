const CACHE_NAME = 'jurnal-smanema-v9';

// Daftar aset inti menggunakan relative path agar aman di semua hosting / GitHub Pages
const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './rekap.html',
  './manifest.json',
  './style.css',
  './auth.js',
  './dashboard.js',
  './rekap.js',
  'https://raw.githubusercontent.com/Wahyudi-1/JurnalPembelajaranSMANEMA/main/Logo.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install: Simpan aset secara individual agar jika 1 file belum ada, instalasi SW tetap sukses
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Menyimpan file inti aplikasi ke dalam Cache HP...');
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Melewati cache untuk aset:', url);
        }
      }
    })
  );
});

// Activate: Hapus cache versi lama & ambil alih halaman secara instan
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Menghapus cache versi lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategi Network-First untuk halaman/script terbaru & Fallback ke Cache saat Offline
self.addEventListener('fetch', event => {
  const reqUrl = event.request.url;

  // Jangan pernah meng-cache request API ke database Supabase atau request selain GET
  if (reqUrl.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Jika online dan berhasil ambil file terbaru, perbarui juga salinan di Cache HP
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Jika OFFLINE (gagal koneksi internet), sajikan dari Cache HP
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Terima sinyal SKIP_WAITING untuk update instan
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
