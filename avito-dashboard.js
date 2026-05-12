'use strict';

/**
 * avitoDashboard — модуль дашборда Авито.
 * Подключается к AvitoAPI (avito-api.js), рендерит экран #screen-avito.
 */
const avitoDashboard = (() => {

  // ─── State ──────────────────────────────────────────────────────────────
  let userId       = null;
  let userProfile  = null;
  let currentPeriod = '7d';
  let isLoading    = false;

  // ─── CSS ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('avito-dash-styles')) return;
    const el = document.createElement('style');
    el.id = 'avito-dash-styles';
    el.textContent = `
/* ── AVITO SCREEN ─────────────────────────────────────────────────── */
#screen-avito{overflow-y:auto;padding:20px;background:var(--bg)}
#screen-avito::-webkit-scrollbar{width:4px}
#screen-avito::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}

/* ── CONNECT FORM ─────────────────────────────────────────────────── */
.av-connect{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;padding:40px 16px}
.av-connect-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r2);padding:32px;width:100%;max-width:400px}
.av-connect-logo{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.av-connect-logo-icon{width:44px;height:44px;background:#0068FF;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:white;flex-shrink:0;font-family:'Unbounded',sans-serif}
.av-connect-title{font-family:'Unbounded',sans-serif;font-size:13px;font-weight:600}
.av-connect-sub{font-size:10px;color:var(--t3);margin-top:3px}
.av-field{margin-bottom:14px}
.av-label{font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.av-input{width:100%;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:9px 12px;color:var(--t1);font-family:'Azeret Mono',monospace;font-size:12px;outline:none;transition:border-color .2s;box-sizing:border-box}
.av-input:focus{border-color:#0068FF}
.av-input::placeholder{color:var(--t3)}
.av-connect-btn{width:100%;padding:10px 0;background:#0068FF;border:none;border-radius:var(--r);color:white;font-family:'Azeret Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:background .2s;margin-top:6px}
.av-connect-btn:hover{background:#0055d4}
.av-connect-btn:disabled{opacity:.5;cursor:not-allowed}
.av-connect-err{margin-top:12px;padding:9px 12px;background:#2d0011;border:1px solid var(--coral);border-radius:var(--r);font-size:11px;color:#fda4af;line-height:1.55;display:none;white-space:pre-wrap}
.av-connect-err.show{display:block}
.av-connect-hint{margin-top:14px;padding:10px 12px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);font-size:10px;color:var(--t3);line-height:1.6}
.av-connect-hint code{background:var(--s3);border-radius:3px;padding:1px 4px;font-size:9px;color:var(--t2)}

/* ── PROFILE HEADER ───────────────────────────────────────────────── */
.av-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:12px 16px}
.av-header-av{width:38px;height:38px;background:#0068FF;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;font-family:'Unbounded',sans-serif;flex-shrink:0}
.av-header-info{flex:1;min-width:0}
.av-header-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.av-header-sub{font-size:10px;color:var(--t3);margin-top:2px}
.av-header-btns{display:flex;gap:6px;flex-shrink:0}
.av-hbtn{background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 11px;font-size:10px;font-family:'Azeret Mono',monospace;color:var(--t2);cursor:pointer;transition:all .15s;white-space:nowrap}
.av-hbtn:hover{border-color:var(--blue);color:var(--blue)}
.av-hbtn.danger:hover{border-color:var(--coral);color:var(--coral)}
.av-hbtn:disabled{opacity:.5;cursor:not-allowed}

/* ── CORS NOTICE ──────────────────────────────────────────────────── */
.av-cors{background:#251500;border:1px solid var(--amber);border-radius:var(--r2);padding:12px 16px;margin-bottom:14px;font-size:11px;color:#fde68a;line-height:1.6;display:none}
.av-cors.show{display:block}
.av-cors code{background:rgba(0,0,0,.3);border-radius:3px;padding:1px 5px;font-size:10px}

/* ── PERIOD FILTER ────────────────────────────────────────────────── */
.av-periods{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap}
.av-period-btn{background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 13px;font-size:11px;font-family:'Azeret Mono',monospace;color:var(--t2);cursor:pointer;transition:all .15s;white-space:nowrap}
.av-period-btn:hover{border-color:var(--b2);color:var(--t1)}
.av-period-btn.active{background:rgba(0,104,255,.12);border-color:#0068FF;color:#60a5fa}

/* ── GROUPS ───────────────────────────────────────────────────────── */
.av-group{margin-bottom:20px}
.av-group-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--b1)}
.av-group-title{font-size:10px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;font-family:'Azeret Mono',monospace}
.av-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px}

/* ── METRIC CARD ──────────────────────────────────────────────────── */
.av-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:10px 13px;transition:border-color .15s;cursor:default}
.av-card:hover{border-color:var(--b2)}
.av-val{font-family:'Unbounded',sans-serif;font-size:15px;font-weight:600;margin-bottom:4px;line-height:1.2;word-break:break-all}
.av-val.c-rub{color:var(--green)}
.av-val.c-num{color:var(--blue)}
.av-val.c-pct{color:var(--amber)}
.av-val.c-time{color:var(--teal)}
.av-val.c-na{color:var(--t3);font-size:18px}
.av-val.c-err{color:var(--t3);font-size:10px;font-family:'Azeret Mono',monospace;font-weight:400;line-height:1.4}
.av-lbl{font-size:9px;color:var(--t3);line-height:1.35}

/* ── SKELETON ─────────────────────────────────────────────────────── */
.av-card.sk .av-val,.av-card.sk .av-lbl{background:var(--s3);color:transparent;border-radius:3px;animation:av-pulse 1.5s ease infinite}
.av-card.sk .av-val{height:19px;width:65%;margin-bottom:6px}
.av-card.sk .av-lbl{height:10px;width:88%}
@keyframes av-pulse{0%,100%{opacity:.45}55%{opacity:.85}}

/* ── MOBILE ───────────────────────────────────────────────────────── */
@media(max-width:768px){
  #screen-avito{padding:12px}
  .av-cards{grid-template-columns:repeat(2,1fr)}
  .av-header{flex-wrap:wrap}
  .av-header-btns{width:100%}
  .av-hbtn{flex:1;text-align:center}
  .av-connect-card{padding:20px}
}
    `;
    document.head.appendChild(el);
  }

  // ─── Period helpers ──────────────────────────────────────────────────────

  const PERIOD_LABELS = { today: 'Сегодня', yesterday: 'Вчера', '7d': '7 дней', '30d': '30 дней', month: 'Месяц' };

  function getDateRange(period) {
    const now   = new Date();
    const fmt   = d => d.toISOString().slice(0, 10);
    const fmtDT = (d, end = false) => `${fmt(d)}T${end ? '23:59:59' : '00:00:00'}`;

    switch (period) {
      case 'today': {
        const f = fmt(now);
        return { dateFrom: f, dateTo: f, dtFrom: fmtDT(now), dtTo: fmtDT(now, true) };
      }
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        const f = fmt(y);
        return { dateFrom: f, dateTo: f, dtFrom: fmtDT(y), dtTo: fmtDT(y, true) };
      }
      case '7d': {
        const from = new Date(now); from.setDate(from.getDate() - 6);
        return { dateFrom: fmt(from), dateTo: fmt(now), dtFrom: fmtDT(from), dtTo: fmtDT(now, true) };
      }
      case '30d': {
        const from = new Date(now); from.setDate(from.getDate() - 29);
        return { dateFrom: fmt(from), dateTo: fmt(now), dtFrom: fmtDT(from), dtTo: fmtDT(now, true) };
      }
      case 'month': {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { dateFrom: fmt(from), dateTo: fmt(now), dtFrom: fmtDT(from), dtTo: fmtDT(now, true) };
      }
      default: {
        const from = new Date(now); from.setDate(from.getDate() - 6);
        return { dateFrom: fmt(from), dateTo: fmt(now), dtFrom: fmtDT(from), dtTo: fmtDT(now, true) };
      }
    }
  }

  // ─── Formatters ──────────────────────────────────────────────────────────

  function fmtRub(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return new Intl.NumberFormat('ru-RU').format(Math.round(v)) + ' ₽';
  }

  function fmtNum(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return new Intl.NumberFormat('ru-RU').format(v);
  }

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return '—';
    return v.toFixed(1) + '%';
  }

  function fmtTime(sec) {
    if (!sec || isNaN(sec) || sec <= 0) return '—';
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(ss)}`;
    return `${pad(m)}:${pad(ss)}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ─── Screen entry point ──────────────────────────────────────────────────

  function render() {
    const screen = document.getElementById('screen-avito');
    if (!screen) return;
    if (!avitoAPI.hasCreds()) {
      renderConnectForm(screen);
    } else {
      renderDashboard(screen);
    }
  }

  // ─── Connect form ─────────────────────────────────────────────────────────

  function renderConnectForm(screen) {
    screen.innerHTML = `
      <div class="av-connect">
        <div class="av-connect-card">
          <div class="av-connect-logo">
            <div class="av-connect-logo-icon">A</div>
            <div>
              <div class="av-connect-title">Авито · Кабинет</div>
              <div class="av-connect-sub">Подключите профиль через API</div>
            </div>
          </div>
          <div class="av-field">
            <div class="av-label">Client ID</div>
            <input class="av-input" id="aClientId" type="text" placeholder="z64w11Spm229NR-uXQAg" autocomplete="off" spellcheck="false">
          </div>
          <div class="av-field">
            <div class="av-label">Client Secret</div>
            <input class="av-input" id="aClientSecret" type="password" placeholder="••••••••••••••••••••••">
          </div>
          <button class="av-connect-btn" id="aConnectBtn" onclick="avitoDashboard.connect()">Подключить профиль</button>
          <div class="av-connect-err" id="aConnectErr"></div>
          <div class="av-connect-hint">
            💡 Получите ключи в <strong>Личном кабинете Авито → Настройки → Для разработчиков</strong>.<br>
            Ключи хранятся только в вашем браузере (localStorage).<br><br>
            ⚠️ Откройте через HTTP-сервер, не как файл:<br>
            <code>npx serve .</code> или <code>python -m http.server 8080</code>
          </div>
        </div>
      </div>`;

    const idEl = document.getElementById('aClientId');
    const secEl = document.getElementById('aClientSecret');
    idEl.addEventListener('keydown', e => { if (e.key === 'Enter') secEl.focus(); });
    secEl.addEventListener('keydown', e => { if (e.key === 'Enter') avitoDashboard.connect(); });
  }

  // ─── Dashboard shell ──────────────────────────────────────────────────────

  function renderDashboard(screen) {
    const name = _profileName();
    const sub  = userProfile?.email || (userId ? `ID: ${userId}` : 'Профиль подключён');

    screen.innerHTML = `
      <div class="av-header">
        <div class="av-header-av">А</div>
        <div class="av-header-info">
          <div class="av-header-name" id="aProfileName">${esc(name)}</div>
          <div class="av-header-sub"  id="aProfileSub">${esc(sub)}</div>
        </div>
        <div class="av-header-btns">
          <button class="av-hbtn" id="aRefreshBtn" onclick="avitoDashboard.refresh()">↺ Обновить</button>
          <button class="av-hbtn danger" onclick="avitoDashboard.disconnect()">Отключить</button>
        </div>
      </div>

      <div class="av-cors" id="avCorsNotice">
        <strong>⚠️ CORS ограничение</strong> — браузер блокирует запросы к api.avito.ru при открытии файла напрямую.<br>
        Решение: запустите <code>npx serve .</code> в папке проекта и откройте <code>http://localhost:3000</code>
      </div>

      <div class="av-periods" id="avPeriods">${
        Object.entries(PERIOD_LABELS).map(([k, v]) =>
          `<button class="av-period-btn${k === currentPeriod ? ' active' : ''}"
            onclick="avitoDashboard.setPeriod('${k}')">${v}</button>`
        ).join('')
      }</div>

      <div id="avMetrics"></div>`;

    loadAndRender();
  }

  function _profileName() {
    if (!userProfile) return 'Профиль';
    return userProfile.name
      || userProfile.profile?.name
      || userProfile.login
      || 'Профиль';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  function renderSkeleton() {
    const wrap = document.getElementById('avMetrics');
    if (!wrap) return;
    const groups = [
      { t: '💰 Финансы', n: 9 },
      { t: '📋 Объявления', n: 2 },
      { t: '📊 Показатели эффективности', n: 10 },
      { t: '📞 Звонки', n: 5 },
      { t: '💬 Чаты и сообщения', n: 4 },
      { t: '⭐ Прочее', n: 5 },
    ];
    wrap.innerHTML = groups.map(g => `
      <div class="av-group">
        <div class="av-group-head"><div class="av-group-title">${g.t}</div></div>
        <div class="av-cards">${Array(g.n).fill('<div class="av-card sk"><div class="av-val"> </div><div class="av-lbl"> </div></div>').join('')}</div>
      </div>`).join('');
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadAndRender() {
    if (isLoading) return;
    isLoading = true;

    const btn = document.getElementById('aRefreshBtn');
    if (btn) { btn.disabled = true; btn.textContent = '↻ Загрузка…'; }

    renderSkeleton();

    const range = getDateRange(currentPeriod);

    // Безопасный вызов — никогда не бросает, возвращает { _error: msg } при ошибке
    const safe = async fn => {
      try { return await fn(); }
      catch (e) { return { _error: e.message }; }
    };

    // 1. Получаем профиль если ещё не загружен
    if (!userId) {
      const self = await safe(() => avitoAPI.getSelf());
      if (self && !self._error) {
        userId      = self.id || self.user_id;
        userProfile = self;
        _updateHeader(self);
      } else if (self?._error) {
        _checkCors(self._error);
      }
    }

    // 2. Параллельно грузим всё остальное
    const [balRes, itemsRes, callsRes, chatsRes, finRes] = await Promise.all([
      safe(() => avitoAPI.getBalances()),
      safe(() => avitoAPI.getItems()),
      safe(() => avitoAPI.getCalls(range.dtFrom, range.dtTo)),
      userId ? safe(() => avitoAPI.getChats(userId)) : Promise.resolve({ _error: 'нет userId' }),
      safe(() => avitoAPI.getFinancialStats(range.dateFrom, range.dateTo)),
    ]);

    // 3. Статистика объявлений — нужны ID из itemsRes
    let statsRes = { _error: 'нет userId' };
    if (userId) {
      const ids = _extractItemIds(itemsRes);
      statsRes = await safe(() => avitoAPI.getItemsStats(userId, range.dateFrom, range.dateTo, ids));
    }

    // Проверяем CORS
    [balRes, itemsRes, callsRes, finRes, statsRes].forEach(r => {
      if (r?._error) _checkCors(r._error);
    });

    renderData({ balRes, itemsRes, statsRes, callsRes, chatsRes, finRes });

    isLoading = false;
    if (btn) { btn.disabled = false; btn.textContent = '↺ Обновить'; }
  }

  function _updateHeader(user) {
    const nameEl = document.getElementById('aProfileName');
    const subEl  = document.getElementById('aProfileSub');
    if (nameEl) nameEl.textContent = user.name || user.profile?.name || user.login || 'Профиль';
    if (subEl)  subEl.textContent  = user.email || `ID: ${user.id || user.user_id}`;
  }

  function _checkCors(msg) {
    if (!msg) return;
    const isCors = msg.toLowerCase().includes('failed to fetch')
      || msg.toLowerCase().includes('cors')
      || msg.toLowerCase().includes('не удалось подключиться');
    if (isCors) {
      const el = document.getElementById('avCorsNotice');
      if (el) el.classList.add('show');
    }
  }

  function _extractItemIds(itemsRes) {
    if (!itemsRes || itemsRes._error) return [];
    const items = itemsRes.items || itemsRes.resources || [];
    return items.map(i => i.id || i.item_id).filter(Boolean).slice(0, 200);
  }

  // ─── Render final data ───────────────────────────────────────────────────

  function renderData({ balRes, itemsRes, statsRes, callsRes, chatsRes, finRes }) {
    const wrap = document.getElementById('avMetrics');
    if (!wrap) return;

    const fin      = _processFin(balRes, finRes);
    const listings = _processListings(itemsRes);
    const stats    = _processStats(statsRes);
    const calls    = _processCalls(callsRes);
    const chats    = _processChats(chatsRes);

    const groups = [
      _groupFinance(fin),
      _groupListings(listings),
      _groupPerf(stats, fin),
      _groupCalls(calls),
      _groupChats(chats),
      _groupOther(stats),
    ];

    wrap.innerHTML = groups.map(_renderGroup).join('');
  }

  function _renderGroup({ title, cards }) {
    return `
      <div class="av-group">
        <div class="av-group-head"><div class="av-group-title">${title}</div></div>
        <div class="av-cards">${cards.map(_renderCard).join('')}</div>
      </div>`;
  }

  function _renderCard({ val, label, cls = 'c-na', errTitle }) {
    const titleAttr = errTitle ? ` title="${esc(errTitle)}"` : '';
    return `<div class="av-card"${titleAttr}>
      <div class="av-val ${cls}">${val}</div>
      <div class="av-lbl">${label}</div>
    </div>`;
  }

  // ─── Data processors ─────────────────────────────────────────────────────

  function _processFin(balRes, finRes) {
    const out = {};

    // Баланс из /cpa/v2/balances/
    if (balRes && !balRes._error) {
      // Пробуем разные возможные структуры ответа
      out.wallet  = balRes.real         ?? balRes.balance?.real    ?? balRes.wallet          ?? null;
      out.bonus   = balRes.bonus        ?? balRes.balance?.bonus   ?? null;
      out.advance = balRes.advance?.real ?? balRes.advance          ?? null;
    } else {
      out._balErr = balRes?._error;
    }

    // Финансовая статистика из /cpa/v1/statistics/
    if (finRes && !finRes._error) {
      const items = finRes.result?.items || finRes.items || [];
      let expenses = 0, cpa = 0, services = 0, commission = 0,
          bonuses = 0, minAdv = 0, delivery = 0;

      for (const item of items) {
        // Пробуем разные имена полей (API может возвращать по-разному)
        expenses   += item.sum             || item.total            || 0;
        cpa        += item.sumSale         || item.cpa              || item.sum_sale       || 0;
        services   += item.sumService      || item.services         || item.sum_service    || 0;
        commission += item.sumCommission   || item.commission       || item.sum_commission || 0;
        bonuses    += item.sumBonus        || item.bonuses          || item.sum_bonus      || 0;
        minAdv     += item.sumMinimalAdvance || item.minAdvance     || item.min_advance    || 0;
        delivery   += item.sumDelivery     || item.delivery         || item.sum_delivery   || 0;
      }

      if (items.length > 0) {
        out.expenses   = expenses;
        out.cpa        = cpa;
        out.services   = services;
        out.commission = commission;
        out.bonuses    = bonuses;
        out.minAdv     = minAdv;
        out.delivery   = delivery;
      }
    } else {
      out._finErr = finRes?._error;
    }

    return out;
  }

  function _processListings(itemsRes) {
    if (!itemsRes || itemsRes._error) return { _error: itemsRes?._error };
    const items = itemsRes.items || itemsRes.resources || [];
    const total = itemsRes.total || items.length;
    // Считаем продвигаемые — любые с признаком VAS / promotion
    const promoted = items.filter(i =>
      i.vas_type || i.promotion || i.isPromoted || i.status === 'promoted' ||
      (i.services && i.services.length > 0)
    ).length;
    return { total, promoted };
  }

  function _processStats(statsRes) {
    if (!statsRes || statsRes._error) return { _error: statsRes?._error };
    const items = statsRes.result?.items || statsRes.items || [];
    let views = 0, uniqViews = 0, contacts = 0, favorites = 0;
    for (const item of items) {
      for (const s of (item.stats || [])) {
        views     += s.views         || 0;
        uniqViews += s.uniqViews     || 0;
        contacts  += s.uniqContacts  || 0;
        favorites += s.uniqFavorites || 0;
      }
    }
    return { views, uniqViews, contacts, favorites };
  }

  function _processCalls(callsRes) {
    if (!callsRes || callsRes._error) return { _error: callsRes?._error };
    // Пробуем разные ключи в ответе
    const calls = callsRes.calls || callsRes.result?.calls || callsRes.items || [];
    const total = calls.length;
    const answered = calls.filter(c =>
      (c.talk_duration > 0) || c.status === 'success' || c.status === 'answered'
    ).length;
    const missed = total - answered;
    const avgWait = total > 0
      ? calls.reduce((s, c) => s + (c.wait_duration || c.waiting_duration || 0), 0) / total
      : 0;
    const answ = calls.filter(c => (c.talk_duration || 0) > 0);
    const avgDur = answ.length > 0
      ? answ.reduce((s, c) => s + c.talk_duration, 0) / answ.length
      : 0;
    return { total, answered, missed, avgWait, avgDur };
  }

  function _processChats(chatsRes) {
    if (!chatsRes || chatsRes._error) return { _error: chatsRes?._error };
    const chats = chatsRes.chats || chatsRes.result?.chats || [];
    return { total: chats.length };
  }

  // ─── Group builders ───────────────────────────────────────────────────────

  function _groupFinance(f) {
    const be = f._balErr, fe = f._finErr;
    const rc  = (v, e) => ({ val: e ? '—' : (v !== undefined ? fmtRub(v) : '—'), label: '', cls: 'c-rub', errTitle: e });
    return {
      title: '💰 Финансы',
      cards: [
        { ...rc(f.wallet,   be), label: 'Баланс кошелька' },
        { ...rc(f.advance,  be), label: 'Баланс аванса' },
        { val: f._finErr ? '—' : (f.expenses !== undefined ? fmtRub(f.expenses) : '—'), label: 'Итого расходы',    cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.cpa      !== undefined ? fmtRub(f.cpa)      : '—'), label: 'Сумма за ЦД',      cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.services !== undefined ? fmtRub(f.services) : '—'), label: 'Доп услуги',       cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.commission !== undefined ? fmtRub(f.commission) : '—'), label: 'Комиссия',     cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.bonuses  !== undefined ? fmtRub(f.bonuses)  : '—'), label: 'Бонусы',           cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.minAdv   !== undefined ? fmtRub(f.minAdv)   : '—'), label: 'Мин. аванс',       cls: 'c-rub', errTitle: fe },
        { val: f._finErr ? '—' : (f.delivery !== undefined ? fmtRub(f.delivery) : '—'), label: 'Авито доставка',   cls: 'c-rub', errTitle: fe },
      ],
    };
  }

  function _groupListings(l) {
    const e = l._error;
    return {
      title: '📋 Объявления',
      cards: [
        { val: e ? '—' : fmtNum(l.total),    label: 'Всего объявлений',  cls: 'c-num', errTitle: e },
        { val: e ? '—' : fmtNum(l.promoted), label: 'На продвижении',    cls: 'c-num', errTitle: e },
      ],
    };
  }

  function _groupPerf(s, fin) {
    const e = s._error;
    const views     = s.views     || 0;
    const uniqViews = s.uniqViews || 0;
    const contacts  = s.contacts  || 0;

    const cvr1 = views > 0     ? (uniqViews / views    * 100) : null;
    const cvr2 = uniqViews > 0 ? (contacts  / uniqViews * 100) : null;

    const exp = fin.expenses;
    const costView    = (exp && uniqViews > 0) ? exp / uniqViews : null;
    const costContact = (exp && contacts  > 0) ? exp / contacts  : null;

    return {
      title: '📊 Показатели эффективности',
      cards: [
        { val: e ? '—' : fmtNum(views),          label: 'Показы',                    cls: 'c-num', errTitle: e },
        { val: fmtPct(cvr1),                      label: 'Конверсия в просмотр',      cls: 'c-pct' },
        { val: e ? '—' : fmtNum(uniqViews),       label: 'Просмотры',                 cls: 'c-num', errTitle: e },
        { val: fmtPct(cvr2),                      label: 'Конверсия в контакт',       cls: 'c-pct' },
        { val: e ? '—' : fmtNum(contacts),        label: 'Контакты',                  cls: 'c-num', errTitle: e },
        { val: '—',                               label: 'Конверсия в заявку',        cls: 'c-na'  }, // требует CRM
        { val: '—',                               label: 'Заявки',                   cls: 'c-na'  }, // требует CRM
        { val: costView    ? fmtRub(costView)    : '—', label: 'Стоимость просмотра',  cls: 'c-rub' },
        { val: costContact ? fmtRub(costContact) : '—', label: 'Стоимость контакта',   cls: 'c-rub' },
        { val: '—',                               label: 'Стоимость заявки',          cls: 'c-na'  }, // требует CRM
      ],
    };
  }

  function _groupCalls(c) {
    const e = c._error;
    return {
      title: '📞 Звонки',
      cards: [
        { val: e ? '—' : fmtNum(c.total),    label: 'Звонки всего',          cls: 'c-num',  errTitle: e },
        { val: e ? '—' : fmtNum(c.answered), label: 'Отвечено',              cls: 'c-num',  errTitle: e },
        { val: e ? '—' : fmtNum(c.missed),   label: 'Пропущено',             cls: c.missed > 0 ? 'c-num' : 'c-num', errTitle: e },
        { val: e ? '—' : fmtTime(c.avgWait), label: 'Ср. ожидание',          cls: 'c-time', errTitle: e },
        { val: e ? '—' : fmtTime(c.avgDur),  label: 'Ср. продолжительность', cls: 'c-time', errTitle: e },
      ],
    };
  }

  function _groupChats(c) {
    const e = c._error;
    return {
      title: '💬 Чаты и сообщения',
      cards: [
        { val: e ? '—' : fmtNum(c.total), label: 'Чаты всего',               cls: 'c-num', errTitle: e },
        // Детальная статистика требует дополнительных запросов per-chat
        { val: '—', label: 'Ср. время первого ответа', cls: 'c-na' },
        { val: '—', label: 'Ср. время ответов',        cls: 'c-na' },
        { val: '—', label: 'Сообщений на 1 чат',       cls: 'c-na' },
      ],
    };
  }

  function _groupOther(s) {
    const e = s._error;
    return {
      title: '⭐ Прочее',
      cards: [
        { val: e ? '—' : fmtNum(s.favorites), label: 'Избранные',          cls: 'c-num', errTitle: e },
        // Эти метрики требуют дополнительных эндпоинтов (/ratings/v1, рассылки)
        { val: '—', label: 'Новые отзывы',          cls: 'c-na' },
        { val: '—', label: 'Рассылок отправлено',   cls: 'c-na' },
        { val: '—', label: 'Рассылок ознакомились', cls: 'c-na' },
        { val: '—', label: 'Рассылок принято',      cls: 'c-na' },
      ],
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {

    onActivate() {
      injectStyles();
      render();
    },

    async connect() {
      const idEl  = document.getElementById('aClientId');
      const secEl = document.getElementById('aClientSecret');
      const btn   = document.getElementById('aConnectBtn');
      const errEl = document.getElementById('aConnectErr');

      const clientId = idEl?.value?.trim();
      const secret   = secEl?.value?.trim();

      if (!clientId || !secret) {
        if (errEl) { errEl.textContent = 'Заполните Client ID и Client Secret'; errEl.classList.add('show'); }
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Подключение…'; }
      if (errEl) errEl.classList.remove('show');

      try {
        const user = await avitoAPI.connect(clientId, secret);
        userId      = user.id || user.user_id;
        userProfile = user;
        renderDashboard(document.getElementById('screen-avito'));
        // loadAndRender() вызывается внутри renderDashboard
      } catch (e) {
        if (btn)  { btn.disabled = false; btn.textContent = 'Подключить профиль'; }
        if (errEl){ errEl.textContent = e.message; errEl.classList.add('show'); }
      }
    },

    disconnect() {
      if (!confirm('Отключить профиль Авито? Учётные данные будут удалены из браузера.')) return;
      avitoAPI.clearAll();
      userId      = null;
      userProfile = null;
      const screen = document.getElementById('screen-avito');
      if (screen) renderConnectForm(screen);
    },

    refresh() {
      loadAndRender();
    },

    setPeriod(p) {
      if (p === currentPeriod) return;
      currentPeriod = p;
      // Обновляем активную кнопку
      document.querySelectorAll('.av-period-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === PERIOD_LABELS[p]);
      });
      loadAndRender();
    },

  };
})();
