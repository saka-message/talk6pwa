'use strict';

const CACHE_NAME = 'sakamichi-secret-v2-appicon';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icon/app_icon.png',
  './icon/favicon-32.png',
  './icon/app_icon-180.png',
  './icon/app_icon-192.png',
  './icon/app_icon-512.png',
  './icon/46_icon.svg',
  './icon/talk_icon.svg',
  './icon/letter_icon.svg',
  './icon/setting_icon.svg',
  './icon/post_icon.svg',
  './icon/unopend_icon.svg',
  './talk/index.html',
  './talk/css/style.css',
  './talk/js/app.js',
  './talk/Owner.js',
  './talk/Internet.js',
  './user_img/unknown.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // POST、外部リソース、CSVなどno-store指定の通信はキャッシュしない
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      request.cache === 'no-store') {
    return;
  }

  // HTMLはネットワーク優先。オフライン時のみ保存済みページを使用
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // 同一オリジンのアプリ素材はキャッシュ優先
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
