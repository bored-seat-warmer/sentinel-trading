# SENTINEL — Political Sentiment Trading System

## What This Is
An AI-powered trading dashboard that analyzes political news and policy developments for market impact. Educational/prototype stage — not live trading yet.

## Two Operating Modes
- **Mode 1 (Reactive News):** Real-time headline analysis. Scores sentiment, severity, sector impact, and generates immediate trade signals (LONG/SHORT/HOLD) with specific instruments and timeframes.
- **Mode 2 (Policy Mapping):** Thesis-driven analysis of broader policy trends. Maps policy direction to sector positioning (overweight/underweight) over weeks/months.

## Architecture
- **Frontend:** React (Vite), single-page dashboard
- **Backend:** Vercel serverless function at `/api/analyze` proxying Anthropic API calls
- **AI:** Claude Sonnet via Anthropic Messages API — system prompts return structured JSON for each mode
- **Deploy target:** Vercel

## Key Principles
- API keys must NEVER be in frontend code — all AI calls go through the serverless proxy
- The AI returns structured JSON (no markdown, no backticks) that the frontend parses and renders
- Two different system prompts depending on mode (reactive vs policy) — see the component for exact prompts
- Every analysis gets logged in a client-side history feed

## Tech Stack
- React 18+ with hooks (no class components)
- Vite for dev/build
- Vercel for hosting + serverless functions
- Anthropic SDK or fetch to api.anthropic.com/v1/messages
- No component library — custom styled components

## Environment Variables
- `ANTHROPIC_API_KEY` — required, set in Vercel dashboard and local `.env`

## Future Roadmap (in priority order)
1. Real news feed integration (NewsAPI, Benzinga, or RSS)
2. Persistent analysis history (database instead of in-memory)
3. Scheduled background polling for news
4. Alerts/notifications for high-severity signals
5. Backtesting framework to validate signals against historical price data
6. Paper trading integration with Alpaca API

## Style
- Dark, terminal-inspired aesthetic (JetBrains Mono font)
- Cyan (#00d4ff) for Mode 1 accents, purple (#7b61ff) for Mode 2
- Minimal, information-dense layout
