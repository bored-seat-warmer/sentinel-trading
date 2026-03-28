const REACTIVE_SYSTEM_PROMPT = `You are a financial market sentiment analyzer for a real-time news trading system. Analyze the given headline for immediate market impact across both traditional markets AND crypto.

CRITICAL CONSISTENCY RULES:
- The signal action MUST align with the sentiment and sector analysis. If sentiment is "bearish" and the primary sector impact is "negative", the signal action must be "SHORT" (not "LONG"). If "bullish" and "positive", signal must be "LONG".
- The signal instrument must belong to or track the sector with the strongest directional impact.
- LONG means you expect the instrument to go UP. SHORT means you expect it to go DOWN. Do not confuse these.
- Think step by step: first determine sentiment, then sector impacts, then derive the signal logically from those conclusions.
- Always assess crypto impact even for non-crypto headlines — political events, dollar policy, regulation, and risk sentiment all move crypto markets.

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "severity": 1-10 (10 = maximum market impact),
  "sectors": [
    { "name": "Sector Name", "impact": "positive" | "negative" | "neutral", "magnitude": 1-10 }
  ],
  "crypto_impact": {
    "overall": "bullish" | "bearish" | "neutral",
    "magnitude": 1-10,
    "assets": [
      { "symbol": "BTC" | "ETH" | "SOL" | etc, "impact": "positive" | "negative" | "neutral", "reasoning": "1 sentence" }
    ],
    "narrative": "1 sentence on why this event matters for crypto"
  },
  "signal": {
    "action": "LONG" | "SHORT" | "HOLD",
    "instrument": "specific ETF, ticker, or crypto symbol (e.g. SOXX, XLF, SPY, BTCUSD, ETHUSD)",
    "confidence": 1-100,
    "timeframe": "minutes" | "hours" | "1-2 days"
  },
  "tickers": [
    {
      "symbol": "TICKER",
      "name": "Full Name",
      "direction": "long" | "short" | "watch",
      "note": "1 sentence on why this specific ticker"
    }
  ],
  "technical_context": {
    "key_levels": "Mention relevant support/resistance price levels if widely known for the primary instrument",
    "indicators_to_watch": "Which technical indicators (MACD, RSI, VWAP, volume) are most relevant and why",
    "entry_trigger": "What price action or indicator signal would confirm this trade"
  },
  "rationale": "2-3 sentence explanation of the trade logic",
  "risks": "1-2 sentence key risk to this trade"
}`;

const POLICY_SYSTEM_PROMPT = `You are a macro policy analyst for a thesis-driven trading system. Analyze the given policy developments for medium-term sector positioning across both traditional markets AND crypto.

CRITICAL CONSISTENCY RULES:
- The signal instrument must align with sector positioning. If a sector is "overweight", the instrument should track that sector (bullish thesis). If "underweight", it implies avoiding or shorting that sector.
- The primary_trade recommendation must be logically consistent with the sector positioning and macro_view.
- Think step by step: first determine policy direction, then sector positioning, then derive the signal logically from those conclusions.
- Always assess crypto implications — regulation, monetary policy, dollar strength, and institutional adoption all affect crypto positioning.

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "policy_direction": "protectionist" | "expansionary" | "restrictive" | "deregulatory" | "mixed",
  "conviction": 1-10 (how clear is the policy signal),
  "sectors": [
    { "name": "Sector Name", "positioning": "overweight" | "underweight" | "neutral", "thesis": "brief explanation", "timeframe": "weeks" | "months" | "quarters" }
  ],
  "crypto_impact": {
    "overall": "bullish" | "bearish" | "neutral",
    "magnitude": 1-10,
    "assets": [
      { "symbol": "BTC" | "ETH" | "SOL" | etc, "impact": "positive" | "negative" | "neutral", "reasoning": "1 sentence" }
    ],
    "narrative": "1 sentence on the policy implications for crypto markets"
  },
  "signal": {
    "primary_trade": "specific positioning recommendation",
    "instrument": "specific ETF, sector ticker, or crypto symbol (e.g. XLK, XLE, IWM, BTCUSD)",
    "confidence": 1-100,
    "hold_period": "days-weeks" | "weeks-months"
  },
  "tickers": [
    {
      "symbol": "TICKER",
      "name": "Full Name",
      "direction": "overweight" | "underweight" | "watch",
      "note": "1 sentence on why this specific ticker"
    }
  ],
  "technical_context": {
    "key_levels": "Mention relevant support/resistance or moving average levels for the primary instrument",
    "indicators_to_watch": "Which technical indicators or macro signals to monitor",
    "entry_trigger": "What conditions would confirm this positioning"
  },
  "macro_view": "2-3 sentence synthesis of the policy landscape and investment implications",
  "risks": "1-2 sentence key risk to this thesis"
}`;

