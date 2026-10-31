// End-to-end check of the production build in real Chrome, against a fake market API.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4299;
const BASE = `http://localhost:${PORT}`;
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const RATE = { usd: 1, inr: 84 };

let failing = false;

const coin = (index, currency) => {
  const usd = 1000 - index * 10;
  const change = index % 2 ? -(index + 1) : index + 1;
  return {
    id: `coin-${index}`,
    symbol: `c${index}`,
    name: index === 0 ? "Bitcoin" : `Coin ${index}`,
    image: PIXEL,
    current_price: usd * RATE.usd,
    market_cap: 1e9 - index * 1e6,
    market_cap_rank: index + 1,
    total_volume: 1e7,
    price_change_percentage_1h_in_currency: 0.5,
    price_change_percentage_24h_in_currency: change,
    price_change_percentage_7d_in_currency: change * 2,
    sparkline_in_7d: { price: [1, 2, 3, 2, 4] },
  };
};

const markets = (url) => {
  const vs = url.searchParams.get("vs_currency");
  const ids = url.searchParams.get("ids")?.split(",");
  return Array.from({ length: 40 }, (_, index) => coin(index, vs))
    .map((item) => ({ ...item, current_price: item.current_price * RATE[vs] }))
    .filter((item) => !ids || ids.includes(item.id));
};

const detail = {
  id: "coin-0",
  symbol: "zzz",
  name: "Bitcoin",
  image: { large: PIXEL },
  market_cap_rank: 1,
  description: { en: "Bitcoin is a <b>digital</b> currency.\n\nSecond paragraph." },
  links: { homepage: ["https://bitcoin.org"] },
  categories: [],
  market_data: {
    current_price: { usd: 1000, inr: 84000 },
    market_cap: { usd: 1e9, inr: 84e9 },
    total_volume: { usd: 1e7, inr: 84e7 },
    high_24h: { usd: 1100, inr: 92400 },
    low_24h: { usd: 900, inr: 75600 },
    ath: { usd: 2000, inr: 168000 },
    ath_date: { usd: "2025-01-01T00:00:00Z" },
    price_change_percentage_24h: 1.5,
    price_change_percentage_7d: 3,
    price_change_percentage_1y: 30,
    circulating_supply: 19000000,
    max_supply: 21000000,
  },
};

const route = (url) => {
  const { pathname } = url;
  if (pathname.endsWith("/coins/markets")) return markets(url);
  if (pathname.endsWith("/global")) {
    return {
      data: {
        total_market_cap: { usd: 3e12, inr: 252e12 },
        total_volume: { usd: 1e11, inr: 84e11 },
        market_cap_percentage: { btc: 55.5 },
        market_cap_change_percentage_24h_usd: 1.2,
      },
    };
  }
  if (pathname.endsWith("/fng/")) return { data: [{ value: "30", value_classification: "Fear" }] };
  if (pathname.endsWith("/search/trending")) {
    return { coins: [{ item: { id: "coin-3", name: "Trendy", symbol: "TRD", small: PIXEL, data: { price_change_percentage_24h: { usd: 9 } } } }] };
  }
  if (pathname.endsWith("/exchange_rates")) {
    return { rates: { usd: { value: 1 }, inr: { value: 84 } } };
  }
  if (pathname.endsWith("/search")) {
    return { coins: [{ id: "coin-0", name: "Bitcoin", symbol: "BTC", thumb: PIXEL, market_cap_rank: 1 }] };
  }
  if (pathname.endsWith("/market_chart")) {
    const now = Date.now();
    return { prices: Array.from({ length: 50 }, (_, index) => [now - (50 - index) * 3600000, 900 + index * 4]) };
  }
  if (pathname.endsWith("/coins/coin-0")) return detail;
  return null;
};

const steps = [];
const step = async (name, fn) => {
  await fn();
  steps.push(name);
  console.log(`  ok  ${name}`);
};

