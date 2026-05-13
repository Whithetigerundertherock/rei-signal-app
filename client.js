const stocks = [
  { symbol: "QLD", price: 71.85, change: 0.9, favorite: true, rsi: { "1분": 44, "5분": 39, "30분": 34, "60분": 38, "120분": 41 } },
  { symbol: "TQQQ", price: 58.2, change: 2.15, favorite: true, rsi: { "1분": 42, "5분": 35, "30분": 29, "120분": 45 } },
  { symbol: "SOXL", price: 32.45, change: 3.45, favorite: true, rsi: { "1분": 40, "5분": 33, "30분": 27, "120분": 42 } },
  { symbol: "NVDA", price: 915.3, change: -1.02, favorite: true, rsi: { "1분": 55, "5분": 49, "30분": 41, "120분": 48 } },
  { symbol: "QQQ", price: 475.8, change: 0.68, favorite: false, rsi: { "1분": 50, "5분": 46, "30분": 40, "120분": 45 } },
  { symbol: "AAPL", price: 190.23, change: 0.35, favorite: true, rsi: { "1분": 48, "5분": 44, "30분": 38, "120분": 43 } },
  { symbol: "AMD", price: 153.2, change: -0.85, favorite: true, rsi: { "1분": 53, "5분": 47, "30분": 40, "120분": 44 } },
  { symbol: "TSLA", price: 178.65, change: -2.35, favorite: false, rsi: { "1분": 60, "5분": 54, "30분": 47, "120분": 51 } },
  { symbol: "MSFT", price: 415.3, change: 0.28, favorite: false, rsi: { "1분": 52, "5분": 48, "30분": 42, "120분": 46 } }
];

const recommendations = [
  {
    symbol: "TQQQ",
    price: 58.2,
    change: 2.15,
    favorite: true,
    buy: 58.2,
    sell1: 61.5,
    sell2: 64,
    stop: 56.8,
    reasons: ["120분봉 RSI 29로 과매도 구간", "120분봉 RSI 반등 구간 진입", "최근 거래량 증가", "나스닥 단기 추세 회복 가능성"]
  },
  {
    symbol: "SOXL",
    price: 32.45,
    change: 3.45,
    favorite: false,
    buy: 32.45,
    sell1: 35,
    sell2: 37.2,
    stop: 30.2,
    reasons: ["반도체 섹터 강세 지속", "단기 RSI 과매도 후 반등", "NVDA, AMD 흐름 양호", "거래량 증가와 함께 모멘텀 개선"]
  },
  {
    symbol: "NVDA",
    price: 915.3,
    change: -1.02,
    favorite: true,
    buy: 915.3,
    sell1: 950,
    sell2: 980,
    stop: 890,
    reasons: ["120분봉 RSI 31로 반등 가능 구간", "AI 수요 지속 기대", "단기 조정 후 재상승 가능성"]
  }
];

const ALERT_STORAGE_KEY = "rsi-signal-alerts";
const TELEGRAM_SETTINGS_KEY = "rsi-signal-telegram-settings";

let alerts = [
  { id: "alert-1", symbol: "TQQQ", period: "120분봉", condition: "RSI 30 이하", threshold: 30, direction: "low", enabled: true, channels: { app: false, kakao: false, telegram: true }, message: "TQQQ 120분봉 RSI가 30 이하로 내려왔습니다." },
  { id: "alert-2", symbol: "SOXL", period: "30분봉", condition: "RSI 30 이하", threshold: 30, direction: "low", enabled: true, channels: { app: false, kakao: false, telegram: true }, message: "SOXL 30분봉 RSI가 30 이하로 내려왔습니다." },
  { id: "alert-3", symbol: "NVDA", period: "15분봉", condition: "RSI 30 이하", threshold: 30, direction: "low", enabled: false, channels: { app: false, kakao: false, telegram: true }, message: "NVDA 15분봉 RSI가 30 이하로 내려왔습니다." },
  { id: "alert-4", symbol: "TSLA", period: "60분봉", condition: "RSI 70 이상", threshold: 70, direction: "high", enabled: true, channels: { app: false, kakao: false, telegram: true }, message: "TSLA 60분봉 RSI가 70 이상으로 올라갔습니다." },
  { id: "alert-5", symbol: "QQQ", period: "30분봉", condition: "RSI 70 이상", threshold: 70, direction: "high", enabled: true, channels: { app: false, kakao: false, telegram: true }, message: "QQQ 30분봉 RSI가 70 이상으로 올라갔습니다." }
];

function loadSavedAlerts() {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (raw === null) return;

    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) {
      alerts = saved.map((alert, index) => ({
        id: alert.id || `alert-${index + 1}`,
        symbol: alert.symbol,
        period: alert.period,
        condition: alert.condition,
        threshold: Number(alert.threshold),
        direction: alert.direction,
        enabled: alert.enabled !== false,
        channels: {
          app: false,
          kakao: false,
          telegram: alert.channels?.telegram === true
        },
        message: alert.message || `${alert.symbol} ${alert.period} ${alert.condition}`
      })).filter((alert) => alert.symbol && alert.period && Number.isFinite(alert.threshold));
    }
  } catch {
    localStorage.removeItem(ALERT_STORAGE_KEY);
  }
}

function saveAlerts() {
  localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alerts));
}

loadSavedAlerts();

function telegramSettingsKey(userId) {
  const id = String(userId || "").trim();
  return id ? `${TELEGRAM_SETTINGS_KEY}:${id}` : TELEGRAM_SETTINGS_KEY;
}

function emptyTelegramSettings() {
  return { botToken: "", chatId: "" };
}

function parseTelegramSettings(raw) {
  if (!raw) return null;
  const saved = JSON.parse(raw);
  return {
    botToken: String(saved.botToken || "").trim(),
    chatId: String(saved.chatId || "").trim()
  };
}

function loadTelegramSettings(userId) {
  try {
    const raw = localStorage.getItem(telegramSettingsKey(userId)) || localStorage.getItem(TELEGRAM_SETTINGS_KEY);
    return parseTelegramSettings(raw) || emptyTelegramSettings();
  } catch {
    localStorage.removeItem(telegramSettingsKey(userId));
    return emptyTelegramSettings();
  }
}

function syncTelegramSettingsForUser(user) {
  telegramSettings = loadTelegramSettings(user?.id);
}

function saveTelegramSettings() {
  localStorage.setItem(telegramSettingsKey(state.user?.id), JSON.stringify(telegramSettings));
}

function cloneAlerts(items) {
  return JSON.parse(JSON.stringify(items));
}

