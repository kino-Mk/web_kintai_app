const CACHE_NAME = 'attendance-sys-v2';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './css/layout.css',
    './css/history.css',
    './js/app.js',
    './js/admin.js',
    './js/attendance.js',
    './js/firebase-config.js',
    './images/icon.svg',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュヒット - レスポンスを返す
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(err => {
                    console.warn("Fetch failed for:", event.request.url, err);
                    // オフライン時のフォールバックなどがここであれば望ましいが、
                    // 今回はコンソールエラーを抑制しつつ、通常の失敗レスポンスを返すことはできない(fetch失敗はresponseを返さないため)
                    // そのため、何もしないとTypeErrorになるが、ここではエラーログを出して再スローすることで
                    // 開発者が気づけるようにしつつ、ユーザー体験としては「画像が出ない」等で済む
                    throw err;
                });
            })
    );
});