const run = async () => {
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => {
    const expected = /status of (40|42|50)[0-9]|WebSocket/.test(entry.text());
    if (entry.type() === "error" && !expected) errors.push(entry.text());
  });
  const fakeApi = async (handle) => {
    const url = new URL(handle.request().url());
    const body = failing ? null : route(url);
    await handle.fulfill({
      status: failing ? 429 : body ? 200 : 404,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body || {}),
    });
  };
  await page.route("https://api.coingecko.com/**", fakeApi);
  await page.route("https://api.alternative.me/**", fakeApi);
  const row = (name) => page.getByRole("row", { name: new RegExp(`^.*${name}\\b`) }).first();

  try {
    await step("markets load with global stats", async () => {
      await page.goto(BASE);
      await page.getByRole("heading", { name: "Crypto markets" }).waitFor();
      await page.getByRole("rowheader", { name: /Bitcoin/ }).waitFor();
      await page.getByText("Fear and Greed").waitFor();
      await page.getByText("55.5%").waitFor();
      await page.getByRole("link", { name: /Trendy/ }).waitFor();
    });

    await step("currency switches prices and persists", async () => {
      await page.getByRole("rowheader", { name: /Bitcoin/ }).waitFor();
      await page.getByText("₹84,000.00").first().waitFor();
      await page.getByLabel("Currency").selectOption("usd");
      await page.getByRole("cell", { name: "$1,000.00" }).waitFor();
      assert.deepEqual(await page.getByLabel("Currency").locator("option").allTextContents(), ["INR", "USD"]);
      await page.reload();
      await page.getByRole("cell", { name: "$1,000.00" }).waitFor();
    });

    await step("filter, sort, tabs and pagination work", async () => {
      await page.getByText("Page 1 of 2").waitFor();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("rowheader", { name: /Coin 30/ }).waitFor();
      await page.getByLabel("Filter coins").fill("coin 12");
      await page.getByRole("rowheader", { name: /Coin 12/ }).waitFor();
      assert.equal(await page.locator("tbody tr").count(), 1);
      await page.getByLabel("Filter coins").fill("zzzz");
      await page.getByText("No coins match this filter.").waitFor();
      await page.getByLabel("Filter coins").fill("");
      await page.getByRole("tab", { name: "Losers" }).click();
      await page.getByRole("button", { name: "24h" }).click();
      const first = await page.locator("tbody tr").first().innerText();
      assert.match(first, /-/);
      await page.getByRole("tab", { name: "All" }).click();
    });

    await step("watchlist stars coins and survives reload", async () => {
      await page.getByRole("button", { name: "Add Bitcoin to watchlist" }).click();
      await page.getByRole("link", { name: "Watchlist" }).click();
      await page.getByRole("rowheader", { name: /Bitcoin/ }).waitFor();
      await page.reload();
      await page.getByRole("rowheader", { name: /Bitcoin/ }).waitFor();
      await page.getByRole("button", { name: "Remove Bitcoin from watchlist" }).click();
      await page.getByText("Your watchlist is empty").waitFor();
    });

    await step("coin page shows chart, stats and clean description", async () => {
      await page.goto(`${BASE}/coin/coin-0`);
      await page.getByRole("heading", { name: "Bitcoin", exact: true }).waitFor();
      await page.locator('[aria-label="Price chart"] canvas').first().waitFor();
      await page.getByRole("button", { name: "1M" }).click();
      await page.locator('[aria-label="Price chart"] canvas').first().waitFor();
      await page.getByText("Rank 1").waitFor();
      await page.getByText("Bitcoin is a digital currency.").waitFor();
      assert.equal(await page.getByText("Second paragraph.").count(), 0);
      await page.getByRole("link", { name: "Official website" }).waitFor();
    });

    await step("converter multiplies the price", async () => {
      await page.getByLabel("zzz amount").fill("2.5");
      await page.waitForFunction(() =>
        document.querySelector('[aria-label="Converted value"]')?.textContent === "$2,500.00"
      );
    });

    await step("header search opens a coin", async () => {
      await page.goto(BASE);
      await page.getByLabel("Search coins").fill("bit");
      await page.getByRole("list").getByRole("button", { name: /Bitcoin/ }).click();
      await page.waitForURL("**/coin/coin-0");
    });

    await step("portfolio tracks profit and survives currency changes", async () => {
      await page.getByRole("link", { name: "Portfolio" }).click();
      await page.getByText("No holdings yet").waitFor();
      await page.getByLabel("Find a coin to add").fill("bit");
      await page.getByRole("list").getByRole("button", { name: /Bitcoin/ }).click();
      await page.getByLabel("Quantity").fill("2");
      await page.getByLabel(/Buy price/).fill("800");
      await page.getByRole("button", { name: "Add holding" }).click();
      await page.getByRole("cell", { name: "$400.00" }).waitFor();
      await page.reload();
      await page.getByRole("cell", { name: "$400.00" }).waitFor();
      await page.getByLabel("Currency").selectOption("inr");
      await page.getByRole("cell", { name: "₹33,600.00" }).waitFor();
      await page.getByRole("button", { name: "Remove Bitcoin" }).click();
      await page.getByText("No holdings yet").waitFor();
      await page.getByLabel("Currency").selectOption("usd");
    });

    await step("no login, alerts or backend remain", async () => {
      await page.goto(BASE);
      await page.getByRole("heading", { name: "Crypto markets" }).waitFor();
      for (const name of ["Sign in", "Alerts"]) {
        assert.equal(await page.getByRole("link", { name, exact: true }).count(), 0);
      }
      assert.ok(await page.locator('meta[http-equiv="Content-Security-Policy"]').count());
    });

    await step("a failed API shows a friendly message, not a crash", async () => {
      failing = true;
      await page.goto(`${BASE}/coin/not-cached-coin`);
      await page.getByRole("heading", { name: /Market data is busy/ }).waitFor();
      await page.getByLabel("Search coins").fill("solana");
      await page.getByRole("status").getByText(/Market data is busy/).waitFor();
      await page.evaluate(() => localStorage.clear());
      await page.goto(BASE);
      await page.getByText("Market data is unavailable").waitFor();
      failing = false;
      await page.getByRole("rowheader", { name: /Bitcoin/ }).waitFor({ timeout: 20000 });
      failing = true;
      await page.evaluate(() => localStorage.clear());
      failing = false;
    });

    await step("unknown pages and coins are handled", async () => {
      await page.goto(`${BASE}/nope`);
      await page.getByRole("heading", { name: "Page not found" }).waitFor();
      await page.goto(`${BASE}/coin/no-such-coin`);
      await page.getByRole("heading", { name: "Coin not found" }).waitFor();
    });

    await step("light theme switches and persists", async () => {
      await page.goto(BASE);
      await page.getByRole("button", { name: "Switch to light mode" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Switch to dark mode" }).waitFor();
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    });

    await step("phone layout has no sideways scroll", async () => {
      await page.setViewportSize({ width: 390, height: 800 });
      for (const url of [BASE, `${BASE}/coin/coin-0`, `${BASE}/portfolio`, `${BASE}/watchlist`, `${BASE}/sign-up`]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle").catch(() => {});
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        assert.ok(overflow <= 0, `${url} overflows by ${overflow}px`);
      }
    });

    assert.deepEqual(errors, [], "browser console must stay clean");
    console.log(`\n${steps.length} steps passed, no browser errors`);
  } catch (error) {
    console.log("URL", page.url(), (await page.locator("body").innerText()).slice(0, 700).replace(/\n/g, " | "));
    console.log("ERRORS", errors.slice(0, 5));
    throw error;
  } finally {
    await browser.close();
    process.kill(-server.pid);
  }
};

run().catch((error) => {
  console.error(`\nFAILED after: ${steps.at(-1) || "start"}\n`, error.message.slice(0, 500));
  process.exit(1);
});
