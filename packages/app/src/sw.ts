const staticCacheName = 'site-static'
const staticAssetURLs = [
    '/',
    '/index.html',
    // TODO: Add a fallback page
]

self.addEventListener('install', async evt => {
    const cache = await caches.open(staticCacheName)
    cache.addAll(staticAssetURLs)
})

self.addEventListener('activate', async evt => {
    const keys = await caches.keys()
    for(const key of keys)
        if (key !== staticCacheName)
            await caches.delete(key)
})

self.addEventListener('fetch', evt => {
    evt.respondWith(
        caches.match(evt.request, { ignoreSearch: true }).then(async cachesRes => {
            if (cachesRes) return cachesRes

            // Cache everything else except for calls to
            // daemon but it doesn't seem like I need to check for
            // these requests?!?
            try {
                const fetchRes = await fetch(evt.request)
                const cache = await caches.open(staticCacheName)
                cache.put(evt.request.url, fetchRes.clone())
                return fetchRes
            }
            catch(ex) {
                // TODO: Add a fallback page
                // return caches.match('/fallback.html')
            }
        })
    )
})