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

// Автоматически переключаемся на прокси при работе через localhost
const _AVITO_BASE = (() => {
  try {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
      console.log('[AvitoAPI] режим: прокси → http://127.0.0.1:9099');
      return 'http://127.0.0.1:9099';
    }
  } catch (_) {}
  console.log('[AvitoAPI] режим: прямой запрос → https://api.avito.ru');
  return 'https://api.avito.ru';
})();

class AvitoAPI {
  constructor() {
    this.base     = _AVITO_BASE;
    this.TOKEN_KEY = 'avito_token_v1';
    this.CREDS_KEY = 'avito_creds_v1';
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
      res = await fetch(`${this.base}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== null) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${this.base}${path}`, opts);
    } catch (e) {
      throw new Error(`Нет доступа к серверу. Проверьте интернет или используйте прокси. (${e.message})`);
    }

    if (res.status === 401 && !_retried) {
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
   * Баланс кошелька и аванса
   * GET /cpa/v2/balances/
   */
  getBalances() {
    return this._req('GET', '/cpa/v2/balances/');
  }

  /**
   * Список активных объявлений
   * GET /core/v1/items?status=active&per_page=100
   */
  getItems() {
    return this._req('GET', '/core/v1/items?status=active&per_page=100');
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
   * GET /cpa/v1/statistics/?dateFrom=...&dateTo=...
   */
  getFinancialStats(dateFrom, dateTo) {
    const p = new URLSearchParams({ dateFrom, dateTo });
    return this._req('GET', `/cpa/v1/statistics/?${p}`);
  }
}

// Singleton-экземпляр для использования в dashboard
const avitoAPI = new AvitoAPI();
