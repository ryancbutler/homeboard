const CACHE = "homeboard-v2";
const DASHBOARD = "/api/v1/dashboard";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("homeboard-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname !== DASHBOARD) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(DASHBOARD, response.clone());
      else if (response.status === 401 || response.status === 403) await cache.delete(DASHBOARD);
      return response;
    } catch {
      const saved = await cache.match(DASHBOARD);
      if (!saved) return new Response(JSON.stringify({ error: "Offline. Reconnect to load your board." }), { status: 503, headers: { "Content-Type": "application/json" } });
      const headers = new Headers(saved.headers);
      headers.set("X-Homeboard-Offline", "true");
      return new Response(await saved.text(), { status: 200, headers });
    }
  })());
});
