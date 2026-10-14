/* Change VERSION whenever a deployed application file changes. */
const VERSION = "kotori-v1.10.2";
const PREFIX = "kotori:" + new URL(self.registration.scope).pathname + ":";
const CACHE = PREFIX + VERSION;
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./tabi-theme.css",
  "./assets/fonts/Yomogi-Regular.woff2",
  "./assets/fonts/Caveat-Medium.woff2",
  "./app.js",
  "./core.js",
  "./preset.js",
  "./db.js",
  "./icons.js",
  "./folio.js",
  "./gestures.js",
  "./illustrations.js",
  "./visuals.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/ZenKurenaido-Regular.woff2",
  "./assets/fonts/OFL.txt",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === "navigate") {
        const shell = await cache.match(
          new URL("./index.html", self.registration.scope).href,
        );
        if (shell) return shell;
      }
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(request);
    })(),
  );
});
