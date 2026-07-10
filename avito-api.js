'use strict';

/**
 * AvitoAPI — обёртка над Авито API (OAuth2 client_credentials).
 *
 * CORS: Авито API не поддерживает прямые запросы из браузера.
 * При работе на localhost автоматически используется локальный прокси:
 *   node proxy.js   (запустить один раз, держать открытым)
 *
 * Прокси слушает http://localhost:8080 и пробрасывает запросы на api.avito.ru.
 */

// CORS: Авито API не поддерживает прямые запросы из браузера.
// • localhost → /api/* локального server.js (node proxy.js).
// • прод → Supabase Edge Function avito-proxy (серверный прокси, обходит CORS).
const _SB_PROXY = 'https://rwpmjaqghekeyghdnkch.supabase.co/functions/v1/avito-proxy';
const _SB_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cG1qYXFnaGVrZXlnaGRua2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTc4NjQsImV4cCI6MjA5Njc5Mzg2NH0.ktn9D3Ey--dURTRM-dfKsRriEtDx_5xKapQwi-fz2_U';
const _IS_LOCAL = (() => {
  try { const h = window.location.hostname; return h === 'localhost' || h === '127.0.0.1'; } catch (_) { return false; }
})();
const _AVITO_BASE = _IS_LOCAL ? (window.location.origin + '/api') : _SB_PROXY;

class AvitoAPI {
  // suffix — уникальный суффикс для изоляции ключей разных клиентов в localStorage
  constructor(suffix = '') {
    this.base     = _AVITO_BASE;
    this.proxy    = !_IS_LOCAL;
    this.TOKEN_KEY = 'avito_token_v1' + (suffix ? '_' + suffix : '');
    this.CREDS_KEY = 'avito_creds_v1' + (suffix ? '_' + suffix : '');
  }

  // ─── Credentials ──────────────────────────────────────────────────────────

  saveCreds(clientId, clientSecret) {
    try {
      localStorage.setItem(this.CREDS_KEY, JSON.stringify({ clientId, clientSecret }));
    } catch (_) {}
  }