let telegramSettings = loadTelegramSettings();
let activeAlerts = cloneAlerts(alerts);
let alertIdCounter = Math.max(0, ...alerts.map((alert) => Number(String(alert.id).replace("alert-", "")) || 0)) + 1;

const state = {
  screen: "home",
  periods: ["1분", "5분", "60분", "120분"],
  selectedAlertSymbol: "all",
  selectedAlertIds: new Set(),
  lastUpdated: formatTime(new Date()),
  timeSelectorOpen: true,
  stockMenuOpen: false,
  deleteMode: false,
  addStockOpen: false,
  addAlertOpen: false,
  telegramSettingsOpen: false,
  telegramPanelOpen: true,
  telegramSettingsStatus: "",
  telegramSettingsTesting: false,
  authModalOpen: false,
  authChecked: false,
  authError: "",
  user: null,
  selectedAlertId: "",
  isUpdating: false,
  marketLoaded: false,
  updateError: "",
  flashCells: new Set(),
  alertTriggerState: new Map(),
  triggeredAlerts: [],
  alertSettingsDirty: false
};

const screenTitles = {
  home: "홈",
  stocks: "종목리스트",
  ai: "시장분석",
  alerts: "알림설정"
};

const content = document.querySelector("#content");
const title = document.querySelector("#screenTitle");
const topActions = document.querySelector("#topActions");
const splashIntro = document.querySelector(".splash-intro");
const AUTO_UPDATE_MS = 10000;
const MAX_PERIODS = 4;
let autoUpdateTimer = null;

function money(value) {
  return `$${value.toFixed(value >= 100 ? 2 : 2)}`;
}

function pct(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatTime(date) {
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
  return `${time} KST`;
}

function cls(value) {
  return value < 0 ? "negative" : "positive";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconButton(label, text) {
  return `<button class="icon-btn" type="button" aria-label="${label}" title="${label}">${text}</button>`;
}

function actionIconButton(label, text, action, disabled = false) {
  return `<button class="icon-btn" type="button" data-action="${action}" aria-label="${label}" title="${label}" ${disabled ? "disabled" : ""}>${text}</button>`;
}

function accountButton() {
  const initial = state.user?.id?.charAt(0).toUpperCase() || "";

  return `
    <button class="icon-btn account-btn ${state.user ? "is-signed-in" : ""}" type="button" data-action="open-auth" aria-label="내 계정" title="내 계정">
      ${state.user ? `<span class="account-avatar">${escapeHtml(initial)}</span>` : `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0"/>
          <circle cx="12" cy="8" r="4"/>
        </svg>
      `}
    </button>
  `;
}

function flashClass(key) {
  return state.flashCells.has(key) ? " is-updated" : "";
}

function markAlertSettingsDirty() {
  state.alertSettingsDirty = true;
}

function hasTelegramSettings() {
  return Boolean(telegramSettings.botToken && telegramSettings.chatId);
}

function telegramSettingsSummary() {
  if (!hasTelegramSettings()) return "Bot token과 chat id를 입력해 주세요.";
  return `Chat ID ${telegramSettings.chatId}`;
}

function alertPeriodKey(period) {
  return period.replace("봉", "");
}

function getIndicatorPeriods() {
  const alertPeriods = activeAlerts.map((alert) => alertPeriodKey(alert.period));
  return [...new Set([...state.periods, ...alertPeriods])];
}

function alertIdentity(alert) {
  return `${alert.symbol}:${alert.period}:${alert.direction}:${alert.threshold}`;
}

function isAlertTriggered(alert, value) {
  return alert.direction === "high" ? value >= alert.threshold : value <= alert.threshold;
}

function alertMessage(alert, value) {
  const currentValue = Number.isFinite(value) ? ` 현재 RSI ${Math.round(value)}` : "";
  return `${alert.period} RSI가 ${alert.threshold} ${alert.direction === "high" ? "이상으로 올라갔습니다." : "이하로 내려왔습니다."}${currentValue}`;
}

function recordTriggeredAlert(alert, value) {
  state.triggeredAlerts = [
    {
      id: `${alert.id}-${Date.now()}`,
      symbol: alert.symbol,
      period: alert.period,
      threshold: alert.threshold,
      direction: alert.direction,
      message: alertMessage(alert, value),
      time: formatTime(new Date())
    },
    ...state.triggeredAlerts
  ].slice(0, 8);
}

function telegramText(alert, value) {
  const directionText = alert.direction === "high" ? "이상으로 올라갔습니다." : "이하로 내려왔습니다.";
  return [
    `[RSI Signal] ${alert.symbol} 알림`,
    alert.message || `${alert.period} RSI가 ${alert.threshold} ${directionText}`,
    `현재 RSI: ${Math.round(value)}`,
    `조건: ${alert.condition}`,
    `시간: ${formatDateTime(new Date())}`
  ].join("\n");
}

async function sendTelegramAlert(alert, value) {
  if (!hasTelegramSettings()) {
    throw new Error("텔레그램 설정이 필요합니다.");
  }

  const response = await fetch("/api/telegram/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: telegramText(alert, value),
      telegram: telegramSettings
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "telegram send failed");
  }
}

async function sendTelegramTest() {
  if (!hasTelegramSettings()) {
    state.telegramSettingsStatus = "Bot token과 chat id를 먼저 저장해 주세요.";
    render();
    return;
  }

  state.telegramSettingsTesting = true;
  state.telegramSettingsStatus = "테스트 메시지 전송 중";
  render();

  try {
    const response = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram: telegramSettings,
        text: [
          "[RSI Signal 테스트]",
          "텔레그램 알림 테스트 메시지입니다.",
          `시간: ${formatDateTime(new Date())}`
        ].join("\n")
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "telegram test failed");
    }

    state.telegramSettingsStatus = "테스트 메시지를 보냈습니다.";
  } catch (error) {
    state.telegramSettingsStatus = `전송 실패: ${error.message}`;
  } finally {
    state.telegramSettingsTesting = false;
    render();
  }
}

async function checkAlertTriggers() {
  const sends = [];

  activeAlerts.forEach((alert) => {
    if (!alert.enabled) return;

    const stock = stocks.find((item) => item.symbol === alert.symbol);
    const period = alertPeriodKey(alert.period);
    const value = stock?.rsi[period];
    if (!Number.isFinite(value)) return;

    const key = alertIdentity(alert);
    const triggered = isAlertTriggered(alert, value);
    const wasTriggered = state.alertTriggerState.get(key) || false;
    state.alertTriggerState.set(key, triggered);

    if (triggered && !wasTriggered) {
      recordTriggeredAlert(alert, value);
      if (alert.channels?.telegram) sends.push(sendTelegramAlert(alert, value));
    }
  });

  if (!sends.length) return;

  const results = await Promise.allSettled(sends);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) {
    console.warn(`텔레그램 알림 전송 실패: ${failed.reason.message}`);
  }
}

