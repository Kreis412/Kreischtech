// Cache only the public offline message. Never cache account data, photos or API responses.
const CACHE='contractorsight-offline-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('contractorsight-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||event.request.mode!=='navigate'||!['/','/index.html'].includes(url.pathname))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/offline.html'))));
});

self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('ContractorSight',{body:'Your daily check-in is ready. Tap to view weather, tasks and your business snapshot.',icon:'/app-icon-192.png',badge:'/app-icon-192.png',tag:'daily-checkin',data:{url:'/#checkin'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{const url=new URL('/#checkin',self.location.origin).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);})());
});
