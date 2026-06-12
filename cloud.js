/* ─────────────────────────────────────────────────────────────────────────
   cloud.js — облачная синхронизация данных через Supabase
   • Оффлайн-first: всё пишется в localStorage мгновенно (работает без сети)
   • При входе и при восстановлении сети — двусторонняя синхронизация с облаком
   • Конфликты разрешаются по времени изменения каждого ключа (last-write-wins)
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  const SUPABASE_URL = 'https://rwpmjaqghekeyghdnkch.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yf1Yzyi5jStFxtvgS5Zy1Q_WH9LiATt';

  // Ключи localStorage, которые синхронизируем (данные приложения)
  const EXACT = ['clientsData','metricsData','personalGoalsData','calEvsData','mevsData',
                 'appNotes','monthNote','hLogs','hDefs','focusData','bytovkaTasks',
                 'finEntries','finStatuses','theme'];
  const PREFIX = ['weekNote_'];
  function isSyncKey(k){ return EXACT.indexOf(k)>=0 || PREFIX.some(p=>k.indexOf(p)===0); }

  // ── Локальные метаданные синхронизации ────────────────────────────────────
  let meta = {};   // { ключ: время_последнего_изменения_мс }
  let dirty = {};  // { ключ: true } — ждут отправки в облако
  try{ meta = JSON.parse(localStorage.getItem('__syncMeta')||'{}'); }catch(e){}
  try{ dirty = JSON.parse(localStorage.getItem('__syncDirty')||'{}'); }catch(e){}

  const _setItem = localStorage.setItem.bind(localStorage);
  const _getItem = localStorage.getItem.bind(localStorage);
  function saveMeta(){ try{ _setItem('__syncMeta', JSON.stringify(meta)); }catch(e){} }
  function saveDirty(){ try{ _setItem('__syncDirty', JSON.stringify(dirty)); }catch(e){} }

  // Учитываем данные, накопленные ДО появления синхронизации: помечаем их
  // очень старой меткой (1), чтобы реальные данные из облака всегда побеждали,
  // но при пустом облаке локальные данные всё равно выгрузились.
  function seedExisting(){
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(isSyncKey(k) && !(k in meta)){ meta[k]=1; dirty[k]=true; }
    }
    saveMeta(); saveDirty();
  }

  // Перехватываем все записи в localStorage, чтобы автоматически ставить их в очередь
  localStorage.setItem = function(key, val){
    _setItem(key, val);
    if(isSyncKey(key)){
      meta[key] = Date.now();
      dirty[key] = true;
      saveMeta(); saveDirty();
      schedulePush();
    }
  };

  // ── Состояние ─────────────────────────────────────────────────────────────
  let supa = null;
  let session = null;
  let pushTimer = null;
  let pulling = false;

  function hasSDK(){ return typeof window.supabase !== 'undefined' && window.supabase.createClient; }

  // ── UI: кнопка, тосты, модалка входа ──────────────────────────────────────
  function injectStyles(){
    if(document.getElementById('cloudStyles'))return;
    const s=document.createElement('style'); s.id='cloudStyles';
    s.textContent=`
    #cloudToast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%) translateY(20px);
      background:#1A1A2E;color:#fff;padding:9px 16px;border-radius:10px;font:500 13px/1 'Onest',sans-serif;
      box-shadow:0 8px 30px rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:.3s;z-index:9999;max-width:80vw;text-align:center}
    #cloudToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .cloud-ov{position:fixed;inset:0;background:rgba(10,10,25,.55);backdrop-filter:blur(4px);
      display:none;align-items:center;justify-content:center;z-index:10000;padding:20px}
    .cloud-ov.show{display:flex}
    .cloud-modal{background:var(--frost,#F7F4FF);color:var(--ink,#1A1A2E);width:100%;max-width:360px;
      border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);font-family:'Onest',sans-serif}
    .cloud-modal h3{font-family:'Unbounded',sans-serif;font-size:18px;margin:0 0 4px;font-weight:700}
    .cloud-modal p.sub{margin:0 0 16px;font-size:13px;color:var(--muted,#8888AA)}
    .cloud-modal input{width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:10px;border-radius:11px;
      border:1.5px solid var(--border,#E2DEF0);background:#fff;font-size:14px;font-family:'Onest',sans-serif;color:var(--ink,#1A1A2E)}
    .cloud-modal input:focus{outline:none;border-color:#C4306A}
    .cloud-row{display:flex;gap:8px;margin-top:6px}
    .cloud-btn{flex:1;padding:12px;border:none;border-radius:11px;font:600 14px 'Onest',sans-serif;cursor:pointer;transition:.15s}
    .cloud-btn.primary{background:#C4306A;color:#fff}
    .cloud-btn.primary:hover{background:#a82659}
    .cloud-btn.ghost{background:transparent;border:1.5px solid var(--border,#E2DEF0);color:var(--ink,#1A1A2E)}
    .cloud-msg{font-size:12.5px;margin-top:10px;min-height:16px}
    .cloud-msg.err{color:#CC3355}.cloud-msg.ok{color:#1D8A4E}
    .cloud-x{position:absolute;top:14px;right:16px;font-size:22px;color:var(--muted,#888);cursor:pointer;background:none;border:none;line-height:1}
    .cloud-acc{font-size:12px;color:var(--muted,#8888AA);margin:14px 0 4px;word-break:break-all}
    `;
    document.head.appendChild(s);
  }

  let toastTimer=null;
  function toast(msg){
    let t=document.getElementById('cloudToast');
    if(!t){t=document.createElement('div');t.id='cloudToast';document.body.appendChild(t);}
    t.textContent=msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  function setBtn(text,title){
    const b=document.getElementById('cloudBtn');
    if(b){ b.textContent=text; if(title)b.title=title; }
  }

  function buildModal(){
    if(document.getElementById('cloudOv'))return;
    const ov=document.createElement('div'); ov.className='cloud-ov'; ov.id='cloudOv';
    ov.innerHTML=`
      <div class="cloud-modal" style="position:relative">
        <button class="cloud-x" onclick="cloudCloseModal()">×</button>
        <div id="cloudAuthView">
          <h3>Облачная синхронизация</h3>
          <p class="sub">Войдите, чтобы данные сохранялись в облаке и подхватывались на других устройствах.</p>
          <input id="cloudEmail" type="email" placeholder="Email" autocomplete="email">
          <input id="cloudPass" type="password" placeholder="Пароль (мин. 6 символов)" autocomplete="current-password">
          <div class="cloud-row">
            <button class="cloud-btn primary" onclick="cloudLogin()">Войти</button>
            <button class="cloud-btn ghost" onclick="cloudSignup()">Регистрация</button>
          </div>
          <div class="cloud-msg" id="cloudMsg"></div>
        </div>
        <div id="cloudAccView" style="display:none">
          <h3>Аккаунт</h3>
          <p class="sub">Данные синхронизируются автоматически.</p>
          <div class="cloud-acc" id="cloudAccEmail"></div>
          <div class="cloud-row" style="margin-top:14px">
            <button class="cloud-btn primary" onclick="cloudSyncNow()">Синхронизировать</button>
            <button class="cloud-btn ghost" onclick="cloudLogout()">Выйти</button>
          </div>
          <div class="cloud-msg" id="cloudMsg2"></div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{ if(e.target===ov) cloudCloseModal(); });
  }

  function msg(text,cls){ const m=document.getElementById('cloudMsg'); if(m){ m.textContent=text; m.className='cloud-msg '+(cls||''); } }

  // ── Синхронизация ─────────────────────────────────────────────────────────
  function schedulePush(){
    if(!session) return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(flushPush, 1400);
  }

  async function flushPush(){
    if(!supa || !session || !navigator.onLine) return;
    const keys=Object.keys(dirty);
    if(!keys.length) return;
    const uid=session.user.id;
    const rows=keys.map(k=>({ user_id:uid, key:k, value:_getItem(k), updated_at: meta[k]||Date.now() }));
    try{
      const { error } = await supa.from('app_state').upsert(rows, { onConflict:'user_id,key' });
      if(error) throw error;
      keys.forEach(k=>{ delete dirty[k]; }); saveDirty();
      setBtn('☁ ✓','Синхронизировано');
    }catch(e){
      setBtn('☁ …','Изменения в очереди (нет сети)');
    }
  }

  async function pullMerge(silent){
    if(!supa || !session || pulling) return;
    pulling=true;
    try{
      const { data, error } = await supa.from('app_state').select('key,value,updated_at');
      if(error) throw error;
      let changed=0; const cloudKeys={};
      (data||[]).forEach(row=>{
        cloudKeys[row.key]=true;
        const localTs=meta[row.key]||0;
        if(row.updated_at > localTs){
          _setItem(row.key, row.value);     // value хранится как строка — кладём как есть
          meta[row.key]=row.updated_at; delete dirty[row.key]; changed++;  // облако новее — локальную очередь снимаем
        } else if(localTs > row.updated_at){
          dirty[row.key]=true;              // локальная версия новее — отправим
        } else {
          delete dirty[row.key];            // совпадает — уже синхронизировано
        }
      });
      // Локальные ключи, которых ещё нет в облаке — поставить в очередь
      Object.keys(meta).forEach(k=>{ if(!cloudKeys[k]) dirty[k]=true; });
      saveMeta(); saveDirty();
      if(Object.keys(dirty).length) flushPush();
      pulling=false;
      if(changed){
        if(!silent) toast('Данные обновлены из облака');
        // Перезагрузка нужна, чтобы все разделы перечитали localStorage
        setTimeout(()=>location.reload(), 400);
      } else if(!silent){
        toast('Уже синхронизировано');
      }
    }catch(e){ pulling=false; }
  }

  // ── Авторизация ───────────────────────────────────────────────────────────
  async function applySession(s){
    session=s;
    if(session){
      setBtn('☁ ✓', session.user.email||'Аккаунт');
      const ae=document.getElementById('cloudAccEmail'); if(ae) ae.textContent=session.user.email||'';
      await pullMerge(true);
    }else{
      setBtn('☁ Войти','Войти для синхронизации');
    }
  }

  function showAccView(show){
    const a=document.getElementById('cloudAuthView'), b=document.getElementById('cloudAccView');
    if(a&&b){ a.style.display=show?'none':'block'; b.style.display=show?'block':'none'; }
  }

  // ── Глобальные обработчики (вызываются из разметки) ────────────────────────
  window.cloudAuthClick=function(){
    if(!hasSDK()){ toast('Нет соединения — облако недоступно оффлайн'); return; }
    buildModal();
    showAccView(!!session);
    if(session){ const ae=document.getElementById('cloudAccEmail'); if(ae) ae.textContent=session.user.email||''; }
    document.getElementById('cloudOv').classList.add('show');
  };
  window.cloudCloseModal=function(){ const o=document.getElementById('cloudOv'); if(o)o.classList.remove('show'); };

  window.cloudLogin=async function(){
    const email=document.getElementById('cloudEmail').value.trim();
    const pass=document.getElementById('cloudPass').value;
    if(!email||!pass){ msg('Введите email и пароль','err'); return; }
    msg('Вход…','');
    const { data, error } = await supa.auth.signInWithPassword({ email, password:pass });
    if(error){ msg(error.message,'err'); return; }
    msg('Готово!','ok');
    await applySession(data.session);
    setTimeout(cloudCloseModal,500);
  };

  window.cloudSignup=async function(){
    const email=document.getElementById('cloudEmail').value.trim();
    const pass=document.getElementById('cloudPass').value;
    if(!email||pass.length<6){ msg('Email и пароль от 6 символов','err'); return; }
    msg('Создаём аккаунт…','');
    const { data, error } = await supa.auth.signUp({ email, password:pass });
    if(error){ msg(error.message,'err'); return; }
    let sess = data.session;
    if(!sess){
      // Пользователь автоподтверждается триггером в БД — входим сразу
      const r = await supa.auth.signInWithPassword({ email, password:pass });
      if(r.error){ msg('Аккаунт создан. Войдите с теми же данными.','ok'); return; }
      sess = r.data.session;
    }
    msg('Аккаунт создан!','ok');
    await applySession(sess);
    setTimeout(cloudCloseModal,600);
  };

  window.cloudLogout=async function(){
    if(supa) await supa.auth.signOut();
    session=null; setBtn('☁ Войти','Войти для синхронизации');
    cloudCloseModal(); toast('Вы вышли. Данные остаются на этом устройстве.');
  };

  window.cloudSyncNow=function(){ toast('Синхронизация…'); flushPush(); pullMerge(false); };

  // ── Инициализация ─────────────────────────────────────────────────────────
  function init(){
    injectStyles();
    seedExisting();
    if(!hasSDK()){
      // Оффлайн / SDK не загрузился — приложение работает локально
      setBtn('☁ Оффлайн','Облако недоступно без сети');
      return;
    }
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true }
    });
    supa.auth.getSession().then(({data})=>{ applySession(data.session); });
    supa.auth.onAuthStateChange((_e, s)=>{ session=s; if(s) setBtn('☁ ✓', s.user.email||'Аккаунт'); });

    // При восстановлении сети — досылаем очередь и подтягиваем свежие данные
    window.addEventListener('online', ()=>{ if(session){ toast('Сеть восстановлена'); flushPush(); pullMerge(true); } });
    window.addEventListener('offline', ()=>{ if(session) setBtn('☁ …','Оффлайн — изменения сохраняются локально'); });
    // Досинхронизация при возврате на вкладку
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && session && navigator.onLine){ flushPush(); pullMerge(true); } });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