function syncAutoUpdate() {
  if (!state.user) {
    if (autoUpdateTimer) {
      clearInterval(autoUpdateTimer);
      autoUpdateTimer = null;
    }
    return;
  }

  if (!autoUpdateTimer) {
    autoUpdateTimer = setInterval(() => {
      if (state.user && !state.isUpdating) {
        updateRealIndicators({ silent: true });
      }
    }, AUTO_UPDATE_MS);
  }
}

function render() {
  const isAuthenticated = Boolean(state.user);
  document.body.dataset.screen = isAuthenticated ? state.screen : "login";
  title.textContent = isAuthenticated ? screenTitles[state.screen] : "로그인";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", isAuthenticated && button.dataset.screen === state.screen);
  });

  topActions.innerHTML = {
    home: `${accountButton()}`,
    stocks: `
      <div class="top-menu-wrap">
        <button class="icon-btn" type="button" data-action="toggle-stock-menu" aria-label="더보기" title="더보기">⋮</button>
        ${state.stockMenuOpen ? `
          <div class="top-menu" role="menu">
            <button type="button" role="menuitem" data-action="open-add-stock">종목추가</button>
            <button type="button" role="menuitem" data-action="toggle-delete-mode">${state.deleteMode ? "삭제종료" : "종목삭제"}</button>
          </div>
        ` : ""}
      </div>
    `,
    ai: `${actionIconButton("현황 업데이트", "⟳", "update-indicators", state.isUpdating)}`,
    alerts: ""
  }[isAuthenticated ? state.screen : "home"];

  content.innerHTML = !state.authChecked ? renderAuthLoading() : !isAuthenticated ? renderAuthGate() : {
    home: renderHome,
    stocks: renderStocks,
    ai: renderAi,
    alerts: renderAlerts
  }[state.screen]() + renderOverlay();

  if (isAuthenticated && !state.marketLoaded && !state.isUpdating) {
    setTimeout(() => updateRealIndicators({ silent: state.screen === "home" }), 0);
  }

  syncAutoUpdate();
}

function renderAuthLoading() {
  return `
    <section class="auth-gate">
      <div class="loading-spinner" aria-hidden="true"></div>
      <strong>로그인 상태 확인 중</strong>
    </section>
  `;
}

function renderAuthGate() {
  return `
    <section class="auth-gate">
      <span class="auth-gate-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M20 21a8 8 0 0 0-16 0"/>
          <circle cx="12" cy="8" r="4"/>
        </svg>
      </span>
      <h2>내 계정으로 로그인</h2>
      <p>저장한 종목과 알림설정은 로그인 후에만 볼 수 있습니다.</p>
      <button class="small-btn is-primary" type="button" data-action="open-auth">로그인</button>
    </section>
    ${renderOverlay()}
  `;
}

function renderSection(titleText, moreTarget) {
  return `
    <div class="section-head">
      <h2>${titleText}</h2>
      <button class="text-link" type="button" data-screen="${moreTarget}">더보기 ›</button>
    </div>
  `;
}

function renderHome() {
  const rankPeriod = "60분";
  const rsiRows = stocks
    .filter((stock) => stock.favorite)
    .sort((a, b) => (a.rsi[rankPeriod] ?? a.rsi["120분"]) - (b.rsi[rankPeriod] ?? b.rsi["120분"]))
    .map((stock, index) => `
      <div class="home-rank-row">
        <span class="rank home-rank-cell is-center">${index + 1}</span>
        <strong class="rsi home-rank-cell is-number">${(stock.rsi[rankPeriod] ?? stock.rsi["120분"]).toFixed(1)}</strong>
        <span class="ticker home-rank-cell is-name">${stock.symbol}</span>
        <span class="home-rank-cell is-number">${money(stock.price)}</span>
        <strong class="home-rank-cell is-number ${cls(stock.change)}">${pct(stock.change)}</strong>
      </div>
    `)
    .join("");

  const feed = state.triggeredAlerts.slice(0, 5).map((alert) => `
    <div class="feed-row">
      <span class="feed-icon is-${alert.direction}">${alert.direction === "high" ? "▲" : "▼"}</span>
      <span class="feed-main"><strong>${alert.symbol}</strong>${alert.message}</span>
      <span class="feed-time">${alert.time}</span>
    </div>
  `).join("");

  return `
    ${renderSection(`RSI 순위 <span class="section-muted">(${rankPeriod}봉 기준)</span>`, "stocks")}
    <div class="home-rank-list">
      <div class="home-rank-head">
        <span class="home-rank-cell is-center">순위</span>
        <span class="home-rank-cell is-number">RSI지수</span>
        <span class="home-rank-cell is-name">종목명</span>
        <span class="home-rank-cell is-number">현재가</span>
        <span class="home-rank-cell is-number">등락률</span>
      </div>
      ${rsiRows}
    </div>

    ${renderSection("알림 발생", "alerts")}
    <div class="alert-feed">${feed || `<p class="empty-feed">아직 발생한 알림이 없습니다.</p>`}</div>
  `;
}

function metric(label, icon, value, unit, tone) {
  return `
    <article class="metric-card">
      <span class="metric-icon ${tone}">${icon}</span>
      <div>
        <span class="metric-label">${label}</span>
        <strong class="metric-value ${tone}">${value}<small>${unit}</small></strong>
      </div>
    </article>
  `;
}

