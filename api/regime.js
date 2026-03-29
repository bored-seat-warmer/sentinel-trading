// Market regime indicators: VIX, yield curve, credit spreads, breadth

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "AtlasAlpha/1.0" },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const result = data.chart?.result?.[0];
  if (!result) return null;

  const closes = result.indicators?.quote?.[0]?.close?.filter((c) => c != null) || [];
  const meta = result.meta;
  return { closes, price: meta?.regularMarketPrice, prevClose: meta?.chartPreviousClose };
}

function sma(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [vixData, tltData, shyData, spyData, rspData, hycData] = await Promise.all([
    fetchYahoo("^VIX"),         // Volatility index
    fetchYahoo("TLT"),          // 20+ year treasuries (long end)
    fetchYahoo("SHY"),          // 1-3 year treasuries (short end)
    fetchYahoo("SPY"),          // S&P 500
    fetchYahoo("RSP"),          // Equal-weight S&P (breadth proxy)
    fetchYahoo("HYG"),          // High-yield corporate bonds (credit risk)
  ]);

  const regime = {};

  // VIX — fear gauge
  if (vixData?.price) {
    const vix = vixData.price;
    const vixSma20 = vixData.closes.length >= 20 ? round(sma(vixData.closes, 20)) : null;
    let level;
    if (vix <= 15) level = "LOW — complacency / risk-on";
    else if (vix <= 20) level = "NORMAL — balanced";
    else if (vix <= 30) level = "ELEVATED — caution";
    else if (vix <= 40) level = "HIGH — fear / risk-off";
    else level = "EXTREME — panic / crisis";

    regime.vix = {
      value: round(vix),
      sma20: vixSma20,
      level,
      trend: vixSma20 ? (vix > vixSma20 ? "rising" : "falling") : null,
    };
  }

  // Yield curve proxy: TLT/SHY ratio
  // Falling ratio = flattening/inverting curve (bearish signal)
  // Rising ratio = steepening curve (growth expectations)
  if (tltData?.price && shyData?.price) {
    const ratio = tltData.price / shyData.price;
    const tltCloses = tltData.closes;
    const shyCloses = shyData.closes;
    const len = Math.min(tltCloses.length, shyCloses.length);
    const ratios = [];
    for (let i = 0; i < len; i++) {
      if (tltCloses[tltCloses.length - len + i] && shyCloses[shyCloses.length - len + i]) {
        ratios.push(tltCloses[tltCloses.length - len + i] / shyCloses[shyCloses.length - len + i]);
      }
    }
    const ratio20 = ratios.length >= 20 ? round(sma(ratios, 20)) : null;
    const ratioRound = round(ratio);

    regime.yieldCurve = {
      ratio: ratioRound,
      sma20: ratio20,
      trend: ratio20 ? (ratioRound > ratio20 ? "steepening" : "flattening") : null,
      signal: ratio20 ? (ratioRound > ratio20 ? "growth expectations rising" : "growth expectations falling") : null,
    };
  }

  // Market breadth: SPY vs RSP (equal-weight)
  // If SPY outperforms RSP, rally is narrow (fewer stocks participating)
  // If RSP outperforms SPY, rally is broad (healthy)
  if (spyData?.closes?.length >= 20 && rspData?.closes?.length >= 20) {
    const spyReturn = ((spyData.closes[spyData.closes.length - 1] / spyData.closes[spyData.closes.length - 21]) - 1) * 100;
    const rspReturn = ((rspData.closes[rspData.closes.length - 1] / rspData.closes[rspData.closes.length - 21]) - 1) * 100;
    const spread = rspReturn - spyReturn;

    regime.breadth = {
      spyReturn1m: round(spyReturn),
      rspReturn1m: round(rspReturn),
      spread: round(spread),
      signal: spread > 1 ? "BROAD — healthy participation"
        : spread < -1 ? "NARROW — concentrated in mega-caps"
        : "BALANCED",
    };
  }

  // Credit stress: HYG (high-yield bonds)
  // Falling HYG = credit spreads widening = risk-off
  if (hycData?.closes?.length >= 20) {
    const current = hycData.closes[hycData.closes.length - 1];
    const monthAgo = hycData.closes[hycData.closes.length - 21];
    const change = ((current / monthAgo) - 1) * 100;

    regime.credit = {
      hyg: round(current),
      change1m: round(change),
      signal: change < -2 ? "STRESS — spreads widening, risk-off"
        : change > 1 ? "CALM — spreads tightening, risk-on"
        : "STABLE",
    };
  }

  // SPY trend context
  if (spyData?.closes?.length >= 50) {
    const price = spyData.closes[spyData.closes.length - 1];
    const sma20val = sma(spyData.closes, 20);
    const sma50val = sma(spyData.closes, 50);

    regime.spyTrend = {
      price: round(price),
      sma20: round(sma20val),
      sma50: round(sma50val),
      aboveSma20: price > sma20val,
      aboveSma50: price > sma50val,
      trend: price > sma20val && price > sma50val ? "BULLISH"
        : price < sma20val && price < sma50val ? "BEARISH"
        : "MIXED",
    };
  }

  // Overall regime classification
  let riskScore = 0;
  let factors = 0;
  if (regime.vix) {
    factors++;
    if (regime.vix.value <= 15) riskScore += 2;
    else if (regime.vix.value <= 20) riskScore += 1;
    else if (regime.vix.value <= 30) riskScore -= 1;
    else riskScore -= 2;
  }
  if (regime.breadth) {
    factors++;
    if (regime.breadth.spread > 1) riskScore += 1;
    else if (regime.breadth.spread < -1) riskScore -= 1;
  }
  if (regime.credit) {
    factors++;
    if (regime.credit.change1m > 1) riskScore += 1;
    else if (regime.credit.change1m < -2) riskScore -= 2;
  }
  if (regime.spyTrend) {
    factors++;
    if (regime.spyTrend.trend === "BULLISH") riskScore += 1;
    else if (regime.spyTrend.trend === "BEARISH") riskScore -= 1;
  }

  const avg = factors > 0 ? riskScore / factors : 0;
  regime.overall = avg > 0.5 ? "RISK-ON" : avg < -0.5 ? "RISK-OFF" : "NEUTRAL";

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json({ regime });
}
