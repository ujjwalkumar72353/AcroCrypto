const TIMEOUT_MS = 12000;

export class UpstreamError extends Error {
  constructor(status) {
    super(`Upstream responded with ${status}`);
    this.status = status;
  }
}

const coingeckoBase = () =>
  process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";
const fearGreedBase = () =>
  process.env.FEAR_GREED_BASE || "https://api.alternative.me";

const getJson = async (url) => {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new UpstreamError(response.status);
  }
  return response.json();
};

export const coingecko = (path, params = {}) => {
  const url = new URL(`${coingeckoBase()}${path}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );
  if (process.env.COINGECKO_API_KEY) {
    url.searchParams.set("x_cg_demo_api_key", process.env.COINGECKO_API_KEY);
  }
  return getJson(url);
};

export const fearGreed = () => getJson(`${fearGreedBase()}/fng/?limit=1`);