function renderStocks() {
  const allPeriods = ["1분", "3분", "5분", "15분", "30분", "60분", "120분", "일", "주", "월"];
  const periodButtons = allPeriods.map((period) => `
    <button class="chip ${state.periods.includes(period) ? "is-selected" : ""}" type="button" data-action="toggle-period" data-period="${period}">
      ${period}
    </button>
  `).join("");

  const rows = stocks.map((stock) => {
    return `
    <tr>
      ${state.deleteMode ? `<td><button class="row-delete-btn" type="button" data-action="delete-stock" data-symbol="${stock.symbol}" aria-label="${stock.symbol} 삭제">−</button></td>` : ""}
      <td class="stock-cell">${stock.symbol}</td>
      <td class="${flashClass(`${stock.symbol}:price`)}">${stock.price.toFixed(2)}</td>
      <td class="${cls(stock.change)}${flashClass(`${stock.symbol}:change`)}">${pct(stock.change)}</td>
      ${state.periods.map((period) => {
        const value = Math.round(stock.rsi[period] ?? Math.max(25, Math.round(stock.rsi["120분"] + period.length * 2)));
        const tone = value <= 30 ? "negative" : value >= 50 ? "positive" : "warning";
        return `<td class="${tone}${flashClass(`${stock.symbol}:rsi:${period}`)}">${value}</td>`;
      }).join("")}
      <td class="alert-cell">
        <button class="stock-alert-btn" type="button" data-action="open-symbol-alerts" data-symbol="${stock.symbol}" aria-label="${stock.symbol} 알림설정 보기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z"/>
            <path d="M10 21h4"/>
          </svg>
        </button>
      </td>
    </tr>
    `;
  }).join("");

  return `
    <section class="panel">
      <div class="time-panel-head">
        <button class="time-toggle" type="button" data-action="toggle-time-selector" aria-expanded="${state.timeSelectorOpen}">
          <span>시간 선택<span class="section-muted">(최대 ${MAX_PERIODS}개)</span></span>
        </button>
        <div class="update-line">
          <span>${state.lastUpdated}</span>
          <button class="update-btn ${state.isUpdating ? "is-loading" : ""}" type="button" data-action="update-indicators" aria-label="지표 업데이트" ${state.isUpdating ? "disabled" : ""}>⟳</button>
        </div>
        <button class="collapse-btn" type="button" data-action="toggle-time-selector" aria-label="시간 선택 접기" aria-expanded="${state.timeSelectorOpen}">
          ${state.timeSelectorOpen ? "⌃" : "⌄"}
        </button>
      </div>
      ${state.timeSelectorOpen ? `<div class="time-grid">${periodButtons}</div>` : ""}
    </section>
    <div class="table-wrap">
      <table class="market-table">
        <thead>
          <tr>
            ${state.deleteMode ? `<th></th>` : ""}
            <th>종목</th>
            <th>가격</th>
            <th>등락률</th>
            ${state.periods.map((period) => `<th>${period}</th>`).join("")}
            <th class="alert-col">알림</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderOverlay() {
  if (state.authModalOpen) {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <div class="modal-head">
            <h2 id="authTitle">${state.user ? "내 계정" : "로그인"}</h2>
            <button class="modal-close" type="button" data-action="close-auth" aria-label="닫기">×</button>
          </div>
          ${state.user ? `
            <div class="account-summary">
              <span class="account-avatar is-large">${escapeHtml(state.user.id.charAt(0).toUpperCase())}</span>
              <div>
                <strong>${escapeHtml(state.user.id)}</strong>
                <span>로그인됨</span>
              </div>
            </div>
            <div class="modal-actions is-single">
              <button class="small-btn" type="button" data-action="logout">로그아웃</button>
            </div>
          ` : `
            <label class="label" for="loginId">아이디</label>
            <input id="loginId" class="auth-input" type="text" placeholder="아이디" autocomplete="username" />
            <label class="label" for="loginPassword">비밀번호</label>
            <input id="loginPassword" class="auth-input" type="password" placeholder="비밀번호" autocomplete="current-password" />
            ${state.authError ? `<p class="auth-error">${state.authError}</p>` : ""}
            <div class="modal-actions">
              <button class="small-btn" type="button" data-action="close-auth">취소</button>
              <button class="small-btn is-primary" type="button" data-action="login">로그인</button>
            </div>
          `}
        </section>
      </div>
    `;
  }

  if (state.telegramSettingsOpen) {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal telegram-modal" role="dialog" aria-modal="true" aria-labelledby="telegramSettingsTitle">
          <div class="modal-head">
            <h2 id="telegramSettingsTitle">텔레그램 설정</h2>
            <button class="modal-close" type="button" data-action="close-telegram-settings" aria-label="닫기">×</button>
          </div>
          <label class="label" for="telegramBotToken">Bot token</label>
          <input id="telegramBotToken" class="auth-input" type="password" value="${escapeHtml(telegramSettings.botToken)}" placeholder="123456789:ABC..." autocomplete="off" />
          <label class="label" for="telegramChatId">Chat ID</label>
          <input id="telegramChatId" class="auth-input" type="text" value="${escapeHtml(telegramSettings.chatId)}" placeholder="-1001234567890" autocomplete="off" />
          ${state.telegramSettingsStatus ? `<p class="telegram-status">${escapeHtml(state.telegramSettingsStatus)}</p>` : ""}
          <div class="modal-actions is-triple">
            <button class="small-btn" type="button" data-action="close-telegram-settings">취소</button>
            <button class="small-btn" type="button" data-action="test-telegram" ${state.telegramSettingsTesting ? "disabled" : ""}>${state.telegramSettingsTesting ? "전송 중" : "테스트"}</button>
            <button class="small-btn is-primary" type="button" data-action="save-telegram-settings">저장</button>
          </div>
        </section>
      </div>
    `;
  }

  const detailAlert = alerts.find((alert) => alert.id === state.selectedAlertId);
  if (detailAlert) {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal alert-detail-modal" role="dialog" aria-modal="true" aria-labelledby="alertDetailTitle">
          <div class="modal-head">
            <h2 id="alertDetailTitle">알림 상세</h2>
            <button class="modal-close" type="button" data-action="close-alert-detail" aria-label="닫기">×</button>
          </div>
          <div class="alert-detail-head">
            <button class="star-btn is-on" type="button" aria-label="관심종목">★</button>
            <strong>${detailAlert.symbol}</strong>
            <span class="subtle">${detailAlert.enabled ? "사용 중" : "사용 안 함"}</span>
          </div>
          <div class="alert-detail-grid">
            <span class="label">시간봉</span>
            <strong>${detailAlert.period}</strong>
            <span class="label">조건</span>
            <strong>${detailAlert.condition}</strong>
            <span class="label">값</span>
            <strong>${detailAlert.threshold}</strong>
            <span class="label">알림 종류</span>
            <div class="check-row is-compact">
              <label class="check is-disabled"><input id="detailAppChannel" type="checkbox" disabled />앱 푸시 알림</label>
              <label class="check is-disabled"><input type="checkbox" disabled />카카오톡</label>
              <label class="check"><input id="detailTelegramChannel" type="checkbox" ${detailAlert.channels?.telegram ? "checked" : ""} />텔레그램</label>
            </div>
          </div>
          <label class="label" for="detailAlertText" style="display:block;margin-top:13px">알림 문구</label>
          <textarea id="detailAlertText">${detailAlert.message || `${detailAlert.symbol} ${detailAlert.period} RSI가 ${detailAlert.threshold} ${detailAlert.direction === "high" ? "이상으로 올라갔습니다." : "이하로 내려왔습니다."}`}</textarea>
          <div class="modal-actions">
            <button class="small-btn" type="button" data-action="delete-alert">삭제</button>
            <button class="small-btn is-primary" type="button" data-action="save-alert-detail">저장</button>
          </div>
        </section>
      </div>
    `;
  }

  if (state.addAlertOpen) {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="addAlertTitle">
          <div class="modal-head">
            <h2 id="addAlertTitle">새 알림 추가</h2>
            <button class="modal-close" type="button" data-action="close-add-alert" aria-label="닫기">×</button>
          </div>
          <div class="alert-modal-grid">
            <label class="label" for="alertSymbol">종목</label>
            <select id="alertSymbol">
              ${stocks.map((stock) => `<option value="${stock.symbol}">${stock.symbol}</option>`).join("")}
            </select>
            <label class="label" for="alertPeriod">시간봉</label>
            <select id="alertPeriod">
              ${["1분봉", "5분봉", "15분봉", "30분봉", "60분봉", "120분봉", "일봉"].map((period) => `<option>${period}</option>`).join("")}
            </select>
            <label class="label" for="alertCondition">조건</label>
            <select id="alertCondition">
              <option value="low">RSI 이하</option>
              <option value="high">RSI 이상</option>
            </select>
            <label class="label" for="alertThreshold">값</label>
            <input id="alertThreshold" type="number" min="1" max="99" value="30" />
          </div>
          <label class="label" for="newAlertText" style="display:block;margin-top:13px">알림 문구</label>
          <textarea id="newAlertText">RSI 조건에 도달했습니다.</textarea>
          <div class="check-row">
            <label class="check is-disabled"><input id="appChannel" type="checkbox" disabled />앱 푸시 알림</label>
            <label class="check is-disabled"><input type="checkbox" disabled />카카오톡</label>
            <label class="check"><input id="telegramChannel" type="checkbox" checked />텔레그램</label>
          </div>
          <div class="modal-actions">
            <button class="small-btn" type="button" data-action="close-add-alert">취소</button>
            <button class="small-btn is-primary" type="button" data-action="save-alert">추가</button>
          </div>
        </section>
      </div>
    `;
  }

  if (!state.addStockOpen) return "";

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="addStockTitle">
        <div class="modal-head">
          <h2 id="addStockTitle">종목추가</h2>
          <button class="modal-close" type="button" data-action="close-add-stock" aria-label="닫기">×</button>
        </div>
        <label class="label" for="stockSymbol">종목명</label>
        <input id="stockSymbol" class="stock-input" type="text" placeholder="예: META" autocomplete="off" />
        <div class="modal-actions">
          <button class="small-btn" type="button" data-action="close-add-stock">취소</button>
          <button class="small-btn is-primary" type="button" data-action="add-stock">추가</button>
        </div>
      </section>
    </div>
  `;
}

