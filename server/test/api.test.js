import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import request from "supertest";

process.env.API_RATE_LIMIT = "10000";
const { default: createApp } = await import("../app.js");

let mock, calls, failWith, app;

const reply = (url) => {
  if (url.pathname.endsWith("/coins/markets")) return [{ id: "bitcoin", current_price: 1 }];
  if (url.pathname.endsWith("/global")) return { data: { market_cap_percentage: { btc: 50 } } };
  if (url.pathname.endsWith("/exchange_rates")) return { rates: { usd: { value: 2 }, inr: { value: 180 } } };
  if (url.pathname.endsWith("/market_chart")) return { prices: [[1, 2]], market_caps: [] };
  if (url.pathname.endsWith("/search")) return { coins: [{ id: "bitcoin", name: "Bitcoin", symbol: "BTC" }] };
  if (url.pathname.endsWith("/search/trending")) return { coins: [] };
  if (url.pathname.endsWith("/coins/bitcoin")) {
    return {
      id: "bitcoin",
      name: "Bitcoin",
      description: { en: 'Bitcoin is <a href="x" onclick="evil()">digital</a> money.<script>alert(1)</script>\r\n\r\nSecond part.' },
      links: { homepage: ["", "https://bitcoin.org"] },
      market_data: { current_price: { usd: 10 } },
    };
  }
  if (url.pathname.endsWith("/fng/")) return { data: [{ value: "30", value_classification: "Fear" }] };
  return null;
};

before(async () => {
  mock = http.createServer((req, res) => {
    const url = new URL(req.url, "http://mock");
    calls.push(url);
    res.setHeader("Content-Type", "application/json");
    const body = failWith ? null : reply(url);
    res.statusCode = failWith || (body ? 200 : 404);
    res.end(JSON.stringify(body || {}));
  });
  await new Promise((resolve) => mock.listen(0, resolve));
  const base = `http://127.0.0.1:${mock.address().port}`;
  process.env.COINGECKO_BASE = base;
  process.env.FEAR_GREED_BASE = base;
});

after(() => mock.close());

beforeEach(() => {
  calls = [];
  failWith = null;
  delete process.env.COINGECKO_API_KEY;
  app = createApp();
});

test("markets are cached so repeat visits use one upstream call", async () => {
  await request(app).get("/api/markets?currency=inr").expect(200);
  await request(app).get("/api/markets?currency=inr").expect(200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("vs_currency"), "inr");
  await request(app).get("/api/markets?currency=usd").expect(200);
  assert.equal(calls.length, 2);
});

test("many simultaneous requests share one upstream call", async () => {
  await Promise.all(
    Array.from({ length: 10 }, () => request(app).get("/api/global").expect(200))
  );
  assert.equal(calls.length, 1);
});

test("bad input never reaches the upstream API", async () => {
  await request(app).get("/api/markets?currency=doge").expect(400);
  await request(app).get("/api/markets?currency=eur").expect(400);
  await request(app).get("/api/markets?perPage=5000").expect(400);
  await request(app).get("/api/chart/bitcoin?days=9999").expect(400);
  await request(app).get("/api/coin/..%2F..%2Fetc").expect(400);
  await request(app).get("/api/search").expect(400);
  assert.equal(calls.length, 0);
});

test("the API key goes upstream and never reaches the browser", async () => {
  process.env.COINGECKO_API_KEY = "secret-key";
  const res = await request(app).get("/api/global").expect(200);
  assert.equal(calls[0].searchParams.get("x_cg_demo_api_key"), "secret-key");
  assert.equal(JSON.stringify(res.body).includes("secret-key"), false);
});

test("rate limited upstream gives a friendly error without leaking details", async () => {
  failWith = 429;
  const res = await request(app).get("/api/markets").expect(503);
  assert.match(res.body.message, /busy/);
  assert.equal(JSON.stringify(res.body).includes("127.0.0.1"), false);
});

test("last good data is served while the upstream fails", async () => {
  const realNow = Date.now;
  await request(app).get("/api/rates").expect(200);
  Date.now = () => realNow() + 60 * 60 * 1000;
  try {
    failWith = 429;
    const res = await request(app).get("/api/rates").expect(200);
    assert.equal(res.headers["x-data-stale"], "true");
    assert.equal(res.body.inr, 180);
  } finally {
    Date.now = realNow;
  }
});

test("coin descriptions are returned as plain text", async () => {
  const res = await request(app).get("/api/coin/bitcoin").expect(200);
  assert.equal(res.body.homepage, "https://bitcoin.org");
  assert.equal(res.body.description.includes("<"), false);
  assert.equal(res.body.description.includes("onclick"), false);
  assert.equal(res.body.description.split("\n\n").length, 2);
});

test("unknown coins return 404", async () => {
  await request(app).get("/api/coin/not-a-coin").expect(404);
});

test("chart, fear and greed, and search return simple shapes", async () => {
  const chart = await request(app).get("/api/chart/bitcoin?days=30").expect(200);
  assert.deepEqual(chart.body, [[1, 2]]);
  const mood = await request(app).get("/api/fear-greed").expect(200);
  assert.deepEqual(mood.body, { value: 30, label: "Fear" });
  const found = await request(app).get("/api/search?q=bit").expect(200);
  assert.equal(found.body[0].id, "bitcoin");
});

test("security headers allow only known sources", async () => {
  const res = await request(app).get("/api/health").expect(200);
  const policy = res.headers["content-security-policy"];
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /wss:\/\/stream\.binance\.com/);
});

test("unknown API routes return JSON 404", async () => {
  const res = await request(app).get("/api/nope").expect(404);
  assert.equal(res.body.success, false);
});
