const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5175);
const ROOT = __dirname;
const RSI_PERIOD = 7;
const LOGIN_ID = process.env.RSI_LOGIN_ID || "kim";
const LOGIN_PASSWORD = process.env.RSI_LOGIN_PASSWORD || "1234";
const SESSION_COOKIE = "rsi_signal_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const intradayPeriods = {
  "1분": 1,
  "3분": 3,
  "5분": 5,
  "15분": 15,
  "30분": 30,
  "60분": 60,
  "120분": 120
};

function formatTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        if (separator === -1) return [item, ""];
        return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
      })
  );
}

function sessionUser(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { id: session.id };
}

function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireSession(request, response) {
  const user = sessionUser(request);
  if (!user) {
    json(response, 401, { error: "login required" });
    return null;
  }
  return user;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function calculateRsi(closes) {
  const values = closes.filter((value) => Number.isFinite(value));
  if (values.length <= RSI_PERIOD) return null;

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= RSI_PERIOD; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let averageGain = gains / RSI_PERIOD;
  let averageLoss = losses / RSI_PERIOD;

  for (let index = RSI_PERIOD + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (RSI_PERIOD - 1) + gain) / RSI_PERIOD;
    averageLoss = (averageLoss * (RSI_PERIOD - 1) + loss) / RSI_PERIOD;
  }

  if (averageLoss === 0) return 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

function aggregateCloses(points, minutes) {
  const bucketSeconds = minutes * 60;
  const buckets = new Map();

  points.forEach((point) => {
    if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.close)) return;
    const bucket = Math.floor(point.timestamp / bucketSeconds) * bucketSeconds;
    buckets.set(bucket, point.close);
  });

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);
}

async function fetchYahooChart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 RSI Signal Prototype"
    }
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Yahoo request failed: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("Yahoo response missing chart result");
  return result;
}

function toPoints(chart) {
  const timestamps = chart.timestamp || [];
  const closes = chart.indicators?.quote?.[0]?.close || [];
  return timestamps.map((timestamp, index) => ({
    timestamp,
    close: closes[index]
  }));
}

async function getIndicators(symbol, periods) {
  const needsIntraday = periods.some((period) => intradayPeriods[period]);
  const rsi = {};
  let meta;

  if (needsIntraday) {
    const intraday = await fetchYahooChart(symbol, "7d", "1m");
    meta = intraday.meta;
    const points = toPoints(intraday);

    periods.forEach((period) => {
      const minutes = intradayPeriods[period];
      if (!minutes) return;
      rsi[period] = calculateRsi(aggregateCloses(points, minutes));
    });
  }

  if (periods.includes("일")) {
    const daily = await fetchYahooChart(symbol, "1y", "1d");
    meta ||= daily.meta;
    rsi["일"] = calculateRsi(toPoints(daily).map((point) => point.close));
  }

  if (periods.includes("주")) {
    const weekly = await fetchYahooChart(symbol, "5y", "1wk");
    meta ||= weekly.meta;
    rsi["주"] = calculateRsi(toPoints(weekly).map((point) => point.close));
  }

  if (periods.includes("월")) {
    const monthly = await fetchYahooChart(symbol, "10y", "1mo");
    meta ||= monthly.meta;
    rsi["월"] = calculateRsi(toPoints(monthly).map((point) => point.close));
  }

  const price = meta?.regularMarketPrice ?? meta?.chartPreviousClose ?? null;
  const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
  const change = Number.isFinite(price) && Number.isFinite(previousClose) && previousClose !== 0
    ? ((price - previousClose) / previousClose) * 100
    : null;

  return {
    symbol,
    price,
    change,
    rsi
  };
}

async function handleIndicators(request, response, url) {
  if (!requireSession(request, response)) return;

  const symbols = (url.searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const periods = (url.searchParams.get("periods") || "")
    .split(",")
    .map((period) => period.trim())
    .filter(Boolean);

  if (!symbols.length || !periods.length) {
    json(response, 400, { error: "symbols and periods are required" });
    return;
  }

  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      return await getIndicators(symbol, periods);
    } catch (error) {
      return { symbol, error: error.message, rsi: {} };
    }
  }));

  json(response, 200, {
    updatedAt: formatTime(),
    results
  });
}

async function handleTelegramSend(request, response) {
  if (!requireSession(request, response)) return;

  if (request.method !== "POST") {
    json(response, 405, { error: "method not allowed" });
    return;
  }

  const body = await readJson(request);
  const text = String(body.text || "").trim();
  const token = String(body.telegram?.botToken || body.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(body.telegram?.chatId || body.chatId || process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!token || !chatId) {
    json(response, 400, { error: "Telegram bot token and chat id are required" });
    return;
  }

  if (!text) {
    json(response, 400, { error: "text is required" });
    return;
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  const payload = await telegramResponse.json().catch(() => ({}));

  if (!telegramResponse.ok || payload.ok === false) {
    json(response, 502, { error: payload.description || "telegram request failed" });
    return;
  }

  json(response, 200, { ok: true });
}

async function handleSession(request, response) {
  const user = sessionUser(request);
  json(response, 200, { authenticated: Boolean(user), user });
}

async function handleLogin(request, response) {
  if (request.method !== "POST") {
    json(response, 405, { error: "method not allowed" });
    return;
  }

  const body = await readJson(request);
  const id = String(body.id || "").trim();
  const password = String(body.password || "");

  if (!timingSafeEqualText(id, LOGIN_ID) || !timingSafeEqualText(password, LOGIN_PASSWORD)) {
    json(response, 401, { error: "아이디 또는 비밀번호가 맞지 않습니다." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    id,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  setSessionCookie(response, token);
  json(response, 200, { ok: true, user: { id } });
}

async function handleLogout(request, response) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(response);
  json(response, 200, { ok: true });
}

async function serveStatic(request, response, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/rsi-signal-app" || pathname === "/rsi-signal-app/") pathname = "/";
  if (pathname.startsWith("/rsi-signal-app/")) pathname = pathname.slice("/rsi-signal-app".length);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname === "/api/indicators") {
      await handleIndicators(request, response, url);
      return;
    }

    if (url.pathname === "/api/session") {
      await handleSession(request, response);
      return;
    }

    if (url.pathname === "/api/login") {
      await handleLogin(request, response);
      return;
    }

    if (url.pathname === "/api/logout") {
      await handleLogout(request, response);
      return;
    }

    if (url.pathname === "/api/telegram/send") {
      await handleTelegramSend(request, response);
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`RSI Signal app: http://127.0.0.1:${PORT}`);
});
