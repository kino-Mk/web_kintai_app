const CACHE_NAME = 'attendance-v36';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/layout.css',
    './css/history.css',
    './js/firebase-config.js',
    './js/utils.js',
    './js/app.js',
    './js/admin.js',
    './js/attendance.js',
    './images/icon.svg',
    './reset-password.html'
];

// インストール時にキャッシュを作成
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// フェッチ時にネットワークファースト戦略を使用（最新版を優先取得）
self.addEventListener('fetch', event => {
    // POSTリクエストはキャッシュ不可のためスキップ
    if (event.request.method !== 'GET') {
        return;
    }

    // Firebase や 外部 API、GAS WebApp はキャッシュしない
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebasejs') ||
        event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        // ブラウザのHTTPキャッシュを強制的に無視し、必ずサーバーの最新版を取得しにいく
        fetch(event.request, { cache: 'no-cache' })
            .then(networkResponse => {
                // ネットワークからの取得に成功したらキャッシュを更新
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse; // 最新版を返す
            })
            .catch(() => {
                // ネットワークがオフラインまたはエラーの場合はキャッシュから返す
                return caches.match(event.request);
            })
    );
});
