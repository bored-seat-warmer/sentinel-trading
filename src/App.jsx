import { useState, useCallback, useEffect, useRef } from "react";
import TradingViewChart from "./TradingViewChart";

const SECTOR_COLORS = {
  Technology: "#00d4ff",
  Semiconductors: "#7b61ff",
  Finance: "#00e599",
  Energy: "#ff6b35",
  Defense: "#ff3366",
  Healthcare: "#ffcc00",
  Manufacturing: "#ff61d8",
  "Real Estate": "#88cc44",
  Utilities: "#44aaff",
  Retail: "#ffaa44",
  Telecom: "#aa88ff",
  Automotive: "#ff8844",
  Agriculture: "#66dd66",
  Crypto: "#f7931a",
  Bitcoin: "#f7931a",
  Ethereum: "#627eea",
  DeFi: "#8b5cf6",
};

const getSectorColor = (sector) => SECTOR_COLORS[sector] || "#888";

const HISTORY_KEY = "atlas-alpha-history";
const MAX_HISTORY = 50;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return items.map((h) => ({ ...h, timestamp: new Date(h.timestamp) }));
  } catch {
    return [];
  }
};

const saveHistory = (items) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // Storage full or unavailable — silently degrade
  }
};

const parseAIResponse = (raw) => {
  // Try direct parse first
  try { return JSON.parse(raw); } catch {}
  // Try extracting JSON object from surrounding text
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  throw new Error(
    "The AI returned a non-structured response. This usually happens with vague or non-news headlines. Try a more specific headline."
  );
};

const KNOWN_CRYPTO = ["BTC", "ETH", "SOL", "AVAX", "ADA", "DOT", "MATIC", "LINK", "UNI", "AAVE", "XRP", "DOGE", "SHIB", "BNB", "LTC"];

const extractSymbol = (instrument) => {
  if (!instrument) return null;
  const upper = instrument.toUpperCase();
  // Check for crypto pairs like BTCUSD, BTC-USD, BTC/USD
  for (const c of KNOWN_CRYPTO) {
    if (upper.includes(c)) return c;
  }
  // Match standalone uppercase ticker patterns like "SOXX", "SPY", "XLF"
  const match = instrument.match(/\b([A-Z]{1,5})\b/);
  return match ? match[1] : null;
};

const PriceTag = ({ symbol, prices: p }) => {
  const data = p[symbol?.toUpperCase()];
  if (!data) return null;
  const isUp = data.change >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
      <span style={{ fontSize: "12px", color: "#e0e4ea", fontWeight: 500 }}>
        ${data.price.toLocaleString()}
      </span>
      <span style={{ fontSize: "10px", color: isUp ? "#00e599" : "#ff3366", fontWeight: 600 }}>
        {isUp ? "+" : ""}{data.change} ({isUp ? "+" : ""}{data.changePercent}%)
      </span>
    </span>
  );
};

const tickerLinks = (symbol) => ({
  tradingview: `https://www.tradingview.com/chart/?symbol=${symbol}`,
  yahoo: `https://finance.yahoo.com/quote/${symbol}`,
  finviz: `https://finviz.com/quote.ashx?t=${symbol}`,
});

