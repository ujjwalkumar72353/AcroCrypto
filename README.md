# AcroCrypto

A live crypto market tracker with charts, a watchlist and a portfolio tracker. It's a static frontend that runs on real market data, with no backend or account.

## Features

- **Markets:** top 100 coins with sorting, filtering, gainers and losers, and 7-day sparklines.
- **Global stats:** total market cap, volume, Bitcoin share and the Fear and Greed Index.
- **Coin pages:** interactive price chart from 24 hours to 1 year, key stats, and a converter.
- **Live prices:** streams ticks from Binance on coin pages, for coins with a USDT pair.
- **Watchlist and portfolio:** track coins and profit or loss, saved in your browser.
- **INR and USD**, with light and dark themes.

## How it works

The browser calls public APIs directly. Responses are cached in the browser for 1 to 30 minutes, and if an API is rate limited the app shows the last good data.

## Tech stack

React 18, Vite, Tailwind CSS, TradingView Lightweight Charts, Playwright.

## Run locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5174.

## Tests

```bash
npm test            # cache and data tests
npm run build       # needed once before the browser test
npm run test:e2e    # full flow in Chrome against fake market data
```

## Deploy on Render

Create a **Static Site** with these settings:

- Build command: `npm install --include=dev && npm run build`
- Publish directory: `dist`
- Add a rewrite rule: source `/*`, destination `/index.html`

## Data sources

Market data from [CoinGecko](https://www.coingecko.com), live ticks from Binance, and sentiment from [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/). This app is for information only and isn't financial advice.
