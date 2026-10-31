const COINGECKO = "https://api.coingecko.com/api/v3";
const FEAR_GREED = "https://api.alternative.me/fng/?limit=1";
const TIMEOUT_MS = 12000;
const PREFIX = "acro.cache.";

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
  "fear-greed": 30 * MINUTE,
};

const memory = new Map();
const pending = new Map();

const readCache = (key) => {
  if (memory.has(key)) return memory.get(key);
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key));
    if (saved) memory.set(key, saved);
    return saved;
  } catch {
    return null;
  }
};

const dropOldest = () => {
  const keys = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
  keys.slice(0, Math.ceil(keys.length / 2)).forEach((key) => localStorage.removeItem(key));
};

const writeCache = (key, value, ttl) => {
  const entry = { value, expires: Date.now() + ttl };
  memory.set(key, entry);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    try {
      dropOldest();
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {}
  }
};

const getJson = async (url) => {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error("Market data is busy right now. Please try again shortly.");
  }
  if (response.status === 404) throw new Error("Coin not found");
  if (!response.ok) {
    throw new Error("Market data is busy right now. Please try again shortly.");
  }
  return response.json();
};

const coingecko = (path, params = {}) => {
  const url = new URL(`${COINGECKO}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return getJson(url);
};

export const stripHtml = (text = "") =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const toCoin = (coin) => ({
  id: coin.id,
  symbol: coin.symbol,
  name: coin.name,
  image: coin.image?.large,
  rank: coin.market_cap_rank,
  description: stripHtml(coin.description?.en),
  homepage: coin.links?.homepage?.find(Boolean) || null,
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

const FETCHERS = {
  markets: ({ currency, ids }) =>
    coingecko("/coins/markets", {
      vs_currency: currency,
      order: "market_cap_desc",
      per_page: 100,
      page: 1,
      sparkline: "true",
      price_change_percentage: "1h,24h,7d",
      ...(ids ? { ids } : {}),
    }),
  global: async () => (await coingecko("/global")).data,
  trending: async () => {
    const { coins } = await coingecko("/search/trending");
    return coins.slice(0, 7).map(({ item }) => ({
      id: item.id,
      name: item.name,
      symbol: item.symbol,
      thumb: item.small || item.thumb,
      change24h: item.data?.price_change_percentage_24h?.usd ?? null,
    }));
  },
  rates: async () => {
    const { rates } = await coingecko("/exchange_rates");
    return { usd: rates.usd.value, inr: rates.inr.value };
  },
  "fear-greed": async () => {
    const { data } = await getJson(FEAR_GREED);
    return { value: Number(data[0].value), label: data[0].value_classification };
  },
  search: async ({ q }) => {
    const { coins } = await coingecko("/search", { query: q });
    return coins.slice(0, 8).map(({ id, name, symbol, thumb }) => ({ id, name, symbol, thumb }));
  },
  coin: async ({ id }) =>
    toCoin(
      await coingecko(`/coins/${id}`, {
        localization: "false",
        tickers: "false",
        community_data: "false",
        developer_data: "false",
      })
    ),
  chart: async ({ id, currency, days }) => {
    const { prices } = await coingecko(`/coins/${id}/market_chart`, {
      vs_currency: currency,
      days,
    });
    return prices;
  },
};

// Serves fresh cache first, and the last good data if a request fails
export const loadMarket = async (type, params = {}) => {
  const key = `${type}:${JSON.stringify(params)}`;
  const entry = readCache(key);
  if (entry && entry.expires > Date.now()) {
    return { data: entry.value, stale: false };
  }
  if (!pending.has(key)) {
    pending.set(
      key,
      FETCHERS[type](params)
        .then((value) => {
          writeCache(key, value, TTL[type]);
          return { data: value, stale: false };
        })
        .catch((error) => {
          if (entry) return { data: entry.value, stale: true };
          throw error;
        })
        .finally(() => pending.delete(key))
    );
  }
  return pending.get(key);
};