export default function SentimentTradingDashboard() {
  const [mode, setMode] = useState("reactive");
  const [headline, setHeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [error, setError] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [activeCategories, setActiveCategories] = useState(
    new Set(["Politics", "Economy", "Congress", "Crypto"])
  );
  const [lastRefresh, setLastRefresh] = useState(null);
  const [trumpFilter, setTrumpFilter] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [batchAnalysis, setBatchAnalysis] = useState(null);
  const [prices, setPrices] = useState({});
  const [technicals, setTechnicals] = useState({});
  const [regime, setRegime] = useState(null);
  const resultsRef = useRef(null);

  const NEWS_CATEGORIES = ["Politics", "Economy", "Congress", "Crypto"];
  const AUTO_REFRESH_MS = 5 * 60 * 1000;

  const toggleCategory = (cat) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const filteredNews = news
    .filter((a) => activeCategories.has(a.category))
    .filter((a) => !trumpFilter || /trump/i.test(a.title));

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed to fetch news");
      const data = await res.json();
      setNews(data.articles || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      setNewsError("Could not load news feed.");
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    fetch("/api/regime")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRegime(d.regime))
      .catch(() => {});
    const interval = setInterval(fetchNews, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const fetchPrices = useCallback(async (analysisData) => {
    const symbols = new Set();
    const primary = extractSymbol(analysisData.signal?.instrument || analysisData.overall_signal?.instrument);
    if (primary) symbols.add(primary);
    analysisData.tickers?.forEach((t) => { if (t.symbol) symbols.add(t.symbol); });
    analysisData.crypto_impact?.assets?.forEach((a) => { if (a.symbol) symbols.add(a.symbol); });

    if (symbols.size === 0) return;

    const symList = [...symbols].join(",");
    try {
      const [priceRes, techRes] = await Promise.all([
        fetch(`/api/prices?symbols=${symList}`),
        fetch(`/api/technicals?symbols=${symList}`),
      ]);
      if (priceRes.ok) {
        const data = await priceRes.json();
        setPrices((prev) => ({ ...prev, ...data.prices }));
      }
      if (techRes.ok) {
        const data = await techRes.json();
        setTechnicals((prev) => ({ ...prev, ...data.technicals }));
      }
    } catch {}
  }, []);

  const analyzeHeadline = useCallback(
    async (text) => {
      if (!text.trim()) return;
      setLoading(true);
      setError(null);
      setAnalysis(null);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, text }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        const raw = data.content
          ?.map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .replace(/```json|```/g, "")
          .trim();

        const parsed = parseAIResponse(raw);
        setAnalysis(parsed);
        setBatchAnalysis(null);
        fetchPrices(parsed);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

        // Check for high-severity alert
        const severity = parsed.severity || parsed.conviction || 0;
        const confidence = parsed.signal?.confidence || 0;
        if (severity >= 8 || confidence >= 80) {
          const alert = {
            id: Date.now(),
            mode,
            severity,
            confidence,
            sentiment: parsed.sentiment || parsed.policy_direction,
            action: parsed.signal?.action || parsed.signal?.primary_trade,
            instrument: parsed.signal?.instrument,
            headline: text.split("\n")[0].slice(0, 100),
            timestamp: new Date(),
          };
          setAlerts((prev) => [alert, ...prev]);

          // Audio ping
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = severity >= 9 ? 880 : 660;
            osc.type = "sine";
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.stop(ctx.currentTime + 0.4);
          } catch {}
        }

        setHistory((prev) => {
          const next = [
            { text, mode, analysis: parsed, timestamp: new Date() },
            ...prev.slice(0, MAX_HISTORY - 1),
          ];
          saveHistory(next);
          return next;
        });
      } catch (err) {
        console.error(err);
        setError(err.message || "Analysis failed — check the console for details.");
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  const handleSubmit = () => {
    analyzeHeadline(headline);
  };

  const analyzeArticle = (title, description) => {
    const text = description
      ? `${title}\n\n${description}`
      : title;
    setHeadline(text);
    analyzeHeadline(text);
  };

  const toggleSelectArticle = (index) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const runBatchAnalysis = async () => {
    const selected = filteredNews.filter((_, i) => selectedArticles.has(i));
    if (selected.length < 2) return;

    const text = selected
      .map((a, i) => {
        const body = a.description ? `${a.title}\n${a.description}` : a.title;
        return `[${i + 1}] ${body}`;
      })
      .join("\n\n");

    setHeadline(text);
    setLoading(true);
    setError(null);
    setBatchAnalysis(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "batch", text }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const raw = data.content
        ?.map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .replace(/```json|```/g, "")
        .trim();

      const parsed = parseAIResponse(raw);
      setBatchAnalysis(parsed);
      setAnalysis(null);
      fetchPrices(parsed);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      setSelectedArticles(new Set());
    } catch (err) {
      console.error(err);
      setError(err.message || "Batch analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.scanline} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>&#9650;</span>
            <span style={styles.logoText}>ATLAS ALPHA</span>
          </div>
          <span style={styles.tagline}>Political Sentiment Trading System</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statusDot} />
          <span style={styles.statusText}>PROTOTYPE</span>
        </div>
      </header>

      {/* Alert Banners */}
      {alerts.length > 0 && (
        <div style={styles.alertContainer}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                ...styles.alertBanner,
                borderColor:
                  alert.severity >= 9 ? "#ff3366" : "#ffcc00",
              }}
            >
              <div style={styles.alertLeft}>
                <span
                  style={{
                    ...styles.alertSeverity,
                    background: alert.severity >= 9 ? "#ff3366" : "#ffcc00",
                  }}
                >
                  SEVERITY {alert.severity}/10
                </span>
                <span
                  style={{
                    ...styles.alertAction,
                    color:
                      alert.action === "LONG"
                        ? "#00e599"
                        : alert.action === "SHORT"
                        ? "#ff3366"
                        : "#7b61ff",
                  }}
                >
                  {alert.action}
                </span>
                <span style={styles.alertInstrument}>{alert.instrument}</span>
                <span style={styles.alertConfidence}>
                  {alert.confidence}% confidence
                </span>
              </div>
              <div style={styles.alertRight}>
                <span style={styles.alertHeadline}>{alert.headline}</span>
                <span style={styles.alertTime}>
                  {alert.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <button
                onClick={() =>
                  setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
                }
                style={styles.alertDismiss}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Market Regime Bar */}
      {regime && (
        <div style={styles.regimeBar}>
          <div style={styles.regimeOverall}>
            <span style={styles.regimeLabel}>MARKET REGIME</span>
            <span
              style={{
                ...styles.regimeBadge,
                background:
                  regime.overall === "RISK-ON" ? "#00e599"
                    : regime.overall === "RISK-OFF" ? "#ff3366"
                    : "#ffcc00",
              }}
            >
              {regime.overall}
            </span>
          </div>
          <div style={styles.regimeIndicators}>
            {regime.vix && (
              <div style={styles.regimeItem}>
                <span style={styles.regimeItemLabel}>VIX</span>
                <span
                  style={{
                    ...styles.regimeItemValue,
                    color: regime.vix.value <= 15 ? "#00e599"
                      : regime.vix.value <= 20 ? "#ffcc00"
                      : regime.vix.value <= 30 ? "#ff6b35"
                      : "#ff3366",
                  }}
                >
                  {regime.vix.value}
                </span>
                <span style={styles.regimeItemSub}>
                  {regime.vix.trend || ""}
                </span>
              </div>
            )}
            {regime.spyTrend && (
              <div style={styles.regimeItem}>
                <span style={styles.regimeItemLabel}>SPY TREND</span>
                <span
                  style={{
                    ...styles.regimeItemValue,
                    color: regime.spyTrend.trend === "BULLISH" ? "#00e599"
                      : regime.spyTrend.trend === "BEARISH" ? "#ff3366"
                      : "#ffcc00",
                  }}
                >
                  {regime.spyTrend.trend}
                </span>
              </div>
            )}
            {regime.breadth && (
              <div style={styles.regimeItem}>
                <span style={styles.regimeItemLabel}>BREADTH</span>
                <span
                  style={{
                    ...styles.regimeItemValue,
                    color: regime.breadth.spread > 1 ? "#00e599"
                      : regime.breadth.spread < -1 ? "#ff3366"
                      : "#889",
                  }}
                >
                  {regime.breadth.spread > 1 ? "BROAD"
                    : regime.breadth.spread < -1 ? "NARROW"
                    : "BALANCED"}
                </span>
              </div>
            )}
            {regime.credit && (
              <div style={styles.regimeItem}>
                <span style={styles.regimeItemLabel}>CREDIT</span>
                <span
                  style={{
                    ...styles.regimeItemValue,
                    color: regime.credit.change1m < -2 ? "#ff3366"
                      : regime.credit.change1m > 1 ? "#00e599"
                      : "#889",
                  }}
                >
                  {regime.credit.change1m < -2 ? "STRESS"
                    : regime.credit.change1m > 1 ? "CALM"
                    : "STABLE"}
                </span>
              </div>
            )}
            {regime.yieldCurve && (
              <div style={styles.regimeItem}>
                <span style={styles.regimeItemLabel}>YIELD CURVE</span>
                <span style={{ ...styles.regimeItemValue, color: "#889" }}>
                  {regime.yieldCurve.trend?.toUpperCase() || "N/A"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div style={styles.modeBar}>
        <button
          onClick={() => {
            setMode("reactive");
            setAnalysis(null);
            setHeadline("");
          }}
          style={{
            ...styles.modeBtn,
            ...(mode === "reactive" ? styles.modeBtnActive : {}),
          }}
        >
          <span style={styles.modeDot(mode === "reactive")} />
          MODE 1 — REACTIVE NEWS
        </button>
        <button
          onClick={() => {
            setMode("policy");
            setAnalysis(null);
            setHeadline("");
          }}
          style={{
            ...styles.modeBtn,
            ...(mode === "policy" ? styles.modeBtnActiveAlt : {}),
          }}
        >
          <span style={styles.modeDot(mode === "policy", true)} />
          MODE 2 — POLICY MAPPING
        </button>
        <div style={styles.modeDescription}>
          {mode === "reactive"
            ? "Fast, event-driven analysis. Detects headline impact and generates immediate trade signals."
            : "Thesis-driven analysis. Maps policy developments to sector positioning over weeks/months."}
        </div>
      </div>

      {/* Input Area */}
      <div style={styles.inputSection}>
        <label style={styles.inputLabel}>
          {mode === "reactive"
            ? "PASTE A NEWS HEADLINE"
            : "DESCRIBE POLICY DEVELOPMENTS"}
        </label>
        <div style={styles.inputRow}>
          <textarea
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={
              mode === "reactive"
                ? "e.g., President announces 25% tariff on semiconductor imports..."
                : "e.g., Administration outlines 5-year plan for domestic chip manufacturing..."
            }
            style={styles.textarea}
            rows={3}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !headline.trim()}
            style={{
              ...styles.analyzeBtn,
              opacity: loading || !headline.trim() ? 0.4 : 1,
            }}
          >
            {loading ? "ANALYZING..." : "ANALYZE"}
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Loading */}
      {loading && (
        <div style={styles.loadingBox}>
          <div style={styles.loadingBar}>
            <div style={styles.loadingFill} />
          </div>
          <span style={styles.loadingText}>
            {mode === "reactive"
              ? "Scanning headline for market signals..."
              : "Mapping policy landscape to sectors..."}
          </span>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div ref={resultsRef}>
          <div style={styles.resultsGrid}>
            {/* Signal Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>SIGNAL</div>
              <div style={styles.signalContent}>
                {mode === "reactive" ? (
                  <>
                    <div
                      style={{
                        ...styles.signalBadge,
                        background:
                          analysis.signal?.action === "LONG"
                            ? "#00e599"
                            : analysis.signal?.action === "SHORT"
                            ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {analysis.signal?.action}
                    </div>
                    <div style={styles.signalInstrument}>
                      {analysis.signal?.instrument}
                      <PriceTag symbol={extractSymbol(analysis.signal?.instrument)} prices={prices} />
                      {extractSymbol(analysis.signal?.instrument) && (
                        <span style={styles.tickerLinks}>
                          {Object.entries(tickerLinks(extractSymbol(analysis.signal.instrument))).map(
                            ([name, url]) => (
                              <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={styles.tickerLink}>
                                {name === "tradingview" ? "TV" : name === "yahoo" ? "Yahoo" : "Finviz"}
                              </a>
                            )
                          )}
                        </span>
                      )}
                    </div>
                    <div style={styles.signalMeta}>
                      <span>Confidence: {analysis.signal?.confidence}%</span>
                      <span>Timeframe: {analysis.signal?.timeframe}</span>
                    </div>
                    <div style={styles.severityRow}>
                      <span style={styles.severityLabel}>SEVERITY</span>
                      <div style={styles.severityBar}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              ...styles.severityBlock,
                              background:
                                i < analysis.severity
                                  ? analysis.severity >= 8
                                    ? "#ff3366"
                                    : analysis.severity >= 5
                                    ? "#ffcc00"
                                    : "#00e599"
                                  : "rgba(255,255,255,0.06)",
                            }}
                          />
                        ))}
                      </div>
                      <span style={styles.severityValue}>
                        {analysis.severity}/10
                      </span>
                    </div>
                    <div
                      style={{
                        ...styles.sentimentTag,
                        color:
                          analysis.sentiment === "bullish"
                            ? "#00e599"
                            : analysis.sentiment === "bearish"
                            ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {analysis.sentiment?.toUpperCase()}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{ ...styles.signalBadge, background: "#7b61ff" }}
                    >
                      {analysis.signal?.primary_trade?.slice(0, 30)}
                    </div>
                    <div style={styles.signalInstrument}>
                      {analysis.signal?.instrument}
                      <PriceTag symbol={extractSymbol(analysis.signal?.instrument)} prices={prices} />
                      {extractSymbol(analysis.signal?.instrument) && (
                        <span style={styles.tickerLinks}>
                          {Object.entries(tickerLinks(extractSymbol(analysis.signal.instrument))).map(
                            ([name, url]) => (
                              <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={styles.tickerLink}>
                                {name === "tradingview" ? "TV" : name === "yahoo" ? "Yahoo" : "Finviz"}
                              </a>
                            )
                          )}
                        </span>
                      )}
                    </div>
                    <div style={styles.signalMeta}>
                      <span>Confidence: {analysis.signal?.confidence}%</span>
                      <span>Hold: {analysis.signal?.hold_period}</span>
                    </div>
                    <div style={styles.severityRow}>
                      <span style={styles.severityLabel}>CONVICTION</span>
                      <div style={styles.severityBar}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              ...styles.severityBlock,
                              background:
                                i < analysis.conviction
                                  ? "#7b61ff"
                                  : "rgba(255,255,255,0.06)",
                            }}
                          />
                        ))}
                      </div>
                      <span style={styles.severityValue}>
                        {analysis.conviction}/10
                      </span>
                    </div>
                    <div style={{ ...styles.sentimentTag, color: "#7b61ff" }}>
                      {analysis.policy_direction?.toUpperCase()}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sector Impact */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>SECTOR IMPACT</div>
              <div style={styles.sectorList}>
                {analysis.sectors?.map((s, i) => (
                  <div key={i} style={styles.sectorRow}>
                    <div
                      style={{
                        ...styles.sectorDot,
                        background: getSectorColor(s.name),
                      }}
                    />
                    <span style={styles.sectorName}>{s.name}</span>
                    <span
                      style={{
                        ...styles.sectorImpact,
                        color:
                          (s.impact || s.positioning) === "positive" ||
                          s.positioning === "overweight"
                            ? "#00e599"
                            : (s.impact || s.positioning) === "negative" ||
                              s.positioning === "underweight"
                            ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {mode === "reactive"
                        ? `${s.impact?.toUpperCase()} (${s.magnitude}/10)`
                        : `${s.positioning?.toUpperCase()}`}
                    </span>
                    {mode === "policy" && s.thesis && (
                      <span style={styles.sectorThesis}>{s.thesis}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tickers */}
            {analysis.tickers?.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>RELATED TICKERS</div>
                <div style={styles.tickerList}>
                  {analysis.tickers.map((t, i) => (
                    <div key={i} style={styles.tickerRow}>
                      <div style={styles.tickerRowTop}>
                        <span
                          style={{
                            ...styles.tickerSymbol,
                            color:
                              t.direction === "long" || t.direction === "overweight"
                                ? "#00e599"
                                : t.direction === "short" || t.direction === "underweight"
                                ? "#ff3366"
                                : "#ffcc00",
                          }}
                        >
                          {t.symbol}
                        </span>
                        <PriceTag symbol={t.symbol} prices={prices} />
                        <span style={styles.tickerName}>{t.name}</span>
                        <span
                          style={{
                            ...styles.tickerDirection,
                            color:
                              t.direction === "long" || t.direction === "overweight"
                                ? "#00e599"
                                : t.direction === "short" || t.direction === "underweight"
                                ? "#ff3366"
                                : "#ffcc00",
                          }}
                        >
                          {t.direction?.toUpperCase()}
                        </span>
                      </div>
                      <div style={styles.tickerNote}>{t.note}</div>
                      <div style={styles.tickerRowLinks}>
                        {Object.entries(tickerLinks(t.symbol)).map(([name, url]) => (
                          <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={styles.tickerLink}>
                            {name === "tradingview" ? "TradingView" : name === "yahoo" ? "Yahoo Finance" : "Finviz"}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Crypto Impact */}
            {analysis.crypto_impact && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>CRYPTO IMPACT</div>
                <div style={styles.signalContent}>
                  <div style={styles.cryptoOverall}>
                    <span
                      style={{
                        ...styles.signalBadge,
                        background:
                          analysis.crypto_impact.overall === "bullish"
                            ? "#00e599"
                            : analysis.crypto_impact.overall === "bearish"
                            ? "#ff3366"
                            : "#888",
                        fontSize: "11px",
                        padding: "4px 12px",
                      }}
                    >
                      {analysis.crypto_impact.overall?.toUpperCase()}
                    </span>
                    <span style={styles.severityValue}>
                      {analysis.crypto_impact.magnitude}/10
                    </span>
                  </div>
                  <div style={styles.cryptoNarrative}>
                    {analysis.crypto_impact.narrative}
                  </div>
                  <div style={styles.sectorList}>
                    {analysis.crypto_impact.assets?.map((a, i) => (
                      <div key={i} style={styles.sectorRow}>
                        <div
                          style={{
                            ...styles.sectorDot,
                            background:
                              a.symbol === "BTC" ? "#f7931a"
                                : a.symbol === "ETH" ? "#627eea"
                                : a.symbol === "SOL" ? "#9945ff"
                                : "#888",
                          }}
                        />
                        <span style={styles.sectorName}>{a.symbol}</span>
                        <PriceTag symbol={a.symbol} prices={prices} />
                        <span
                          style={{
                            ...styles.sectorImpact,
                            color:
                              a.impact === "positive" ? "#00e599"
                                : a.impact === "negative" ? "#ff3366"
                                : "#888",
                          }}
                        >
                          {a.impact?.toUpperCase()}
                        </span>
                        <span style={styles.sectorThesis}>{a.reasoning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Technical Context */}
            {(() => {
              const sym = extractSymbol(analysis.signal?.instrument);
              const t = sym && technicals[sym.toUpperCase()];
              return (analysis.entry_trigger || analysis.technical_context || t) ? (
                <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
                  <div style={styles.cardHeader}>
                    TECHNICAL CONTEXT {sym ? `— ${sym}` : ""}
                  </div>
                  {t && (
                    <div style={styles.indicatorGrid}>
                      <div style={styles.indicatorCard}>
                        <span style={styles.indicatorLabel}>RSI (14)</span>
                        <span style={{
                          ...styles.indicatorValue,
                          color: t.rsi14 >= 70 ? "#ff3366" : t.rsi14 <= 30 ? "#00e599" : "#e0e4ea",
                        }}>
                          {t.rsi14}
                        </span>
                        <span style={styles.indicatorTag}>
                          {t.rsi14 >= 70 ? "OVERBOUGHT" : t.rsi14 <= 30 ? "OVERSOLD" : "NEUTRAL"}
                        </span>
                      </div>
                      {t.macd && (
                        <div style={styles.indicatorCard}>
                          <span style={styles.indicatorLabel}>MACD</span>
                          <span style={{
                            ...styles.indicatorValue,
                            color: t.macd.histogram >= 0 ? "#00e599" : "#ff3366",
                          }}>
                            {t.macd.histogram > 0 ? "+" : ""}{t.macd.histogram}
                          </span>
                          <span style={{
                            ...styles.indicatorTag,
                            color: t.macd.crossover === "bullish" ? "#00e599"
                              : t.macd.crossover === "bearish" ? "#ff3366" : "#556",
                          }}>
                            {t.macd.crossover !== "none" ? `${t.macd.crossover.toUpperCase()} CROSS` : "NO CROSS"}
                          </span>
                        </div>
                      )}
                      {t.bollingerBands && (
                        <div style={styles.indicatorCard}>
                          <span style={styles.indicatorLabel}>BOLLINGER</span>
                          <span style={styles.indicatorValue}>
                            ${t.bollingerBands.lower} — ${t.bollingerBands.upper}
                          </span>
                          <span style={styles.indicatorTag}>
                            {t.bollingerBands.position >= 0.9 ? "NEAR UPPER"
                              : t.bollingerBands.position <= 0.1 ? "NEAR LOWER"
                              : `${Math.round(t.bollingerBands.position * 100)}% IN BAND`}
                          </span>
                        </div>
                      )}
                      {t.volume && (
                        <div style={styles.indicatorCard}>
                          <span style={styles.indicatorLabel}>VOLUME</span>
                          <span style={{
                            ...styles.indicatorValue,
                            color: t.volume.ratio >= 1.5 ? "#ffcc00" : "#e0e4ea",
                          }}>
                            {t.volume.ratio}x
                          </span>
                          <span style={styles.indicatorTag}>vs 20d avg</span>
                        </div>
                      )}
                      {t.returns && (
                        <div style={styles.indicatorCard}>
                          <span style={styles.indicatorLabel}>RETURNS</span>
                          <div style={styles.returnsList}>
                            {Object.entries(t.returns).filter(([,v]) => v != null).map(([k, v]) => (
                              <span key={k} style={{ color: v >= 0 ? "#00e599" : "#ff3366", fontSize: "11px" }}>
                                {k}: {v > 0 ? "+" : ""}{v}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.range && (
                        <div style={styles.indicatorCard}>
                          <span style={styles.indicatorLabel}>6M RANGE</span>
                          <span style={styles.indicatorValue}>
                            ${t.range.low.toLocaleString()} — ${t.range.high.toLocaleString()}
                          </span>
                          <span style={styles.indicatorTag}>
                            {Math.round(t.range.position * 100)}% from low
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {(analysis.entry_trigger || analysis.technical_context?.entry_trigger) && (
                    <div style={{ ...styles.techList, marginTop: t ? "16px" : 0, paddingTop: t ? "16px" : 0, borderTop: t ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div style={styles.techItem}>
                        <span style={styles.techLabel}>ENTRY TRIGGER</span>
                        <span style={styles.techValue}>{analysis.entry_trigger || analysis.technical_context?.entry_trigger}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Rationale */}
            <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
              <div style={styles.cardHeader}>
                {mode === "reactive" ? "TRADE RATIONALE" : "MACRO VIEW"}
              </div>
              <p style={styles.rationale}>
                {mode === "reactive" ? analysis.rationale : analysis.macro_view}
              </p>
              <div style={styles.riskBox}>
                <span style={styles.riskLabel}>KEY RISK</span>
                <span style={styles.riskText}>{analysis.risks}</span>
              </div>
            </div>
          </div>

          {/* TradingView Chart */}
          {extractSymbol(analysis.signal?.instrument) && (
            <div style={styles.chartSection}>
              <div style={styles.chartHeader}>
                <span style={styles.cardHeader}>
                  CHART — {extractSymbol(analysis.signal.instrument)}
                </span>
                <a
                  href={`https://www.tradingview.com/chart/?symbol=${extractSymbol(analysis.signal.instrument)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.fullChartLink}
                >
                  OPEN FULL CHART
                </a>
              </div>
              <TradingViewChart symbol={extractSymbol(analysis.signal.instrument)} />
            </div>
          )}
        </div>
      )}

      {/* Batch Results */}
      {batchAnalysis && !loading && (
        <div ref={resultsRef} style={styles.batchResults}>
          <div style={styles.batchResultsHeader}>
            <span style={styles.cardHeader}>MARKET BRIEFING</span>
            <span
              style={{
                ...styles.batchMood,
                color:
                  batchAnalysis.market_mood === "risk-on"
                    ? "#00e599"
                    : batchAnalysis.market_mood === "risk-off"
                    ? "#ff3366"
                    : "#ffcc00",
              }}
            >
              {batchAnalysis.market_mood?.toUpperCase()}
            </span>
          </div>

          <div style={styles.resultsGrid}>
            {/* Signal */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>OVERALL SIGNAL</div>
              <div style={styles.signalContent}>
                <div
                  style={{
                    ...styles.signalBadge,
                    background:
                      batchAnalysis.overall_signal?.action === "LONG"
                        ? "#00e599"
                        : batchAnalysis.overall_signal?.action === "SHORT"
                        ? "#ff3366"
                        : "#888",
                  }}
                >
                  {batchAnalysis.overall_signal?.action}
                </div>
                <div style={styles.signalInstrument}>
                  {batchAnalysis.overall_signal?.instrument}
                  <PriceTag symbol={extractSymbol(batchAnalysis.overall_signal?.instrument)} prices={prices} />
                  {extractSymbol(batchAnalysis.overall_signal?.instrument) && (
                    <span style={styles.tickerLinks}>
                      {Object.entries(tickerLinks(extractSymbol(batchAnalysis.overall_signal.instrument))).map(
                        ([name, url]) => (
                          <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={styles.tickerLink}>
                            {name === "tradingview" ? "TV" : name === "yahoo" ? "Yahoo" : "Finviz"}
                          </a>
                        )
                      )}
                    </span>
                  )}
                </div>
                <div style={styles.signalMeta}>
                  <span>Confidence: {batchAnalysis.overall_signal?.confidence}%</span>
                  <span>Timeframe: {batchAnalysis.overall_signal?.timeframe}</span>
                </div>
                <div style={styles.severityRow}>
                  <span style={styles.severityLabel}>SEVERITY</span>
                  <div style={styles.severityBar}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.severityBlock,
                          background:
                            i < batchAnalysis.severity
                              ? batchAnalysis.severity >= 8
                                ? "#ff3366"
                                : batchAnalysis.severity >= 5
                                ? "#ffcc00"
                                : "#00e599"
                              : "rgba(255,255,255,0.06)",
                        }}
                      />
                    ))}
                  </div>
                  <span style={styles.severityValue}>{batchAnalysis.severity}/10</span>
                </div>
              </div>
            </div>

            {/* Themes */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>THEMES</div>
              <div style={styles.sectorList}>
                {batchAnalysis.themes?.map((t, i) => (
                  <div key={i} style={styles.sectorRow}>
                    <div
                      style={{
                        ...styles.sectorDot,
                        background:
                          t.sentiment === "bullish" ? "#00e599"
                            : t.sentiment === "bearish" ? "#ff3366"
                            : "#888",
                      }}
                    />
                    <span style={styles.sectorName}>{t.name}</span>
                    <span
                      style={{
                        ...styles.sectorImpact,
                        color:
                          t.sentiment === "bullish" ? "#00e599"
                            : t.sentiment === "bearish" ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {t.sentiment?.toUpperCase()} ({t.headlines_count})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sectors */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>NET SECTOR IMPACT</div>
              <div style={styles.sectorList}>
                {batchAnalysis.sectors?.map((s, i) => (
                  <div key={i} style={styles.sectorRow}>
                    <div
                      style={{
                        ...styles.sectorDot,
                        background: getSectorColor(s.name),
                      }}
                    />
                    <span style={styles.sectorName}>{s.name}</span>
                    <span
                      style={{
                        ...styles.sectorImpact,
                        color:
                          s.net_impact === "positive" ? "#00e599"
                            : s.net_impact === "negative" ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {s.net_impact?.toUpperCase()} ({s.magnitude}/10)
                    </span>
                    {s.reasoning && (
                      <span style={styles.sectorThesis}>{s.reasoning}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Crypto Impact */}
            {batchAnalysis.crypto_impact && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>CRYPTO IMPACT</div>
                <div style={styles.signalContent}>
                  <div style={styles.cryptoOverall}>
                    <span
                      style={{
                        ...styles.signalBadge,
                        background:
                          batchAnalysis.crypto_impact.overall === "bullish"
                            ? "#00e599"
                            : batchAnalysis.crypto_impact.overall === "bearish"
                            ? "#ff3366"
                            : "#888",
                        fontSize: "11px",
                        padding: "4px 12px",
                      }}
                    >
                      {batchAnalysis.crypto_impact.overall?.toUpperCase()}
                    </span>
                    <span style={styles.severityValue}>
                      {batchAnalysis.crypto_impact.magnitude}/10
                    </span>
                  </div>
                  <div style={styles.cryptoNarrative}>
                    {batchAnalysis.crypto_impact.narrative}
                  </div>
                  <div style={styles.sectorList}>
                    {batchAnalysis.crypto_impact.assets?.map((a, i) => (
                      <div key={i} style={styles.sectorRow}>
                        <div
                          style={{
                            ...styles.sectorDot,
                            background:
                              a.symbol === "BTC" ? "#f7931a"
                                : a.symbol === "ETH" ? "#627eea"
                                : a.symbol === "SOL" ? "#9945ff"
                                : "#888",
                          }}
                        />
                        <span style={styles.sectorName}>{a.symbol}</span>
                        <PriceTag symbol={a.symbol} prices={prices} />
                        <span
                          style={{
                            ...styles.sectorImpact,
                            color:
                              a.impact === "positive" ? "#00e599"
                                : a.impact === "negative" ? "#ff3366"
                                : "#888",
                          }}
                        >
                          {a.impact?.toUpperCase()}
                        </span>
                        <span style={styles.sectorThesis}>{a.reasoning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tickers */}
            {batchAnalysis.tickers?.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>TICKERS TO WATCH</div>
                <div style={styles.tickerList}>
                  {batchAnalysis.tickers.map((t, i) => (
                    <div key={i} style={styles.tickerRow}>
                      <div style={styles.tickerRowTop}>
                        <span
                          style={{
                            ...styles.tickerSymbol,
                            color:
                              t.direction === "long" ? "#00e599"
                                : t.direction === "short" ? "#ff3366"
                                : "#ffcc00",
                          }}
                        >
                          {t.symbol}
                        </span>
                        <PriceTag symbol={t.symbol} prices={prices} />
                        <span style={styles.tickerName}>{t.name}</span>
                        <span
                          style={{
                            ...styles.tickerDirection,
                            color:
                              t.direction === "long" ? "#00e599"
                                : t.direction === "short" ? "#ff3366"
                                : "#ffcc00",
                          }}
                        >
                          {t.direction?.toUpperCase()}
                        </span>
                      </div>
                      <div style={styles.tickerNote}>{t.note}</div>
                      <div style={styles.tickerRowLinks}>
                        {Object.entries(tickerLinks(t.symbol)).map(([name, url]) => (
                          <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={styles.tickerLink}>
                            {name === "tradingview" ? "TradingView" : name === "yahoo" ? "Yahoo Finance" : "Finviz"}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Briefing */}
            <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
              <div style={styles.cardHeader}>BRIEFING</div>
              <p style={styles.rationale}>{batchAnalysis.dominant_narrative}</p>
              <p style={{ ...styles.rationale, marginTop: "12px" }}>{batchAnalysis.briefing}</p>
              <div style={{ ...styles.riskBox, marginTop: "16px" }}>
                <span style={styles.riskLabel}>KEY RISK</span>
                <span style={styles.riskText}>{batchAnalysis.risks}</span>
              </div>
              {batchAnalysis.contrarian_view && (
                <div style={{ ...styles.riskBox, marginTop: "8px", borderColor: "rgba(123,97,255,0.15)", background: "rgba(123,97,255,0.04)" }}>
                  <span style={{ ...styles.riskLabel, color: "#7b61ff" }}>CONTRARIAN</span>
                  <span style={styles.riskText}>{batchAnalysis.contrarian_view}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live News Feed */}
      <div style={styles.newsSection}>
        <div style={styles.newsHeader}>
          <span style={styles.cardHeader}>LIVE NEWS FEED</span>
          <div style={styles.newsControls}>
            {lastRefresh && (
              <span style={styles.lastRefresh}>
                Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchNews}
              disabled={newsLoading}
              style={styles.refreshBtn}
            >
              {newsLoading ? "REFRESHING..." : "REFRESH"}
            </button>
          </div>
        </div>
        <div style={styles.filterBar}>
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              style={{
                ...styles.filterBtn,
                ...(activeCategories.has(cat)
                  ? cat === "Crypto"
                    ? styles.filterBtnCrypto
                    : styles.filterBtnActive
                  : {}),
              }}
            >
              {cat}
            </button>
          ))}
          <span style={styles.filterDivider} />
          <button
            onClick={() => setTrumpFilter((v) => !v)}
            style={{
              ...styles.filterBtn,
              ...(trumpFilter ? styles.filterBtnTrump : {}),
            }}
          >
            TRUMP TRACKER
          </button>
          <span style={styles.filterCount}>
            {filteredNews.length} article{filteredNews.length !== 1 ? "s" : ""}
          </span>
        </div>
        {newsError && <div style={styles.newsError}>{newsError}</div>}
        {newsLoading && news.length === 0 && (
          <div style={styles.newsLoadingText}>Loading headlines...</div>
        )}
        {selectedArticles.size >= 2 && (
          <div style={styles.batchBar}>
            <span style={styles.batchCount}>
              {selectedArticles.size} selected
            </span>
            <button
              onClick={runBatchAnalysis}
              disabled={loading}
              style={styles.batchBtn}
            >
              {loading ? "ANALYZING..." : "BATCH ANALYZE"}
            </button>
            <button
              onClick={() => setSelectedArticles(new Set())}
              style={styles.batchClear}
            >
              CLEAR
            </button>
          </div>
        )}
        <div style={styles.newsList}>
          {filteredNews.map((article, i) => (
            <div
              key={i}
              style={{
                ...styles.newsItem,
                ...(selectedArticles.has(i) ? styles.newsItemSelected : {}),
              }}
            >
              <div style={styles.newsItemRow}>
                <div
                  style={{
                    ...styles.newsCheckbox,
                    ...(selectedArticles.has(i) ? styles.newsCheckboxChecked : {}),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectArticle(i);
                  }}
                >
                  {selectedArticles.has(i) && (
                    <span style={styles.checkMark}>&#10003;</span>
                  )}
                </div>
                <div
                  style={styles.newsClickable}
                  onClick={() => analyzeArticle(article.title, article.description)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={styles.newsItemTop}>
                    <span style={styles.newsSource}>{article.source}</span>
                    <span style={styles.newsCategory}>{article.category}</span>
                    <span style={styles.newsTime}>
                      {article.pubDate
                        ? new Date(article.pubDate).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <div style={styles.newsTitle}>{article.title}</div>
                </div>
              </div>
              {article.link && (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.articleLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  READ ARTICLE
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={styles.historySection}>
          <div style={styles.historyHeader}>
            <span style={styles.cardHeader}>ANALYSIS HISTORY ({history.length})</span>
            <button
              onClick={() => {
                setHistory([]);
                saveHistory([]);
              }}
              style={styles.clearBtn}
            >
              CLEAR
            </button>
          </div>
          <div style={styles.historyList}>
            {history.map((h, i) => (
              <div key={i} style={styles.historyItem}>
                <div style={styles.historyMeta}>
                  <span
                    style={{
                      ...styles.historyMode,
                      color: h.mode === "reactive" ? "#00d4ff" : "#7b61ff",
                    }}
                  >
                    {h.mode === "reactive" ? "REACTIVE" : "POLICY"}
                  </span>
                  <span style={styles.historyTime}>
                    {h.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div style={styles.historyText}>{h.text.slice(0, 90)}...</div>
                <div style={styles.historySignal}>
                  {h.mode === "reactive" ? (
                    <span
                      style={{
                        color:
                          h.analysis.signal?.action === "LONG"
                            ? "#00e599"
                            : h.analysis.signal?.action === "SHORT"
                            ? "#ff3366"
                            : "#888",
                      }}
                    >
                      {h.analysis.signal?.action} →{" "}
                      {h.analysis.signal?.instrument}
                    </span>
                  ) : (
                    <span style={{ color: "#7b61ff" }}>
                      {h.analysis.signal?.instrument}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <footer style={styles.footer}>
        This is an educational prototype. Not financial advice. All signals are
        AI-generated analysis for learning purposes only. Never trade with money
        you can't afford to lose.
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'JetBrains Mono', monospace",
    background: "#0a0c10",
    color: "#c8cdd5",
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    padding: "0 0 40px 0",
  },
  scanline: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "200px",
    background:
      "linear-gradient(180deg, transparent 0%, rgba(0,212,255,0.015) 50%, transparent 100%)",
    animation: "scanline 8s linear infinite",
    pointerEvents: "none",
    zIndex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  logo: { display: "flex", alignItems: "center", gap: "8px" },
  logoIcon: { color: "#00d4ff", fontSize: "20px" },
  logoText: {
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "4px",
    color: "#fff",
  },
  tagline: { fontSize: "11px", color: "#556", letterSpacing: "1px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#ffcc00",
    animation: "pulse 2s infinite",
  },
  statusText: {
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#ffcc00",
    fontWeight: 600,
  },
  regimeBar: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    padding: "12px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.01)",
  },
  regimeOverall: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  regimeLabel: {
    fontSize: "9px",
    letterSpacing: "2px",
    color: "#556",
    fontWeight: 600,
  },
  regimeBadge: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#000",
    padding: "3px 10px",
    borderRadius: "2px",
  },
  regimeIndicators: {
    display: "flex",
    gap: "20px",
    flex: 1,
  },
  regimeItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  regimeItemLabel: {
    fontSize: "9px",
    letterSpacing: "1px",
    color: "#445",
    fontWeight: 600,
  },
  regimeItemValue: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.5px",
  },
  regimeItemSub: {
    fontSize: "9px",
    color: "#556",
  },
  alertContainer: {
    padding: "0 28px",
  },
  alertBanner: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    marginTop: "12px",
    background: "rgba(255,204,0,0.04)",
    border: "1px solid",
    borderRadius: "4px",
    animation: "pulse 2s infinite",
  },
  alertLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  alertSeverity: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#000",
    padding: "3px 8px",
    borderRadius: "2px",
  },
  alertAction: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "2px",
  },
  alertInstrument: {
    fontSize: "12px",
    color: "#e0e4ea",
    fontWeight: 500,
  },
  alertConfidence: {
    fontSize: "10px",
    color: "#889",
  },
  alertRight: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  alertHeadline: {
    fontSize: "10px",
    color: "#889",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  alertTime: {
    fontSize: "9px",
    color: "#556",
    flexShrink: 0,
  },
  alertDismiss: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "14px",
    color: "#556",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
    flexShrink: 0,
  },
  modeBar: {
    padding: "20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  modeBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "1.5px",
    padding: "10px 20px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#556",
    cursor: "pointer",
    marginRight: "8px",
    borderRadius: "2px",
    transition: "all 0.2s",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  modeBtnActive: {
    color: "#00d4ff",
    borderColor: "#00d4ff44",
    background: "rgba(0,212,255,0.06)",
  },
  modeBtnActiveAlt: {
    color: "#7b61ff",
    borderColor: "#7b61ff44",
    background: "rgba(123,97,255,0.06)",
  },
  modeDot: (active, alt) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: active ? (alt ? "#7b61ff" : "#00d4ff") : "#333",
    display: "inline-block",
  }),
  modeDescription: {
    fontSize: "11px",
    color: "#445",
    marginTop: "12px",
    lineHeight: 1.5,
  },
  inputSection: {
    padding: "24px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  inputLabel: {
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#556",
    fontWeight: 600,
    display: "block",
    marginBottom: "10px",
  },
  inputRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  textarea: {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "3px",
    color: "#e0e4ea",
    padding: "12px 14px",
    resize: "vertical",
    lineHeight: 1.6,
  },
  analyzeBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    letterSpacing: "1.5px",
    fontWeight: 600,
    padding: "14px 24px",
    background: "linear-gradient(135deg, #00d4ff 0%, #0088aa 100%)",
    color: "#000",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  },
  errorBox: {
    margin: "20px 28px",
    padding: "12px 16px",
    background: "rgba(255,51,102,0.08)",
    border: "1px solid rgba(255,51,102,0.2)",
    borderRadius: "3px",
    color: "#ff3366",
    fontSize: "12px",
  },
  loadingBox: {
    margin: "28px",
    textAlign: "center",
  },
  loadingBar: {
    height: "2px",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "2px",
    overflow: "hidden",
    marginBottom: "14px",
  },
  loadingFill: {
    height: "100%",
    background: "linear-gradient(90deg, #00d4ff, #7b61ff)",
    animation: "fillBar 3s ease-out forwards",
  },
  loadingText: {
    fontSize: "11px",
    color: "#556",
    letterSpacing: "1px",
    animation: "pulse 1.5s infinite",
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    padding: "24px 28px",
  },
  card: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "4px",
    padding: "20px",
  },
  cardHeader: {
    fontSize: "10px",
    letterSpacing: "2.5px",
    color: "#556",
    fontWeight: 600,
    marginBottom: "16px",
    paddingBottom: "10px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  signalContent: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  signalBadge: {
    display: "inline-block",
    padding: "6px 16px",
    borderRadius: "2px",
    fontWeight: 700,
    fontSize: "14px",
    letterSpacing: "2px",
    color: "#000",
    alignSelf: "flex-start",
  },
  signalInstrument: {
    fontSize: "16px",
    color: "#e0e4ea",
    fontWeight: 500,
  },
  signalMeta: {
    display: "flex",
    gap: "20px",
    fontSize: "11px",
    color: "#667",
  },
  severityRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  severityLabel: {
    fontSize: "9px",
    letterSpacing: "1.5px",
    color: "#445",
    fontWeight: 600,
    minWidth: "72px",
  },
  severityBar: {
    display: "flex",
    gap: "3px",
    flex: 1,
  },
  severityBlock: {
    flex: 1,
    height: "14px",
    borderRadius: "1px",
    transition: "background 0.3s",
  },
  severityValue: {
    fontSize: "12px",
    color: "#889",
    fontWeight: 600,
    minWidth: "35px",
    textAlign: "right",
  },
  sentimentTag: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "2px",
  },
  sectorList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectorRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  sectorDot: {
    width: 8,
    height: 8,
    borderRadius: "2px",
    flexShrink: 0,
  },
  sectorName: {
    fontSize: "12px",
    color: "#c8cdd5",
    fontWeight: 500,
    minWidth: "110px",
  },
  sectorImpact: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "1px",
  },
  sectorThesis: {
    fontSize: "10px",
    color: "#556",
    width: "100%",
    paddingLeft: "18px",
    lineHeight: 1.5,
    marginTop: "-4px",
  },
  rationale: {
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#aab",
    margin: 0,
  },
  riskBox: {
    marginTop: "16px",
    padding: "12px 14px",
    background: "rgba(255,51,102,0.04)",
    border: "1px solid rgba(255,51,102,0.1)",
    borderRadius: "3px",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  riskLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#ff3366",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  riskText: {
    fontSize: "11px",
    color: "#889",
    lineHeight: 1.5,
  },
  historySection: {
    padding: "24px 28px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    marginTop: "8px",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  clearBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "1.5px",
    fontWeight: 600,
    padding: "4px 12px",
    background: "transparent",
    border: "1px solid rgba(255,51,102,0.2)",
    color: "#ff3366",
    cursor: "pointer",
    borderRadius: "2px",
    transition: "all 0.2s",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  historyItem: {
    padding: "12px 14px",
    background: "rgba(255,255,255,0.015)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "3px",
  },
  historyMeta: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  historyMode: {
    fontSize: "9px",
    letterSpacing: "2px",
    fontWeight: 700,
  },
  historyTime: {
    fontSize: "10px",
    color: "#445",
  },
  historyText: {
    fontSize: "11px",
    color: "#889",
    lineHeight: 1.5,
  },
  historySignal: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "1px",
  },
  footer: {
    textAlign: "center",
    fontSize: "10px",
    color: "#334",
    padding: "28px",
    lineHeight: 1.6,
    letterSpacing: "0.5px",
  },
  tickerLinks: {
    display: "inline-flex",
    gap: "8px",
    marginLeft: "12px",
    verticalAlign: "middle",
  },
  tickerLink: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "1px",
    color: "#00d4ff",
    textDecoration: "none",
    padding: "2px 6px",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: "2px",
    transition: "all 0.15s",
  },
  tickerList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  tickerRow: {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.015)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "3px",
  },
  tickerRowTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "6px",
  },
  tickerSymbol: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "1.5px",
  },
  tickerName: {
    fontSize: "11px",
    color: "#889",
    flex: 1,
  },
  tickerDirection: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "1.5px",
  },
  tickerNote: {
    fontSize: "10px",
    color: "#667",
    lineHeight: 1.5,
    marginBottom: "8px",
  },
  tickerRowLinks: {
    display: "flex",
    gap: "6px",
  },
  indicatorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  indicatorCard: {
    padding: "12px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "3px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  indicatorLabel: {
    fontSize: "9px",
    letterSpacing: "1.5px",
    color: "#556",
    fontWeight: 600,
  },
  indicatorValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#e0e4ea",
  },
  indicatorTag: {
    fontSize: "9px",
    letterSpacing: "1px",
    color: "#667",
    fontWeight: 600,
  },
  returnsList: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  techList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  techItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  techLabel: {
    fontSize: "9px",
    letterSpacing: "1.5px",
    color: "#556",
    fontWeight: 600,
  },
  techValue: {
    fontSize: "11px",
    color: "#aab",
    lineHeight: 1.6,
  },
  cryptoOverall: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  cryptoNarrative: {
    fontSize: "11px",
    color: "#889",
    lineHeight: 1.6,
  },
  chartSection: {
    padding: "0 28px 24px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  fullChartLink: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "1.5px",
    color: "#00d4ff",
    textDecoration: "none",
    padding: "4px 10px",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: "2px",
    transition: "all 0.15s",
  },
  newsSection: {
    padding: "24px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  newsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  newsControls: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  lastRefresh: {
    fontSize: "9px",
    color: "#445",
    letterSpacing: "1px",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "14px",
  },
  filterBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "1px",
    padding: "5px 12px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#556",
    cursor: "pointer",
    borderRadius: "2px",
    transition: "all 0.2s",
  },
  filterBtnActive: {
    color: "#00d4ff",
    borderColor: "#00d4ff44",
    background: "rgba(0,212,255,0.06)",
  },
  filterDivider: {
    width: "1px",
    height: "18px",
    background: "rgba(255,255,255,0.08)",
    marginLeft: "4px",
    marginRight: "4px",
  },
  filterBtnCrypto: {
    color: "#f7931a",
    borderColor: "#f7931a44",
    background: "rgba(247,147,26,0.06)",
  },
  filterBtnTrump: {
    color: "#ff6b35",
    borderColor: "#ff6b3544",
    background: "rgba(255,107,53,0.06)",
  },
  filterCount: {
    fontSize: "9px",
    color: "#445",
    letterSpacing: "1px",
    marginLeft: "8px",
  },
  refreshBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "1.5px",
    fontWeight: 600,
    padding: "6px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#667",
    cursor: "pointer",
    borderRadius: "2px",
    transition: "all 0.2s",
  },
  newsError: {
    fontSize: "11px",
    color: "#ff3366",
    marginBottom: "10px",
  },
  newsLoadingText: {
    fontSize: "11px",
    color: "#556",
    letterSpacing: "1px",
    animation: "pulse 1.5s infinite",
    textAlign: "center",
    padding: "20px 0",
  },
  newsList: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    maxHeight: "320px",
    overflowY: "auto",
  },
  batchBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    marginBottom: "12px",
    background: "rgba(0,212,255,0.04)",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: "4px",
  },
  batchCount: {
    fontSize: "10px",
    color: "#00d4ff",
    letterSpacing: "1px",
    fontWeight: 600,
  },
  batchBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "1.5px",
    fontWeight: 600,
    padding: "6px 16px",
    background: "linear-gradient(135deg, #00d4ff 0%, #0088aa 100%)",
    color: "#000",
    border: "none",
    borderRadius: "2px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  batchClear: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "1px",
    padding: "4px 10px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#556",
    cursor: "pointer",
    borderRadius: "2px",
  },
  newsItemSelected: {
    borderColor: "rgba(0,212,255,0.3)",
    background: "rgba(0,212,255,0.03)",
  },
  newsItemRow: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  newsCheckbox: {
    width: "16px",
    height: "16px",
    borderRadius: "2px",
    border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    flexShrink: 0,
    marginTop: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  },
  newsCheckboxChecked: {
    background: "rgba(0,212,255,0.15)",
    borderColor: "#00d4ff",
  },
  checkMark: {
    fontSize: "10px",
    color: "#00d4ff",
    lineHeight: 1,
  },
  batchResults: {
    padding: "24px 28px",
  },
  batchResultsHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
  },
  batchMood: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "2px",
  },
  newsItem: {
    fontFamily: "'JetBrains Mono', monospace",
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.015)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "3px",
    transition: "all 0.15s",
    color: "inherit",
  },
  newsClickable: {
    cursor: "pointer",
    flex: 1,
  },
  articleLink: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "1px",
    color: "#00d4ff",
    textDecoration: "none",
    marginTop: "8px",
    alignSelf: "flex-start",
    padding: "2px 6px",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: "2px",
    transition: "all 0.15s",
  },
  newsItemTop: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "6px",
  },
  newsSource: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#00d4ff",
  },
  newsCategory: {
    fontSize: "9px",
    letterSpacing: "1px",
    color: "#556",
    padding: "1px 6px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "2px",
  },
  newsTime: {
    fontSize: "9px",
    color: "#445",
    marginLeft: "auto",
  },
  newsTitle: {
    fontSize: "11px",
    color: "#aab",
    lineHeight: 1.5,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
};
