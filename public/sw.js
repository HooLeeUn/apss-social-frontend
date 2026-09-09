const CACHE_PREFIX = "reccool-static-";
const STATIC_CACHE = `${CACHE_PREFIX}v4`;
const SAFE_STATIC_PATHS = new Set([
  "/manifest.webmanifest",
  "/icons/pwa/icon-192.png",
  "/icons/pwa/icon-512.png",
  "/icons/pwa/icon-maskable-512.png",
  "/icons/pwa/apple-touch-icon.png",
]);

const PRIVATE_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
  /^\/me(?:\/|$)/,
  /\/(?:login|logout)(?:\/|$)/,
  /\/(?:messages?|notifications?)(?:\/|$)/,
  /\/(?:ratings?|comments?)(?:\/|$)/,
  /\/(?:follows?|friends?)(?:\/|$)/,
  /\/(?:feeds?|activity)(?:\/|$)/,
  /\/(?:profiles?|video-reactions?)(?:\/|$)/,
  /\/(?:uploads?|media|videos?)(?:\/|$)/,
];

function isSafeCacheResponse(response) {
  if (!response.ok || response.type === "opaque") {
    return false;
  }

  const cacheControl = response.headers.get("Cache-Control")?.toLowerCase() ?? "";
  return !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.all(
        [...SAFE_STATIC_PATHS].map(async (path) => {
          const response = await fetch(path);
          if (!isSafeCacheResponse(response)) {
            throw new Error(`Refusing to precache unsafe response: ${path}`);
          }
          await cache.put(path, response);
        }),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(CACHE_PREFIX) && cacheName !== STATIC_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || request.headers.has("Authorization")) {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const normalizedPath = url.pathname.toLowerCase();
  if (PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return;
  }

  // Navigations are explicitly network-first with no cache fallback. A failed
  // navigation is intentionally not replaced with cached user data.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  // Every request outside the exact, query-free allowlist remains untouched.
  if (url.search || !SAFE_STATIC_PATHS.has(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      if (isSafeCacheResponse(networkResponse)) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }),
  );
});
