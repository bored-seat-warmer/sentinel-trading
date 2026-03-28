import { useState, useCallback } from "react";

const SAMPLE_HEADLINES = {
  reactive: [
    "President announces 25% tariff on all semiconductor imports effective immediately",
    "Federal Reserve signals emergency rate cut amid banking sector concerns",
    "Major cybersecurity breach reported at three largest US banks",
    "White House reaches surprise trade deal with China, removing all tariffs on tech goods",
    "Oil prices surge 15% as new Middle East sanctions announced",
    "Congress passes sweeping AI regulation bill restricting autonomous trading systems",
  ],
  policy: [
    "Administration outlines 5-year plan for domestic chip manufacturing subsidies. Congress signals bipartisan support for $50B CHIPS Act expansion. Intel and TSMC announce new US fab locations.",
    "Treasury Secretary advocates for stronger dollar policy in speech to G7 finance ministers. Fed minutes reveal internal debate over inflation targets. IMF warns of global currency volatility.",
    "EPA proposes strictest-ever emissions standards for 2027. Auto industry lobbies for extended timeline. EV tax credits expanded to include commercial vehicles.",
    "Bipartisan infrastructure bill advances with $200B for rural broadband. Major telecom companies lobby for reduced regulation. FCC announces new spectrum auction.",
  ],
};

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
};

const getSectorColor = (sector) => SECTOR_COLORS[sector] || "#888";

export default function SentimentTradingDashboard() {
  const [mode, setMode] = useState("reactive");
  const [headline, setHeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

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

        const parsed = JSON.parse(raw);
        setAnalysis(parsed);
        setHistory((prev) => [
          { text, mode, analysis: parsed, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
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

  const loadSample = (sample) => {
    setHeadline(sample);
    analyzeHeadline(sample);
  };

  return (
    <div style={styles.container}>
      <div style={styles.scanline} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>&#9670;</span>
            <span style={styles.logoText}>SENTINEL</span>
          </div>
          <span style={styles.tagline}>Political Sentiment Trading System</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statusDot} />
          <span style={styles.statusText}>PROTOTYPE</span>
        </div>
      </header>

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
        <div style={styles.sampleSection}>
          <span style={styles.sampleLabel}>Try a sample:</span>
          <div style={styles.sampleList}>
            {SAMPLE_HEADLINES[mode].map((s, i) => (
              <button key={i} onClick={() => loadSample(s)} style={styles.sampleBtn}>
                {s.slice(0, 65)}...
              </button>
            ))}
          </div>
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
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={styles.historySection}>
          <div style={styles.cardHeader}>ANALYSIS HISTORY</div>
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
  sampleSection: {
    marginTop: "14px",
  },
  sampleLabel: {
    fontSize: "10px",
    color: "#445",
    letterSpacing: "1px",
  },
  sampleList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "8px",
  },
  sampleBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    padding: "5px 10px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "#667",
    cursor: "pointer",
    borderRadius: "2px",
    transition: "all 0.15s",
    maxWidth: "280px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
};
