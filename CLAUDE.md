# Atlas Alpha — Political Sentiment Trading System

## What This Is
An AI-powered trading dashboard that analyzes political news and policy developments for market impact. Educational/prototype stage — not live trading yet.

## Two Operating Modes
- **Mode 1 (Reactive News):** Real-time headline analysis. Scores sentiment, severity, sector impact, and generates immediate trade signals (LONG/SHORT/HOLD) with specific instruments and timeframes. Includes technical context (key levels, indicators, entry triggers) and related tickers with deep-links.
- **Mode 2 (Policy Mapping):** Thesis-driven analysis of broader policy trends. Maps policy direction to sector positioning (overweight/underweight) over weeks/months with technical context and related tickers.

## Architecture
- **Frontend:** React (Vite), single-page dashboard
- **Backend:** Vercel serverless functions:
  - `/api/analyze` — proxies Anthropic API calls with server-side API key
  - `/api/news` — fetches and merges RSS feeds from CNBC and Politico
- **AI:** Claude Sonnet 4 via Anthropic Messages API — system prompts return structured JSON for each mode, with consistency rules to prevent contradictory signals
- **Charts:** TradingView mini symbol overview widget, auto-loaded for the primary instrument
- **History:** localStorage (up to 50 entries), abstracted behind `loadHistory`/`saveHistory` for easy swap to Vercel KV
- **Deploy target:** Vercel via GitHub (repo: `atlas-alpha`)

## Key Principles
- API keys must NEVER be in frontend code — all AI calls go through the serverless proxy
- The AI returns structured JSON (no markdown, no backticks) that the frontend parses and renders
- AI prompts enforce signal/sentiment/sector consistency (e.g., bearish + negative sector = SHORT, not LONG)
- Two different system prompts depending on mode (reactive vs policy) — see `api/analyze.js` for exact prompts
- Every analysis gets logged in persistent client-side history

## Live News Feed
- Pulls from 5 RSS feeds: CNBC (Politics, Economy), Politico (Politics, Congress, Economy)
- Category filter toggles (Politics / Economy / Congress)
- Auto-refreshes every 5 minutes with last-updated timestamp
- Clicking any headline auto-runs it through the analyzer
- 5-minute server-side cache via `Cache-Control` header
- Uses `rss-parser` npm package in the serverless function

## Analysis Results Include
- Signal card (action, instrument with TV/Yahoo/Finviz links, confidence, timeframe, severity bar, sentiment)
- Sector impact breakdown with color-coded impact/magnitude
- Related tickers with per-ticker direction, reasoning, and deep-links
- Technical context: key support/resistance levels, indicators to watch, entry triggers
- TradingView embedded chart for the primary instrument
- Trade rationale / macro view with key risk callout

## Tech Stack
- React 18+ with hooks (no class components)
- Vite 6 for dev/build
- Vercel for hosting + serverless functions
- Anthropic Messages API (Claude Sonnet 4)
- `rss-parser` for RSS feed ingestion
- TradingView embeddable widgets
- localStorage for history persistence
- No component library — custom inline styles

## Environment Variables
- `ANTHROPIC_API_KEY` — required, set in Vercel dashboard and local `.env`

## Future Roadmap (in priority order)
1. ~~Real news feed integration~~ — DONE (RSS from CNBC + Politico)
2. ~~Persistent analysis history~~ — DONE (localStorage, swap-ready for Vercel KV)
3. Upgrade history to Vercel KV for cross-device persistence
4. Scheduled background polling for news
5. Alerts/notifications for high-severity signals
6. Backtesting framework to validate signals against historical price data
7. Paper trading integration with Alpaca API

## Style
- Dark, terminal-inspired aesthetic (JetBrains Mono font)
- Cyan (#00d4ff) for Mode 1 accents, purple (#7b61ff) for Mode 2
- Minimal, information-dense layout