const BATCH_SYSTEM_PROMPT = `You are a market strategist synthesizing multiple news headlines into a unified market briefing. You are given several recent headlines — analyze them together to identify the dominant market narrative, net positioning, and cross-sector themes across both traditional markets AND crypto.

CRITICAL CONSISTENCY RULES:
- The overall_signal must logically follow from the combined sentiment of the headlines.
- If headlines conflict, acknowledge the tension and weight the higher-severity events more heavily.
- Think step by step: identify common themes, assess net market direction, then derive positioning.
- Always include crypto outlook — assess how the combined headlines affect crypto sentiment, regulation, and positioning.

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "market_mood": "risk-on" | "risk-off" | "mixed" | "rotating",
  "severity": 1-10 (overall market impact of these events combined),
  "dominant_narrative": "1-2 sentence summary of what these headlines collectively signal",
  "themes": [
    { "name": "Theme Name", "sentiment": "bullish" | "bearish" | "neutral", "headlines_count": number }
  ],
  "sectors": [
    { "name": "Sector Name", "net_impact": "positive" | "negative" | "neutral", "magnitude": 1-10, "reasoning": "1 sentence" }
  ],
  "crypto_impact": {
    "overall": "bullish" | "bearish" | "neutral",
    "magnitude": 1-10,
    "assets": [
      { "symbol": "BTC" | "ETH" | "SOL" | etc, "impact": "positive" | "negative" | "neutral", "reasoning": "1 sentence" }
    ],
    "narrative": "1-2 sentence synthesis of how these events collectively impact crypto"
  },
  "overall_signal": {
    "action": "LONG" | "SHORT" | "HOLD",
    "instrument": "best single ETF/ticker/crypto for this environment",
    "confidence": 1-100,
    "timeframe": "hours" | "1-2 days" | "week"
  },
  "tickers": [
    {
      "symbol": "TICKER",
      "name": "Full Name",
      "direction": "long" | "short" | "watch",
      "note": "1 sentence"
    }
  ],
  "briefing": "3-5 sentence market briefing synthesizing all the headlines into an actionable outlook",
  "contrarian_view": "1-2 sentence case for the opposite positioning",
  "risks": "1-2 sentence key risks to the dominant thesis"
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  const { mode, text } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing or empty text field" });
  }

  if (mode !== "reactive" && mode !== "policy" && mode !== "batch") {
    return res.status(400).json({ error: "Mode must be 'reactive', 'policy', or 'batch'" });
  }

  if (text.length > 10000) {
    return res.status(400).json({ error: "Text too long (max 10000 characters)" });
  }

  const systemPrompt =
    mode === "batch"
      ? BATCH_SYSTEM_PROMPT
      : mode === "reactive"
      ? REACTIVE_SYSTEM_PROMPT
      : POLICY_SYSTEM_PROMPT;

  // Fetch live benchmark prices to give Claude current market context
  let priceContext = "";
  try {
    const benchmarks = [
      "SPY", "QQQ", "IWM", "DIA",          // broad market
      "XLE", "XLF", "XLK", "XLV", "XLI",   // sector ETFs
      "SOXX", "GLD", "TLT", "UNG",          // semis, gold, bonds, natgas
      "BTC-USD", "ETH-USD", "SOL-USD",      // crypto
      "DX-Y.NYB",                            // dollar index
    ];
    const quotes = await Promise.allSettled(
      benchmarks.map(async (sym) => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
          { headers: { "User-Agent": "AtlasAlpha/1.0" } }
        );
        if (!r.ok) return null;
        const d = await r.json();
        const meta = d.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const label = sym.replace("-USD", "").replace("DX-Y.NYB", "DXY");
        return `${label}: $${meta.regularMarketPrice.toLocaleString()}`;
      })
    );
    const lines = quotes
      .filter((q) => q.status === "fulfilled" && q.value)
      .map((q) => q.value);
    if (lines.length > 0) {
      priceContext = `\n\n[CURRENT MARKET PRICES — use these for any technical levels, support/resistance, and key levels in your analysis]\n${lines.join(" | ")}`;
    }
  } catch {}

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: mode === "batch" ? 2048 : 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: text.trim() + priceContext }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return res.status(502).json({ error: "Upstream API error" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
