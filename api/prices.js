const CRYPTO_SYMBOLS = new Set(["BTC", "ETH", "SOL", "AVAX", "ADA", "DOT", "MATIC", "LINK", "UNI", "AAVE", "XRP", "DOGE", "SHIB", "BNB", "LTC"]);

function toYahooSymbol(symbol) {
  const upper = symbol.toUpperCase();
  if (CRYPTO_SYMBOLS.has(upper)) return `${upper}-USD`;
  if (upper.endsWith("USD") && CRYPTO_SYMBOLS.has(upper.replace("USD", ""))) {
    return `${upper.replace("USD", "")}-USD`;
  }
  return upper;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbols } = req.query;
  if (!symbols || typeof symbols !== "string") {
    return res.status(400).json({ error: "Missing symbols parameter" });
  }

  const rawSymbols = symbols.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const yahooSymbols = rawSymbols.map(toYahooSymbol);

  try {
    const results = await Promise.allSettled(
      yahooSymbols.map(async (sym) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "AtlasAlpha/1.0" },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const change = prevClose ? price - prevClose : 0;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;
        return {
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          currency: meta.currency || "USD",
        };
      })
    );

    const prices = {};
    rawSymbols.forEach((sym, i) => {
      const result = results[i];
      if (result.status === "fulfilled" && result.value) {
        prices[sym.toUpperCase()] = result.value;
      }
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json({ prices });
  } catch (err) {
    console.error("Price fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch prices" });
  }
}
