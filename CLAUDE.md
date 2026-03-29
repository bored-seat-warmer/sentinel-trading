# Atlas Alpha — Political Sentiment Trading System

## What This Is
An AI-powered trading dashboard that analyzes political news and policy developments for market impact across traditional markets and crypto. Educational/prototype stage — not live trading yet.

## Three Analysis Modes
- **Mode 1 (Reactive News):** Real-time headline analysis. Scores sentiment, severity, sector + crypto impact, and generates immediate trade signals (LONG/SHORT/HOLD) with specific instruments and timeframes.
- **Mode 2 (Policy Mapping):** Thesis-driven analysis of broader policy trends. Maps policy direction to sector positioning (overweight/underweight) over weeks/months.
- **Batch Analysis:** Select multiple headlines for a synthesized market briefing with dominant narrative, cross-headline themes, contrarian view, and net sector/crypto impact.

## Architecture
- **Frontend:** React (Vite), single-page dashboard
- **Backend:** Vercel serverless functions:
  - `/api/analyze` — proxies Anthropic API calls with server-side API key; injects live technicals + market regime data into prompts
  - `/api/news` — fetches and merges RSS feeds from CNBC, Politico, CoinDesk, CoinTelegraph, Decrypt
  - `/api/prices` — real-time quotes from Yahoo Finance (stocks + crypto)
  - `/api/technicals` — computes RSI(14), MACD(12,26,9), Bollinger Bands(20), volume ratio, returns, 6M range from OHLCV data
  - `/api/regime` — market regime indicators: VIX, yield curve, breadth, credit stress, SPY trend
  - `/api/article` — extracts full article text from URLs for deep analysis
- **AI:** Claude Sonnet 4 via Anthropic Messages API — system prompts return structured JSON with consistency rules. Receives real computed indicators + market regime data so technical context uses actual values, not training data.
- **Charts:** TradingView mini symbol overview widget, auto-loaded for the primary instrument
- **History:** localStorage (up to 50 entries), abstracted behind `loadHistory`/`saveHistory` for easy swap to Vercel KV
- **Deploy target:** Vercel via GitHub (repo: `atlas-alpha`)

## Key Principles
- API keys must NEVER be in frontend code — all AI calls go through the serverless proxy
- The AI returns structured JSON (no markdown, no backticks) that the frontend parses and renders; `parseAIResponse` handles extraction fallback for non-JSON responses
- AI prompts enforce signal/sentiment/sector consistency (e.g., bearish + negative sector = SHORT, not LONG)
- Technical context must match the signal instrument — no analyzing a different ticker
- Live market data (prices, indicators, regime) is injected into every prompt so Claude uses real values, not stale training data
- The UI must visibly reflect everything sent to the backend — no hidden inputs (see memory: feedback_transparency)
- Every analysis gets logged in persistent client-side history

## Live News Feed
- Pulls from 8 RSS feeds: CNBC (Politics, Economy), Politico (Politics, Congress, Economy), CoinDesk, CoinTelegraph, Decrypt
- Category filter toggles (Politics / Economy / Congress / Crypto)
- Trump Tracker filter (orange, content-based title match)
- Auto-refreshes every 5 minutes with last-updated timestamp
- Clicking a headline runs quick analysis (title + RSS description)
- "DEEP ANALYZE" button fetches full article content via `/api/article` for paragraph-level context
- "READ ARTICLE" link opens source in new tab
- Checkboxes for multi-select batch analysis
- 5-minute server-side cache via `Cache-Control` header

## Market Regime Bar
Persistent bar below the header showing real-time market conditions:
- **VIX** — fear gauge with level classification + trend
- **SPY Trend** — price vs 20d/50d SMAs
- **Breadth** — SPY vs RSP (equal-weight) spread
- **Credit** — HYG 1-month change (risk appetite)
- **Yield Curve** — TLT/SHY ratio trend
- **Overall** — RISK-ON / RISK-OFF / NEUTRAL composite

## Analysis Results Include
- Signal card (action, instrument with live price + TV/Yahoo/Finviz links, confidence, timeframe, severity bar, sentiment)
- Sector impact breakdown with color-coded impact/magnitude
- Crypto impact card (overall sentiment, per-asset breakdown for BTC/ETH/SOL/XRP/etc. with live prices)
- Related tickers with live prices, direction, reasoning, and deep-links
- Technical context: real computed RSI, MACD (with crossover detection), Bollinger Bands, volume ratio, period returns, 6M range — plus AI entry trigger
- TradingView embedded chart for the primary instrument
- Trade rationale / macro view with key risk callout
- High-severity alert banners (severity >= 8 or confidence >= 80%) with audio ping

## Batch Analysis Results
- Market mood (risk-on / risk-off / mixed / rotating)
- Dominant narrative + themes grouped across headlines
- Net sector impact + crypto impact
- Overall signal with tickers
- Market briefing (3-5 sentence outlook)
- Contrarian view + key risks

## Tech Stack
- React 18+ with hooks (no class components)
- Vite 6 for dev/build
- Vercel for hosting + serverless functions
- Anthropic Messages API (Claude Sonnet 4)
- Yahoo Finance API (quotes + OHLCV data for indicator computation)
- `rss-parser` for RSS feed ingestion
- TradingView embeddable widgets
- localStorage for history persistence
- No component library — custom inline styles

## Environment Variables
- `ANTHROPIC_API_KEY` — required, set in Vercel dashboard and local `.env`

## Future Roadmap (in priority order)
1. ~~Real news feed integration~~ — DONE (RSS from CNBC + Politico + crypto sources)
2. ~~Persistent analysis history~~ — DONE (localStorage, swap-ready for Vercel KV)
3. ~~Alerts/notifications for high-severity signals~~ — DONE (banners + audio)
4. ~~Real technical indicators~~ — DONE (RSI, MACD, Bollinger, volume, returns from OHLCV)
5. ~~Market regime context~~ — DONE (VIX, yield curve, breadth, credit, SPY trend)
6. ~~Crypto integration~~ — DONE (feeds, analysis, prices)
7. ~~Full article analysis~~ — DONE (server-side content extraction)
8. ~~Batch analysis~~ — DONE (multi-headline synthesized outlook)
9. Headline deduplication across feeds
10. Upgrade history to Vercel KV for cross-device persistence
11. Backtesting framework to validate signals against historical price data
12. Paper trading integration with Alpaca API

## Style
- Dark, terminal-inspired aesthetic (JetBrains Mono font)
- Cyan (#00d4ff) for Mode 1 accents, purple (#7b61ff) for Mode 2, orange (#f7931a) for crypto
- Minimal, information-dense layout
