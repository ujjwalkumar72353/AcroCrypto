import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { loadMarket, stripHtml, toCoin } from "./market.js";

let calls, respond;

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};

globalThis.fetch = async (url) => {
  calls.push(new URL(url));
  return respond(new URL(url));
};

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const unique = () => ({ ids: `coin-${Math.random().toString(36).slice(2)}`, currency: "inr" });

beforeEach(() => {
  calls = [];
  respond = () => json([{ id: "bitcoin" }]);
});

test("repeat requests use the cache", async () => {
  const params = unique();
  await loadMarket("markets", params);
  await loadMarket("markets", params);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("vs_currency"), "inr");
});

test("simultaneous requests share one call", async () => {
  const params = unique();
  await Promise.all(Array.from({ length: 8 }, () => loadMarket("markets", params)));
  assert.equal(calls.length, 1);
});

test("last good data is shown when the API is rate limited", async () => {
  const params = unique();
  await loadMarket("markets", params);
  const realNow = Date.now;
  Date.now = () => realNow() + 60 * 60 * 1000;
  try {
    respond = () => json({}, 429);
    const result = await loadMarket("markets", params);
    assert.equal(result.stale, true);
    assert.equal(result.data[0].id, "bitcoin");
  } finally {
    Date.now = realNow;
  }
});

test("failures without cached data give a friendly message", async () => {
  respond = () => json({}, 429);
  await assert.rejects(loadMarket("markets", unique()), /busy/);
  respond = () => json({}, 404);
  await assert.rejects(loadMarket("coin", { id: "no-such-coin" }), /Coin not found/);
});

test("descriptions become plain text and keep paragraphs", () => {
  const text = stripHtml('Bitcoin is <a onclick="x()">digital</a>.<script>\r\n\r\nSecond.');
  assert.equal(text.includes("<"), false);
  assert.equal(text.includes("onclick"), false);
  assert.equal(text.split("\n\n").length, 2);
});

test("coin details map to the fields the page uses", () => {
  const coin = toCoin({
    id: "bitcoin",
    links: { homepage: ["", "https://bitcoin.org"] },
    market_data: { current_price: { usd: 10 } },
  });
  assert.equal(coin.homepage, "https://bitcoin.org");
  assert.equal(coin.market.price.usd, 10);
});
