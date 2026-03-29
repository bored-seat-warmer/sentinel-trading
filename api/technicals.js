// Compute technical indicators from Yahoo Finance OHLCV data

function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

function computeEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeMACD(closes) {
  if (closes.length < 26) return null;
  const ema12 = computeEMAArray(closes, 12);
  const ema26 = computeEMAArray(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(26 - 1);
  const signalLine = computeEMAArray(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  const histogram = macd - signal;
  // Check for recent crossover (last 3 bars)
  let crossover = "none";
  if (macdLine.length >= 3 && signalLine.length >= 3) {
    const prevMacd = macdLine[macdLine.length - 3];
    const prevSignal = computeEMAArray(macdLine.slice(0, -2), 9);
    const prevSig = prevSignal[prevSignal.length - 1];
    if (prevMacd <= prevSig && macd > signal) crossover = "bullish";
    else if (prevMacd >= prevSig && macd < signal) crossover = "bearish";
  }
  return {
    macd: round(macd),
    signal: round(signal),
    histogram: round(histogram),
    crossover,
  };
}

function computeEMAArray(values, period) {
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function computeBollingerBands(closes, period = 20) {
  if (closes.length < period) return null;
  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const price = closes[closes.length - 1];
  const upper = sma + 2 * stdDev;
  const lower = sma - 2 * stdDev;
  // Position within bands: 0 = at lower, 1 = at upper
  const position = upper !== lower ? (price - lower) / (upper - lower) : 0.5;
  return {
    upper: round(upper),
    middle: round(sma),
    lower: round(lower),
    bandwidth: round(((upper - lower) / sma) * 100),
    position: round(position),
  };
}

function computeVolumeContext(volumes) {
  if (volumes.length < 21) return null;
  const current = volumes[volumes.length - 1];
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  return {
    current: Math.round(current),
    avg20d: Math.round(avg20),
    ratio: round(current / avg20),
  };
}

function computeReturns(closes) {
  const current = closes[closes.length - 1];
  const r = (idx) => {
    if (closes.length <= idx) return null;
    const prev = closes[closes.length - 1 - idx];
    return round(((current - prev) / prev) * 100);
  };
  return {
    "1d": r(1),
    "5d": r(5),
    "1m": r(21),
    "3m": r(63),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbols } = req.query;
  if (!symbols || typeof symbols !== "string") {
    return res.status(400).json({ error: "Missing symbols parameter" });
  }

  const CRYPTO = new Set(["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "MATIC", "UNI", "BNB", "LTC", "SHIB", "AAVE"]);
  const rawSymbols = symbols.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

  const results = await Promise.allSettled(
    rawSymbols.map(async (sym) => {
      const upper = sym.toUpperCase();
      const yahooSym = CRYPTO.has(upper) ? `${upper}-USD` : upper;

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=6mo`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "AtlasAlpha/1.0" },
      });
      if (!resp.ok) return null;
      const data = await resp.json();

      const result = data.chart?.result?.[0];
      if (!result) return null;

      const quotes = result.indicators?.quote?.[0];
      if (!quotes) return null;

      // Filter out null values (holidays/weekends)
      const closes = [];
      const volumes = [];
      const highs = [];
      const lows = [];
      for (let i = 0; i < quotes.close.length; i++) {
        if (quotes.close[i] != null) {
          closes.push(quotes.close[i]);
          volumes.push(quotes.volume[i] || 0);
          highs.push(quotes.high[i] || quotes.close[i]);
          lows.push(quotes.low[i] || quotes.close[i]);
        }
      }

      if (closes.length < 30) return null;

      const price = closes[closes.length - 1];
      const high52w = Math.max(...highs.slice(-252));
      const low52w = Math.min(...lows.slice(-252));

      return {
        symbol: upper,
        price: round(price),
        rsi14: computeRSI(closes, 14),
        macd: computeMACD(closes),
        bollingerBands: computeBollingerBands(closes, 20),
        volume: computeVolumeContext(volumes),
        returns: computeReturns(closes),
        range: {
          high: round(high52w),
          low: round(low52w),
          position: round((price - low52w) / (high52w - low52w)),
        },
      };
    })
  );

  const technicals = {};
  rawSymbols.forEach((sym, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      technicals[sym.toUpperCase()] = r.value;
    }
  });

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json({ technicals });
}
