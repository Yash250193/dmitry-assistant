// Service Worker — оффлайн-оболочка приложения
const CACHE='assistant-v1';
const SHELL=[
  './',
  './index.html',
  './avito-api.js',
  './avito-dashboard.js',
  './cloud.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500;600;700;800&family=Onest:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // Данные пользователя и авторизация Supabase — всегда сеть, никогда не кэшируем
  if(url.hostname.endsWith('supabase.co')){
    e.respondWith(fetch(req).catch(()=>new Response(JSON.stringify({offline:true}),{status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Навигация — сначала сеть, при оффлайне отдаём кэш index.html
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }

  // Остальные статические ресурсы — stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached=>{
      const net=fetch(req).then(res=>{
        if(res&&res.status===200&&(url.origin===location.origin||res.type==='cors'||res.type==='basic')){
          const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return res;
      }).catch(()=>cached);
      return cached||net;
    })
  );
});
