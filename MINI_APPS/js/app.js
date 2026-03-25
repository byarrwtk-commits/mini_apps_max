/**
 * СНТ Берёзка-4 — Мини-приложение MAX
 * Общая логика: верификация пользователя, запросы к n8n API
 */

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================
const CONFIG = {
  API_URL:     'https://vibe.umnode.ru/webhook/50ee1e3b-1132-4649-84a2-b25a92a0711c',
  STORAGE_KEY: 'snt_berezka_user',
  NEWS_CACHE_KEY: 'snt_berezka_news',
  NEWS_CACHE_TTL: 5 * 60 * 1000, // 5 минут
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
};

// ============================================================
// УТИЛИТЫ
// ============================================================

function getMaxUserId() {
  if (window.MaxMiniApp && window.MaxMiniApp.getUserId) {
    return String(window.MaxMiniApp.getUserId());
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('user_id')) return params.get('user_id');
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    if (hashParams.get('user_id')) return hashParams.get('user_id');
  }
  return 'test_user_' + Date.now();
}

function saveUser(data) {
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
}

function getUser() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function showLoader(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
}

function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="alert alert-error">${message}</div>`;
}

// ============================================================
// КЭШ НОВОСТЕЙ (localStorage + TTL)
// ============================================================

function saveNewsCache(newsArray) {
  try {
    localStorage.setItem(CONFIG.NEWS_CACHE_KEY, JSON.stringify({
      ts:   Date.now(),
      data: newsArray
    }));
  } catch {}
}

function getNewsCache() {
  try {
    const raw = localStorage.getItem(CONFIG.NEWS_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CONFIG.NEWS_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

// ============================================================
// API — запросы к n8n MINI_APP_ENGINE (с retry)
// ============================================================

async function apiCall(action, payload = {}, retries = CONFIG.RETRY_COUNT) {
  const userId = getMaxUserId();
  const body = { action, user_id: userId, platform: 'max', ...payload };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();

    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY * attempt));
    }
  }
}

// ============================================================
// ПУБЛИЧНОЕ API
// ============================================================

async function checkUser() {
  return apiCall('check_user');
}

/**
 * Получить новости. Использует кэш (5 мин), если свежий.
 * @param {boolean} forceRefresh - игнорировать кэш
 */
async function getNews(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getNewsCache();
    if (cached) return cached;
  }
  const data = await apiCall('get_news');
  const items = Array.isArray(data) ? data : (data.news || []);
  saveNewsCache(items);
  return items;
}

async function getCabinet() {
  return apiCall('get_cabinet');
}

async function registerUser(plot, surname, phone) {
  return apiCall('register', { plot, surname, phone });
}

/**
 * Получить историю платежей пользователя.
 * @returns {{ registered: boolean, plot_number?: string, payments: Array }}
 */
async function getPayments() {
  return apiCall('get_payments');
}

/**
 * Обновить номер телефона в реестре.
 * @param {string} phone - новый номер телефона
 * @returns {{ success: boolean }}
 */
async function updateContact(phone) {
  return apiCall('update_contact', { phone });
}

// ============================================================
// ЭКСПОРТ (доступно в HTML-страницах через window)
// ============================================================
window.SNT = {
  CONFIG,
  getMaxUserId,
  saveUser,
  getUser,
  formatDate,
  showLoader,
  showError,
  checkUser,
  getNews,
  getCabinet,
  registerUser,
  getPayments,
  updateContact,
};