  loadCreds() {
    try {
      const raw = localStorage.getItem(this.CREDS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  hasCreds() {
    return this.loadCreds() !== null;
  }

  clearAll() {
    try {
      localStorage.removeItem(this.CREDS_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (_) {}
  }

  // ─── Token management ─────────────────────────────────────────────────────

  _getCachedToken() {
    try {
      const raw = localStorage.getItem(this.TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      // Считаем токен действительным если до истечения > 2 минуты
      if (t && t.exp > Date.now() + 120_000) return t.tok;
    } catch (_) {}
    return null;
  }

  async _fetchNewToken(clientId, clientSecret) {
    let res;
    try {
      const tokenHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (this.proxy) tokenHeaders['apikey'] = _SB_ANON;
      res = await fetch(`${this.base}/token`, {
        method: 'POST',
        headers: tokenHeaders,
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
      });
    } catch (e) {
      throw new Error(
        `Не удалось подключиться к Авито API.\n` +
        `Если видите CORS-ошибку — откройте приложение через HTTP-сервер (npx serve .), а не напрямую как файл.\n` +
        `Технически: ${e.message}`
      );
    }

    if (!res.ok) {
      let msg = `Ошибка авторизации: ${res.status}`;
      try {
        const j = await res.json();
        msg = j.error_description || j.error || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    const data = await res.json();
    // Avito может вернуть 200 с телом-ошибкой при неверных ключах — обрабатываем явно
    if (!data || !data.access_token) {
      throw new Error(data && (data.error_description || data.error)
        ? `${data.error_description || data.error}. Проверьте client_id и client_secret.`
        : 'Не удалось получить токен. Проверьте client_id и client_secret.');
    }
    const record = {
      tok: data.access_token,
      exp: Date.now() + (data.expires_in - 300) * 1000,  // -5 мин запас
    };
    try { localStorage.setItem(this.TOKEN_KEY, JSON.stringify(record)); } catch (_) {}
    return data.access_token;
  }

  async _getToken() {
    const cached = this._getCachedToken();
    if (cached) return cached;
    const creds = this.loadCreds();
    if (!creds) throw new Error('Нет сохранённых учётных данных. Подключите профиль.');
    return this._fetchNewToken(creds.clientId, creds.clientSecret);
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  /**
   * Выполняет запрос с токеном. При 401 сбрасывает токен и делает одну повторную попытку.
   */
  async _req(method, path, body = null, tokenOverride = null, _retried = false) {
    const token = tokenOverride || await this._getToken();

    const headers = { 'Content-Type': 'application/json' };
    if (this.proxy) {
      // Через Supabase-прокси: токен Avito шлём в x-avito-authorization,
      // чтобы шлюз Supabase не перехватывал Authorization.
      headers['apikey'] = _SB_ANON;
      headers['x-avito-authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const opts = { method, headers };
    if (body !== null) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${this.base}${path}`, opts);
    } catch (e) {
      throw new Error(`Нет доступа к серверу. Проверьте интернет или используйте прокси. (${e.message})`);
    }

    if ((res.status === 401 || res.status === 403) && !_retried && !tokenOverride) {
      try { localStorage.removeItem(this.TOKEN_KEY); } catch (_) {}
      return this._req(method, path, body, null, true);
    }

    if (!res.ok) {
      let msg = `Ошибка ${res.status}`;
      try {
        const j = await res.json();
        msg = j.error?.message || j.message || j.error_description || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    return res.json().catch(() => ({}));
  }

  // ─── Авторизация + проверка профиля ──────────────────────────────────────

  /**
   * Выполняет вход: получает токен, сохраняет credentials, возвращает профиль пользователя.
   */
  async connect(clientId, clientSecret) {
    const token = await this._fetchNewToken(clientId, clientSecret);
    this.saveCreds(clientId, clientSecret);
    const user = await this._req('GET', '/core/v1/accounts/self', null, token);
    return user;
  }

  // ─── Endpoints ────────────────────────────────────────────────────────────

  /** Информация о текущем пользователе */
  getSelf() {
    return this._req('GET', '/core/v1/accounts/self');
  }

  /**
   * Баланс кошелька
   * GET /core/v1/accounts/{user_id}/balance
   */
  getBalances(userId) {
    return this._req('GET', `/core/v1/accounts/${userId}/balance`);
  }

  /**
   * Список активных объявлений
   * GET /core/v1/accounts/{user_id}/items?status=active&per_page=100
   */
  getItems(userId) {
    return this._req('GET', `/core/v1/accounts/${userId}/items?status=active&per_page=100`);
  }

  /**
   * Статистика по объявлениям (просмотры, контакты, избранные)
   * POST /stats/v1/accounts/{user_id}/items
   * @param {number} userId
   * @param {string} dateFrom  YYYY-MM-DD
   * @param {string} dateTo    YYYY-MM-DD
   * @param {number[]} itemIds список ID объявлений (макс 200)
   */
  getItemsStats(userId, dateFrom, dateTo, itemIds = []) {
    const reqBody = {
      dateFrom,
      dateTo,
      fields: ['uniqViews', 'uniqContacts', 'uniqFavorites', 'views'],
    };
    if (itemIds.length > 0) reqBody.itemIds = itemIds.slice(0, 200);
    return this._req('POST', `/stats/v1/accounts/${userId}/items`, reqBody);
  }

  /**
   * Статистика звонков
   * GET /calltracking/v1/calls/?dateTimeFrom=...&dateTimeTo=...
   * @param {string} dateTimeFrom  YYYY-MM-DDTHH:MM:SS
   * @param {string} dateTimeTo    YYYY-MM-DDTHH:MM:SS
   */
  getCalls(dateTimeFrom, dateTimeTo) {
    const p = new URLSearchParams({ dateTimeFrom, dateTimeTo });
    return this._req('GET', `/calltracking/v1/calls/?${p}`);
  }

  /**
   * Список чатов
   * GET /messenger/v2/accounts/{user_id}/chats
   * Примечание: детальная статистика (время ответа, сообщений на чат)
   * требует дополнительных запросов per-chat — здесь только count.
   */
  getChats(userId) {
    return this._req('GET', `/messenger/v2/accounts/${userId}/chats?limit=100`);
  }

  /**
   * Финансовая статистика (расходы по категориям)
   * GET /cpa/v2/statistics/?dateFrom=...&dateTo=...
   */
  getFinancialStats(userId, dateFrom, dateTo) {
    const p = new URLSearchParams({ dateFrom, dateTo });
    return this._req('GET', `/cpa/v2/statistics/?${p}`);
  }
}

// Singleton для обратной совместимости (глобальный экран Авито не используется)
const avitoAPI = new AvitoAPI();

// Фабрика: создаёт изолированный экземпляр API для конкретного клиента приложения
function makeAvitoAPI(appClientId) {
  return new AvitoAPI('c' + appClientId);
}