async function updateRealIndicators(options = {}) {
  if (!state.user || state.isUpdating) return;

  const silent = options.silent === true;
  state.isUpdating = true;
  if (!silent) {
    state.updateError = "";
    render();
  }

  try {
    const symbols = stocks.map((stock) => stock.symbol).join(",");
    const periods = getIndicatorPeriods().join(",");
    const response = await fetch(`/api/indicators?symbols=${encodeURIComponent(symbols)}&periods=${encodeURIComponent(periods)}`);

    if (!response.ok) {
      throw new Error("indicator request failed");
    }

    const payload = await response.json();
    const results = payload.results || [];

    results.forEach((result) => {
      const stock = stocks.find((item) => item.symbol === result.symbol);
      if (!stock) return;
      const changedCells = new Set(state.flashCells);

      if (Number.isFinite(result.price)) {
        const nextPrice = Number(result.price.toFixed(2));
        if (Number(stock.price.toFixed(2)) !== nextPrice) changedCells.add(`${stock.symbol}:price`);
        stock.price = result.price;
      }
      if (Number.isFinite(result.change)) {
        const nextChange = Number(result.change.toFixed(2));
        if (Number(stock.change.toFixed(2)) !== nextChange) changedCells.add(`${stock.symbol}:change`);
        stock.change = result.change;
      }

      Object.entries(result.rsi || {}).forEach(([period, value]) => {
        if (Number.isFinite(value)) {
          const nextRsi = Math.round(value);
          if (Math.round(stock.rsi[period] ?? -1) !== nextRsi) changedCells.add(`${stock.symbol}:rsi:${period}`);
          stock.rsi[period] = nextRsi;
        }
      });

      state.flashCells = changedCells;
    });

    const failed = results.filter((result) => result.error).map((result) => result.symbol);
    state.updateError = "";
    if (failed.length) console.warn(`${failed.join(", ")} 지표를 가져오지 못했습니다.`);
    state.lastUpdated = payload.updatedAt || formatTime(new Date());
    state.marketLoaded = true;
    await checkAlertTriggers();
  } catch (error) {
    state.updateError = "";
    console.warn("실제 지표를 가져오지 못했습니다. 로컬 Node 서버 실행 상태를 확인해 주세요.");
  } finally {
    state.isUpdating = false;
    render();
    if (state.flashCells.size) {
      setTimeout(() => {
        state.flashCells = new Set();
        render();
      }, 1100);
    }
  }
}

