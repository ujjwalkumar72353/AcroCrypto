# AcroCrypto

A live crypto market tracker with charts, a watchlist and a personal portfolio. It runs on real market data, with a small Node.js server that caches API calls and keeps the app working through rate limits.

## Features

- **Markets:** top 100 coins with sorting, filtering, gainers and losers, and 7-day sparklines.
- **Global stats:** total market cap, volume, Bitcoin share and the Fear and Greed Index.
- **Coin pages:** interactive price chart from 24 hours to 1 year, key stats, and a converter.
- **Live prices:** streams ticks from Binance on coin pages, for coins with a USDT pair.
- **Accounts:** sign up to keep your watchlist and portfolio on every device. Guest data moves into your account when you sign in.
- **Price alerts:** set a target above or below the current price, and get an in-app notification and email.
- **Watchlist and portfolio:** track coins and profit or loss, with or without an account.
- **INR and USD**, with light and dark themes.

## How it works

The browser talks only to the Node.js server. The server validates each request, calls CoinGecko, and caches the answer for 1 to 30 minutes depending on the data. If CoinGecko is rate limited, it serves the last good data. Any API key stays on the server.

A background worker checks active alerts every 10 minutes using one batched API call, and makes no call when there are no alerts. Each alert fires once, even if two checks overlap.

## Tech stack

React 18, Vite, Tailwind CSS, TradingView Lightweight Charts, Node.js, Express, MongoDB, Mongoose, JWT cookies, Resend, Zod, Helmet, Playwright.

## Run locally

You need Node.js 20 or newer. No API key or MongoDB install is required, because local data is stored in `.data/`.

```bash
npm run setup
npm run dev
```

Open http://localhost:5174.

For steadier limits, create a free Demo key on [CoinGecko](https://www.coingecko.com/en/api/pricing), copy `.env.example` to `.env`, and set `COINGECKO_API_KEY`.

To send alert emails, add `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL`. Without them, alerts appear in the app only.

## Tests

```bash
npm test            # server, cache and failure tests
npm run build       # needed once before the browser test
npm run test:e2e    # full flow in Chrome against a fake market API
```

## Deploy

Set `MONGO` and `JWT_SECRET`. Add the optional keys above if you use them. Alerts only run while the server is awake, so free hosts that sleep can delay them.

```bash
npm install --omit=dev
npm run build
npm start
```

## Data sources

Market data from [CoinGecko](https://www.coingecko.com), live ticks from Binance, and sentiment from [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/). This app is for information only and isn't financial advice.
