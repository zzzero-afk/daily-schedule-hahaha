// sw.js — 手帳 PWA 的 Service Worker
// 採用「離線可開啟外殼、資料一律走網路（Firestore 即時同步）」的快取策略：
// HTML/CSS/manifest 等靜態外殼快取起來，方便離線或弱網時仍能開啟 App，
// 但完全不快取任何 Firebase 的請求，確保資料永遠是最新的。

const CACHE_NAME = 'handzhang-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 任何跟 Firebase / Google 帳號相關的請求都直接放行，不做快取，
  // 確保登入與 Firestore 即時資料不會被舊快取干擾。
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('google.com') ||
    url.includes('gstatic.com/firebasejs')
  ) {
    return; // 不攔截，交給瀏覽器走正常網路請求
  }

  // 靜態外殼：先用快取，沒有才去抓網路（cache-first）
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 只快取同源的成功回應
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