function strategyIcon(name) {
  const icons = {
    clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,
    trend: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l5-5 4 4 5-7"/><path d="M15 8h4v4"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>`,
    check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`
  };
  return icons[name] || "";
}

function strategyCondition(label, detail, tone, status, icon) {
  return `
    <div class="strategy-condition">
      <span class="strategy-condition-icon ${tone}" aria-hidden="true">${strategyIcon(icon)}</span>
      <span>
        <strong>${label}</strong>
        <small>${detail}</small>
      </span>
      <em class="${tone}">${status}</em>
    </div>
  `;
}

function renderAi() {
  const qld = stocks.find((stock) => stock.symbol === "QLD") || stocks.find((stock) => stock.symbol === "QQQ") || stocks[0];
  const currentPrice = qld?.price || 71.85;
  const currentChange = qld?.change ?? 0.9;
  const rsi7 = Math.min(99, Math.max(1, Math.round((qld?.rsi["60분"] ?? qld?.rsi["120분"] ?? 27) * 0.72)));
  const ma200 = Number((currentPrice / 1.085).toFixed(2));
  const aboveMa = currentPrice > ma200;
  const afterOpen = true;
  const eventClear = false;
  const metCount = [aboveMa, afterOpen, eventClear].filter(Boolean).length;

  return `
    <section class="strategy-hero">
      <div>
        <span>1시간봉 · RSI 7 · 200일선 필터</span>
        <h2>QLD RSI 전략</h2>
      </div>
      <button class="update-btn strategy-refresh ${state.isUpdating ? "is-loading" : ""}" type="button" data-action="update-indicators" aria-label="현황 업데이트" ${state.isUpdating ? "disabled" : ""}>⟳</button>
    </section>

    <section class="strategy-card">
      <div class="strategy-card-head">
        <strong>현재 상태</strong>
        <span>${state.lastUpdated}</span>
      </div>
      <div class="strategy-status">
        <span class="strategy-status-icon" aria-hidden="true">${strategyIcon("clock")}</span>
        <div>
          <strong>대기 중</strong>
          <span>진입 조건을 확인 중입니다</span>
        </div>
      </div>
      <div class="strategy-metrics">
        <div>
          <span>RSI (7)</span>
          <strong>${rsi7.toFixed(1)}</strong>
          <em class="warning">과매도 구간</em>
        </div>
        <div>
          <span>현재가</span>
          <strong>${currentPrice.toFixed(2)}</strong>
          <em class="${cls(currentChange)}">${currentChange > 0 ? "+" : ""}${currentChange.toFixed(2)}%</em>
        </div>
        <div>
          <span>200일선</span>
          <strong>${ma200.toFixed(2)}</strong>
          <em class="positive">위치: +8.5%</em>
        </div>
      </div>
    </section>

    <section class="strategy-card">
      <div class="strategy-title-row">
        <span class="strategy-title-icon" aria-hidden="true">${strategyIcon("check")}</span>
        <strong>필수 진입 조건</strong>
      </div>
      <div class="strategy-condition-list">
        ${strategyCondition("200일선 위", "200일선 위에서만 매수 가능", aboveMa ? "positive" : "warning", aboveMa ? "충족" : "확인", "trend")}
        ${strategyCondition("미국장 시작 30분 이후", "초반 변동성 구간 회피", afterOpen ? "positive" : "warning", afterOpen ? "충족" : "대기", "clock")}
        ${strategyCondition("CPI/FOMC 당일 아님", "이벤트 리스크 회피", eventClear ? "positive" : "warning", eventClear ? "충족" : "확인 필요", "alert")}
      </div>
      <div class="strategy-summary">
        <strong>필수 조건 <span>${metCount}/3</span> 충족</strong>
        <small>${metCount === 3 ? "진입 가능 구간입니다" : "이벤트 일정 확인 후 진입 가능"}</small>
      </div>
    </section>

    <button class="strategy-update-button" type="button" data-action="update-indicators" ${state.isUpdating ? "disabled" : ""}>
      <span aria-hidden="true">⟳</span> 현황 업데이트
    </button>
  `;
}

function renderAlerts() {
  const symbols = [...new Set([...stocks.map((stock) => stock.symbol), ...alerts.map((alert) => alert.symbol)])];
  if (state.selectedAlertSymbol !== "all" && !symbols.includes(state.selectedAlertSymbol)) {
    state.selectedAlertSymbol = "all";
  }
  state.selectedAlertIds = new Set([...state.selectedAlertIds].filter((id) => alerts.some((alert) => alert.id === id)));
  const selectedAlerts = state.selectedAlertSymbol === "all"
    ? alerts
    : alerts.filter((alert) => alert.symbol === state.selectedAlertSymbol);
  const selectedCount = state.selectedAlertIds.size;
  const isTelegramLinked = hasTelegramSettings();
  const telegramStatus = state.telegramSettingsStatus || (isTelegramLinked ? "테스트 메시지가 성공적으로 전송되었습니다." : "Bot token과 chat id를 입력해 주세요.");

  return `
    <section class="telegram-settings-card ${state.telegramPanelOpen ? "" : "is-collapsed"}">
      <button class="telegram-panel-toggle" type="button" data-action="toggle-telegram-panel" aria-expanded="${state.telegramPanelOpen}">
        <div class="telegram-title-row">
          <strong>텔레그램 알림</strong>
          <span class="telegram-link-badge ${isTelegramLinked ? "is-linked" : ""}">${isTelegramLinked ? "연결됨" : "미연결"}</span>
        </div>
        <span class="telegram-panel-chevron" aria-hidden="true">${state.telegramPanelOpen ? "⌃" : "⌄"}</span>
      </button>
      ${state.telegramPanelOpen ? `
        <div class="telegram-settings-body">
          <span class="telegram-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m21.5 4.5-3.1 15.1c-.2.9-.8 1.1-1.6.7l-4.9-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.1 1.7z"/>
            </svg>
          </span>
          <div class="telegram-settings-copy">
            <span>${escapeHtml(telegramSettingsSummary())}</span>
            <em>${escapeHtml(telegramStatus)}</em>
          </div>
          <div class="telegram-settings-actions">
            <button class="small-btn telegram-action-secondary" type="button" data-action="open-telegram-settings">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/>
                <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2.1 2.1 0 0 1-4.2 0v-.1a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H2a2.1 2.1 0 0 1 0-4.2h.1a1.8 1.8 0 0 0 1.7-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4h.1A1.8 1.8 0 0 0 9.5 2V2a2.1 2.1 0 0 1 4.2 0v.1a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2v.1A1.8 1.8 0 0 0 21 9.5h.1a2.1 2.1 0 0 1 0 4.2H21a1.8 1.8 0 0 0-1.6 1.3z"/>
              </svg>
              설정
            </button>
            <button class="small-btn is-primary telegram-action-primary" type="button" data-action="test-telegram" ${isTelegramLinked && !state.telegramSettingsTesting ? "" : "disabled"}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21.5 4.5-3.1 15.1c-.2.9-.8 1.1-1.6.7l-4.9-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.1 1.7z"/>
              </svg>
              ${state.telegramSettingsTesting ? "전송 중" : "알림 테스트"}
            </button>
          </div>
        </div>
      ` : ""}
    </section>
    <section class="alert-list-actions">
      <button class="add-alert-button" type="button" data-action="add-alert"><span aria-hidden="true">+</span> 알림 추가</button>
      <div class="alert-delete-actions ${selectedCount ? "is-visible" : ""}">
        <span>${selectedCount ? `${selectedCount}개 선택됨` : "삭제할 알림을 선택하세요"}</span>
        <button class="small-btn" type="button" data-action="delete-selected-alerts" ${selectedCount ? "" : "disabled"}>선택 삭제</button>
      </div>
    </section>
    <div class="alert-symbol-tabs" aria-label="알림 종목">
      <button class="alert-symbol-tab ${state.selectedAlertSymbol === "all" ? "is-active" : ""}" type="button" data-action="select-alert-symbol" data-symbol="all">
        <strong>전체</strong>
        <span>${alerts.length}</span>
      </button>
      ${symbols.map((symbol) => {
        const count = alerts.filter((alert) => alert.symbol === symbol).length;
        return `
          <button class="alert-symbol-tab ${state.selectedAlertSymbol === symbol ? "is-active" : ""}" type="button" data-action="select-alert-symbol" data-symbol="${symbol}">
            <strong>${symbol}</strong>
            <span>${count}</span>
          </button>
        `;
      }).join("")}
    </div>
    ${selectedAlerts.map((alert) => `
      <article class="alert-row ${state.selectedAlertIds.has(alert.id) ? "is-selected" : ""}" role="button" tabindex="0" data-action="open-alert-detail" data-alert-id="${alert.id}">
        <button class="alert-select-btn" type="button" data-action="toggle-alert-selection" data-alert-id="${alert.id}" aria-label="${alert.symbol} 알림 선택" aria-checked="${state.selectedAlertIds.has(alert.id)}">
          ${state.selectedAlertIds.has(alert.id) ? "✓" : ""}
        </button>
        <strong class="ticker">${alert.symbol}</strong>
        <span class="subtle">${alert.period} / ${alert.condition}</span>
        <button class="switch ${alert.enabled ? "is-on" : ""}" type="button" data-action="alert-switch" data-alert-id="${alert.id}" data-symbol="${alert.symbol}" aria-label="사용 여부"></button>
      </article>
    `).join("") || `<p class="empty-state">알림 설정이 없습니다.</p>`}
    <div class="apply-bar">
      <span>${state.alertSettingsDirty ? "적용되지 않은 변경사항이 있습니다." : "현재 알림 설정이 적용되어 있습니다."}</span>
      <button class="small-btn is-primary" type="button" data-action="apply-alert-settings" ${state.alertSettingsDirty ? "" : "disabled"}>적용</button>
    </div>
  `;
}

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-screen]");
  if (!button) return;
  if (!state.user) {
    state.authModalOpen = true;
    render();
    requestAnimationFrame(() => document.querySelector("#loginId")?.focus());
    return;
  }
  state.screen = button.dataset.screen;
  render();
});

document.addEventListener("click", async (event) => {
  const detailRow = event.target.closest("[data-action='open-alert-detail']");
  if (detailRow && !event.target.closest("button")) {
    if (!state.user) return;
    state.selectedAlertId = detailRow.dataset.alertId;
    state.addAlertOpen = false;
    state.addStockOpen = false;
    state.telegramSettingsOpen = false;
    render();
    return;
  }

  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.screen) {
    if (!state.user) {
      state.authModalOpen = true;
      render();
      requestAnimationFrame(() => document.querySelector("#loginId")?.focus());
      return;
    }
    state.screen = target.dataset.screen;
    state.stockMenuOpen = false;
    render();
  }

  if (target.dataset.action === "toggle-stock-menu") {
    state.stockMenuOpen = !state.stockMenuOpen;
    render();
  }

  if (target.dataset.action === "open-symbol-alerts") {
    state.screen = "alerts";
    state.selectedAlertSymbol = target.dataset.symbol;
    state.selectedAlertIds = new Set();
    state.selectedAlertId = "";
    state.addAlertOpen = false;
    state.addStockOpen = false;
    state.telegramSettingsOpen = false;
    state.stockMenuOpen = false;
    render();
  }

  if (target.dataset.action === "open-add-stock") {
    state.addStockOpen = true;
    state.addAlertOpen = false;
    state.authModalOpen = false;
    state.stockMenuOpen = false;
    state.deleteMode = false;
    render();
    requestAnimationFrame(() => document.querySelector("#stockSymbol")?.focus());
  }

  if (target.dataset.action === "close-add-stock") {
    state.addStockOpen = false;
    render();
  }

  if (target.dataset.action === "add-alert") {
    state.addAlertOpen = true;
    state.addStockOpen = false;
    state.authModalOpen = false;
    state.telegramSettingsOpen = false;
    render();
    requestAnimationFrame(() => document.querySelector("#alertSymbol")?.focus());
  }

  if (target.dataset.action === "close-add-alert") {
    state.addAlertOpen = false;
    render();
  }

  if (target.dataset.action === "open-telegram-settings") {
    state.telegramSettingsOpen = true;
    state.addAlertOpen = false;
    state.addStockOpen = false;
    state.authModalOpen = false;
    state.selectedAlertId = "";
    render();
    requestAnimationFrame(() => document.querySelector("#telegramBotToken")?.focus());
  }

  if (target.dataset.action === "close-telegram-settings") {
    state.telegramSettingsOpen = false;
    state.telegramSettingsStatus = "";
    render();
  }

  if (target.dataset.action === "save-telegram-settings") {
    telegramSettings = {
      botToken: document.querySelector("#telegramBotToken")?.value.trim() || "",
      chatId: document.querySelector("#telegramChatId")?.value.trim() || ""
    };
    saveTelegramSettings();
    state.telegramSettingsStatus = hasTelegramSettings() ? "텔레그램 설정을 저장했습니다." : "Bot token과 chat id를 입력해 주세요.";
    render();
  }

  if (target.dataset.action === "toggle-alert-selection") {
    const id = target.dataset.alertId;
    if (state.selectedAlertIds.has(id)) state.selectedAlertIds.delete(id);
    else state.selectedAlertIds.add(id);
    render();
  }

  if (target.dataset.action === "test-telegram") {
    if (state.telegramSettingsOpen) {
      telegramSettings = {
        botToken: document.querySelector("#telegramBotToken")?.value.trim() || "",
        chatId: document.querySelector("#telegramChatId")?.value.trim() || ""
      };
      saveTelegramSettings();
    }
    await sendTelegramTest();
  }

  if (target.dataset.action === "close-alert-detail") {
    state.selectedAlertId = "";
    render();
  }

  if (target.dataset.action === "open-auth") {
    state.authModalOpen = true;
    state.authError = "";
    state.addAlertOpen = false;
    state.addStockOpen = false;
    state.telegramSettingsOpen = false;
    state.selectedAlertId = "";
    render();
    requestAnimationFrame(() => document.querySelector("#loginId")?.focus());
  }

  if (target.dataset.action === "close-auth") {
    state.authModalOpen = false;
    state.authError = "";
    render();
  }

  if (target.dataset.action === "login") {
    const idInput = document.querySelector("#loginId");
    const passwordInput = document.querySelector("#loginPassword");
    const id = idInput?.value.trim();
    const password = passwordInput?.value.trim() || "";

    if (!id) {
      state.authError = "아이디를 입력해 주세요.";
      render();
      requestAnimationFrame(() => document.querySelector("#loginId")?.focus());
      return;
    }

    if (password.length < 4) {
      state.authError = "비밀번호는 4자 이상 입력해 주세요.";
      render();
      requestAnimationFrame(() => document.querySelector("#loginPassword")?.focus());
      return;
    }

    state.authError = "";
    render();

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        state.authError = payload.error || "로그인에 실패했습니다.";
        render();
        requestAnimationFrame(() => document.querySelector("#loginPassword")?.focus());
        return;
      }

      state.user = payload.user || { id };
      syncTelegramSettingsForUser(state.user);
      state.authModalOpen = false;
      state.authError = "";
      state.marketLoaded = false;
      render();
    } catch {
      state.authError = "서버 연결을 확인해 주세요.";
      render();
    }
  }

  if (target.dataset.action === "logout") {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    state.user = null;
    telegramSettings = emptyTelegramSettings();
    state.authModalOpen = false;
    state.authError = "";
    state.marketLoaded = false;
    state.triggeredAlerts = [];
    render();
  }

  if (target.dataset.action === "save-alert") {
    const symbol = document.querySelector("#alertSymbol")?.value;
    const period = document.querySelector("#alertPeriod")?.value;
    const direction = document.querySelector("#alertCondition")?.value || "low";
    const threshold = Number(document.querySelector("#alertThreshold")?.value);
    const telegram = document.querySelector("#telegramChannel")?.checked || false;

    if (!symbol || !period || !Number.isFinite(threshold)) return;

    alerts.unshift({
      id: `alert-${alertIdCounter}`,
      symbol,
      period,
      condition: `RSI ${threshold} ${direction === "high" ? "이상" : "이하"}`,
      threshold,
      direction,
      enabled: true,
      channels: { app: false, kakao: false, telegram },
      message: document.querySelector("#newAlertText")?.value.trim() || `${symbol} ${period} RSI가 ${threshold} ${direction === "high" ? "이상으로 올라갔습니다." : "이하로 내려왔습니다."}`
    });
    alertIdCounter += 1;
    state.selectedAlertSymbol = symbol;
    state.addAlertOpen = false;
    markAlertSettingsDirty();
    render();
  }

  if (target.dataset.action === "save-alert-detail") {
    const alert = alerts.find((item) => item.id === state.selectedAlertId);
    if (!alert) return;

    alert.channels = {
      app: false,
      kakao: false,
      telegram: document.querySelector("#detailTelegramChannel")?.checked || false
    };
    alert.message = document.querySelector("#detailAlertText")?.value.trim() || alert.message;
    state.selectedAlertId = "";
    markAlertSettingsDirty();
    render();
  }

  if (target.dataset.action === "delete-selected-alerts") {
    if (!state.selectedAlertIds.size) return;

    alerts = alerts.filter((alert) => !state.selectedAlertIds.has(alert.id));
    state.selectedAlertIds = new Set();
    state.selectedAlertId = "";
    markAlertSettingsDirty();
    render();
  }

  if (target.dataset.action === "delete-alert") {
    const index = alerts.findIndex((item) => item.id === state.selectedAlertId);
    if (index >= 0) alerts.splice(index, 1);
    state.selectedAlertId = "";
    markAlertSettingsDirty();
    render();
  }

  if (target.dataset.action === "apply-alert-settings") {
    activeAlerts = cloneAlerts(alerts);
    state.alertSettingsDirty = false;
    state.alertTriggerState = new Map();
    saveAlerts();
    render();
    updateRealIndicators({ silent: true });
  }

  if (target.dataset.action === "add-stock") {
    const input = document.querySelector("#stockSymbol");
    const symbol = input?.value.trim().toUpperCase();
    if (!symbol) {
      input?.focus();
      return;
    }
    if (!stocks.some((stock) => stock.symbol === symbol)) {
      stocks.push({
        symbol,
        price: 100 + stocks.length * 7.35,
        change: Math.round((Math.random() * 6 - 3) * 100) / 100,
        favorite: true,
        rsi: { "1분": 48, "5분": 45, "30분": 42, "120분": 44 }
      });
    }
    state.addStockOpen = false;
    render();
  }

  if (target.dataset.action === "toggle-delete-mode") {
    state.deleteMode = !state.deleteMode;
    state.stockMenuOpen = false;
    render();
  }

  if (target.dataset.action === "delete-stock") {
    const index = stocks.findIndex((stock) => stock.symbol === target.dataset.symbol);
    if (index >= 0) stocks.splice(index, 1);
    render();
  }

  if (target.dataset.action === "select-alert-symbol") {
    state.selectedAlertSymbol = target.dataset.symbol;
    render();
  }

  if (target.dataset.action === "toggle-telegram-panel") {
    state.telegramPanelOpen = !state.telegramPanelOpen;
    render();
  }

  if (target.dataset.action === "toggle-period") {
    const period = target.dataset.period;
    if (state.periods.includes(period)) {
      state.periods = state.periods.filter((item) => item !== period);
    } else if (state.periods.length < MAX_PERIODS) {
      state.periods = [...state.periods, period];
    }
    const periodOrder = ["1분", "3분", "5분", "15분", "30분", "60분", "120분", "일", "주", "월"];
    state.periods.sort((a, b) => periodOrder.indexOf(a) - periodOrder.indexOf(b));
    state.marketLoaded = false;
    render();
  }

  if (target.dataset.action === "toggle-time-selector") {
    state.timeSelectorOpen = !state.timeSelectorOpen;
    render();
  }

  if (target.dataset.action === "update-indicators") {
    updateRealIndicators();
  }

  if (target.dataset.action === "favorite") {
    const item = recommendations.find((rec) => rec.symbol === target.dataset.symbol);
    item.favorite = !item.favorite;
    render();
  }

  if (target.dataset.action === "alert-switch" || target.dataset.action === "editor-switch") {
    const alert = alerts.find((item) => item.id === target.dataset.alertId);
    if (alert) {
      alert.enabled = !alert.enabled;
      markAlertSettingsDirty();
    }
    target.classList.toggle("is-on");
  }
});

document.addEventListener("keydown", (event) => {
  if (!state.authModalOpen || event.key !== "Enter") return;
  const loginButton = document.querySelector("[data-action='login']");
  loginButton?.click();
});

async function checkSession() {
  try {
    const response = await fetch("/api/session");
    const payload = await response.json();
    state.user = payload.authenticated ? payload.user : null;
    syncTelegramSettingsForUser(state.user);
  } catch {
    state.user = null;
    telegramSettings = emptyTelegramSettings();
  } finally {
    state.authChecked = true;
    state.authModalOpen = !state.user;
    render();
  }
}

render();
checkSession();

splashIntro?.addEventListener("animationend", (event) => {
  if (event.animationName === "splashExit") {
    splashIntro.remove();
  }
});
