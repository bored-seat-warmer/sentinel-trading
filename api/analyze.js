const REACTIVE_SYSTEM_PROMPT = `You are a financial market sentiment analyzer for a real-time news trading system. Analyze the given headline for immediate market impact.

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "severity": 1-10 (10 = maximum market impact),
  "sectors": [
    { "name": "Sector Name", "impact": "positive" | "negative" | "neutral", "magnitude": 1-10 }
  ],
  "signal": {
    "action": "LONG" | "SHORT" | "HOLD",
    "instrument": "specific ETF or ticker suggestion",
    "confidence": 1-100,
    "timeframe": "minutes" | "hours" | "1-2 days"
  },
  "rationale": "2-3 sentence explanation of the trade logic",
  "risks": "1-2 sentence key risk to this trade"
}`;

const POLICY_SYSTEM_PROMPT = `You are a macro policy analyst for a thesis-driven trading system. Analyze the given policy developments for medium-term sector positioning.

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "policy_direction": "protectionist" | "expansionary" | "restrictive" | "deregulatory" | "mixed",
  "conviction": 1-10 (how clear is the policy signal),
  "sectors": [
    { "name": "Sector Name", "positioning": "overweight" | "underweight" | "neutral", "thesis": "brief explanation", "timeframe": "weeks" | "months" | "quarters" }
  ],
  "signal": {
    "primary_trade": "specific positioning recommendation",
    "instrument": "specific ETF or sector suggestion",
    "confidence": 1-100,
    "hold_period": "days-weeks" | "weeks-months"
  },
  "macro_view": "2-3 sentence synthesis of the policy landscape and investment implications",
  "risks": "1-2 sentence key risk to this thesis"
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

  if (mode !== "reactive" && mode !== "policy") {
    return res.status(400).json({ error: "Mode must be 'reactive' or 'policy'" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "Text too long (max 5000 characters)" });
  }

  const systemPrompt = mode === "reactive" ? REACTIVE_SYSTEM_PROMPT : POLICY_SYSTEM_PROMPT;

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
        // Fallback: if your plan doesn't have Sonnet 4, try "claude-3-5-sonnet-20241022"
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: text.trim() }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return res.status(502).json({
        error: `Anthropic API error (${response.status})`,
        detail: errorBody,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
