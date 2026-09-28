// Сервис-воркер «Планера»: работа без сети + push-уведомления.
const CACHE = "hp-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
const SB_URL = "https://jvrqdnjvclemooimjwyr.supabase.co", SB_KEY = "sb_publishable_sMJ6_D_N2AYvxleohYsuqg_LeijFqL0";

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return; // сервер Supabase не кешируем
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(m => m || fetch(req)));
});

// Push: показать уведомление и отметить на сервере, что оно дошло до устройства
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "Планер", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Планер";
  const opts = { body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icon-192.png", badge: "icon-192.png",
                 requireInteraction: d.kind === "must", data: { url: d.url || "./" } };
  const jobs = [self.registration.showNotification(title, opts)];
  if (d.nid) jobs.push(fetch(SB_URL + "/rest/v1/rpc/ack_notification", { method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ nid: d.nid }) }).catch(() => {}));
  if (typeof d.badge === "number" && self.navigator.setAppBadge) jobs.push(d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
  e.waitUntil(Promise.all(jobs));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) return w.focus();
    return self.clients.openWindow(url);
  }));
});
