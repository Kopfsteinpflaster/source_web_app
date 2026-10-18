// SOURCE – Service Worker
// App-Hülle: aus dem Cache, im Hintergrund aktualisiert (stale-while-revalidate).
// Inhalte unter data/: zuerst aus dem Netz, damit neue Meldungen sofort ankommen.
// Bei Änderungen an der App-Hülle VERSION erhöhen.

const VERSION = "source-v16";

const HUELLE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/ansichten.js",
  "js/bilder.js",
  "js/hilfen.js",
  "js/knall.js",
  "js/terminal.js",
  "js/news.js",
  "js/krypto.js",
  "js/lexikon.js",
  "data/lexikon.json",
  "data/terminal.json",
  "data/news.json",
  "fonts/plex-mono-400.woff2",
  "fonts/plex-mono-600.woff2",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      // am HTTP-Cache vorbei, sonst landen alte und neue Dateien gemischt im Cache
      .then((cache) => cache.addAll(HUELLE.map((url) => new Request(url, { cache: "reload" }))))
      .catch(() => {}) // ohne Cache läuft die App trotzdem, nur nicht offline
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((schluessel) => Promise.all(schluessel.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const strategie = url.pathname.includes("/data/") ? netzZuerst : cacheZuerst;
  // Ist der Cache nicht nutzbar (voller Speicher, privater Modus), direkt ans Netz
  e.respondWith(strategie(e.request).catch(() => fetch(e.request)));
});

async function netzZuerst(anfrage) {
  const cache = await caches.open(VERSION);
  try {
    const antwort = await fetch(anfrage, { cache: "no-store" });
    if (antwort.ok) cache.put(anfrage, antwort.clone());
    return antwort;
  } catch {
    return (await cache.match(anfrage)) ?? Response.error();
  }
}

async function cacheZuerst(anfrage) {
  const cache = await caches.open(VERSION);
  const gecacht = await cache.match(anfrage, { ignoreSearch: true });
  // nur die URL: eine Navigationsanfrage lässt sich nicht mit eigenen Optionen weiterreichen
  const frisch = fetch(anfrage.url, { cache: "no-cache" })
    .then((antwort) => {
      if (antwort.ok) cache.put(anfrage, antwort.clone());
      return antwort;
    })
    .catch(() => undefined);
  return gecacht ?? (await frisch) ?? (await cache.match("index.html")) ?? Response.error();
}
