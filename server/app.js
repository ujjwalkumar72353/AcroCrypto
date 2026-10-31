import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { createCache } from "./cache.js";
import accountRouter from "./routes/account.js";
import { coingecko, fearGreed } from "./upstream.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const TTL = {
  markets: MINUTE,
  global: 2 * MINUTE,
  trending: 10 * MINUTE,
  coin: MINUTE,
  chart: 5 * MINUTE,
  search: 10 * MINUTE,
  rates: 5 * MINUTE,
  fearGreed: 30 * MINUTE,
};

const currency = z.enum(["usd", "inr"]).default("usd");
const coinId = z.string().regex(/^[a-z0-9-]{1,80}$/);

const marketsSchema = z.object({
  currency,
  page: z.coerce.number().int().min(1).max(50).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(100),
  ids: z.string().regex(/^[a-z0-9-]{1,80}(,[a-z0-9-]{1,80}){0,49}$/).optional(),
});
const chartSchema = z.object({
  currency,
  days: z.enum(["1", "7", "30", "90", "365"]).default("7"),
});
const searchSchema = z.object({ q: z.string().trim().min(1).max(50) });

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("Invalid request");
    error.statusCode = 400;
    throw error;
  }
  return result.data;
};

const stripHtml = (text = "") =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const toCoin = (coin) => ({
  id: coin.id,
  symbol: coin.symbol,
  name: coin.name,
  image: coin.image?.large,
  rank: coin.market_cap_rank,
  description: stripHtml(coin.description?.en),
  homepage: coin.links?.homepage?.find(Boolean) || null,
  categories: (coin.categories || []).filter(Boolean).slice(0, 4),
  market: {
    price: coin.market_data?.current_price,
    marketCap: coin.market_data?.market_cap,
    volume: coin.market_data?.total_volume,
    high24h: coin.market_data?.high_24h,
    low24h: coin.market_data?.low_24h,
    ath: coin.market_data?.ath,
    athDate: coin.market_data?.ath_date?.usd,
    change24h: coin.market_data?.price_change_percentage_24h,
    change7d: coin.market_data?.price_change_percentage_7d,
    change1y: coin.market_data?.price_change_percentage_1y,
    circulatingSupply: coin.market_data?.circulating_supply,
    maxSupply: coin.market_data?.max_supply,
  },
});

const createApp = () => {
  const app = express();
  const cache = createCache();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://assets.coingecko.com", "https://coin-images.coingecko.com"],
          connectSrc: ["'self'", "wss://stream.binance.com:9443"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );

  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  app.use(
    "/api",
    rateLimit({
      windowMs: MINUTE,
      limit: Number(process.env.API_RATE_LIMIT) || 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { success: false, message: "Too many requests, slow down a little" },
    })
  );

  const route = (url, handler) =>
    app.get(url, (req, res, next) => {
      Promise.resolve(handler(req))
        .then(({ value, stale }) => {
          if (stale) res.set("X-Data-Stale", "true");
          res.json(value);
        })
        .catch(next);
    });

  app.get("/api/health", (req, res) => res.json({ success: true }));

  route("/api/markets", (req) => {
    const { currency: vs, page, perPage, ids } = parse(marketsSchema, req.query);
    return cache.load(`markets:${vs}:${page}:${perPage}:${ids || ""}`, TTL.markets, () =>
      coingecko("/coins/markets", {
        vs_currency: vs,
        order: "market_cap_desc",
        per_page: perPage,
        page,
        sparkline: "true",
        price_change_percentage: "1h,24h,7d",
        ...(ids ? { ids } : {}),
      })
    );
  });

  route("/api/global", () =>
    cache.load("global", TTL.global, async () => (await coingecko("/global")).data)
  );

  route("/api/trending", () =>
    cache.load("trending", TTL.trending, async () => {
      const { coins } = await coingecko("/search/trending");
      return coins.slice(0, 7).map(({ item }) => ({
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        thumb: item.small || item.thumb,
        rank: item.market_cap_rank,
        change24h: item.data?.price_change_percentage_24h?.usd ?? null,
      }));
    })
  );

  route("/api/rates", () =>
    cache.load("rates", TTL.rates, async () => {
      const { rates } = await coingecko("/exchange_rates");
      return { usd: rates.usd.value, inr: rates.inr.value };
    })
  );

  route("/api/fear-greed", () =>
    cache.load("fearGreed", TTL.fearGreed, async () => {
      const { data } = await fearGreed();
      return {
        value: Number(data[0].value),
        label: data[0].value_classification,
      };
    })
  );

  route("/api/search", (req) => {
    const { q } = parse(searchSchema, req.query);
    const key = q.toLowerCase();
    return cache.load(`search:${key}`, TTL.search, async () => {
      const { coins } = await coingecko("/search", { query: q });
      return coins.slice(0, 8).map((coin) => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        thumb: coin.thumb,
        rank: coin.market_cap_rank,
      }));
    });
  });

  route("/api/coin/:id", (req) => {
    const id = parse(coinId, req.params.id);
    return cache.load(`coin:${id}`, TTL.coin, async () =>
      toCoin(
        await coingecko(`/coins/${id}`, {
          localization: "false",
          tickers: "false",
          community_data: "false",
          developer_data: "false",
        })
      )
    );
  });

  route("/api/chart/:id", (req) => {
    const id = parse(coinId, req.params.id);
    const { currency: vs, days } = parse(chartSchema, req.query);
    return cache.load(`chart:${id}:${vs}:${days}`, TTL.chart, async () => {
      const { prices } = await coingecko(`/coins/${id}/market_chart`, {
        vs_currency: vs,
        days,
      });
      return prices;
    });
  });

  app.use("/api", accountRouter);

  app.use("/api", (req, res) =>
    res.status(404).json({ success: false, message: "Route not found" })
  );

  if (process.env.NODE_ENV === "production") {
    const build = path.join(here, "..", "client", "dist");
    app.use(express.static(build));
    app.get("*", (req, res) => res.sendFile(path.join(build, "index.html")));
  }

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "This value is already in use" });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: "Coin not found" });
    }
    console.error(error.message);
    res.status(503).json({
      success: false,
      message: "Market data is busy right now. Please try again shortly.",
    });
  });

  return app;
};

export default createApp;
