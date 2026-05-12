const { requireSession } = require("./_auth");

const RSI_PERIOD = 7;

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

module.exports = async function handler(request, response) {
  if (!requireSession(request, response)) return;

  const url = new URL(request.url, `https://${request.headers.host}`);
  const symbols = (url.searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const periods = (url.searchParams.get("periods") || "")
    .split(",")
    .map((period) => period.trim())
    .filter(Boolean);

  if (!symbols.length || !periods.length) {
    response.status(400).json({ error: "symbols and periods are required" });
    return;
  }

  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      return await getIndicators(symbol, periods);
    } catch (error) {
      return { symbol, error: error.message, rsi: {} };
    }
  }));

  response.status(200).json({
    updatedAt: formatTime(),
    results
  });
};
