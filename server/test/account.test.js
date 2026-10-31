import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

process.env.JWT_SECRET = "test-secret";
process.env.API_RATE_LIMIT = "100000";
process.env.AUTH_RATE_LIMIT = "100000";

const { default: createApp } = await import("../app.js");
const { checkAlerts } = await import("../alerts.js");
const { default: User } = await import("../models/user.js");
const { default: Alert } = await import("../models/alert.js");

let mongo, app, upstream, emailServer, price, priceCalls, emails, emailStatus, first, second;

const session = async (name) => {
  const agent = request.agent(app);
  const email = `${name}@test.com`;
  const res = await agent
    .post("/api/auth/signup")
    .send({ name, email, password: "password123" })
    .expect(201);
  return { agent, id: res.body._id, email };
};

const holding = {
  coinId: "bitcoin",
  name: "Bitcoin",
  symbol: "btc",
  quantity: 2,
  buyPrice: 100,
  currency: "usd",
};
const alert = {
  coinId: "bitcoin",
  name: "Bitcoin",
  symbol: "btc",
  currency: "inr",
  direction: "below",
  target: 7000000,
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  upstream = http.createServer((req, res) => {
    priceCalls += 1;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ bitcoin: { usd: 80000, inr: price } }));
  });
  emailServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      emails.push({ auth: req.headers.authorization, body: JSON.parse(raw) });
      res.statusCode = emailStatus;
      res.end("{}");
    });
  });
  await Promise.all([
    new Promise((resolve) => upstream.listen(0, resolve)),
    new Promise((resolve) => emailServer.listen(0, resolve)),
  ]);
  process.env.COINGECKO_BASE = `http://127.0.0.1:${upstream.address().port}`;
  process.env.RESEND_BASE = `http://127.0.0.1:${emailServer.address().port}`;
});

after(async () => {
  upstream.close();
  emailServer.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();
  app = createApp();
  price = 7500000;
  priceCalls = 0;
  emails = [];
  emailStatus = 200;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  first = await session("first");
  second = await session("second");
});

test("auth: validation, wrong password, duplicates and sign out", async () => {
  await request(app)
    .post("/api/auth/signup")
    .send({ name: "A", email: "bad", password: "x" })
    .expect(400);
  await request(app)
    .post("/api/auth/signin")
    .send({ email: first.email, password: "wrong" })
    .expect(401);
  await request(app)
    .post("/api/auth/signin")
    .send({ email: { $gt: "" }, password: { $gt: "" } })
    .expect(400);
  await request(app)
    .post("/api/auth/signup")
    .send({ name: "Other", email: "FIRST@test.com", password: "password123" })
    .expect(409);
  const session1 = await first.agent.get("/api/auth/session").expect(200);
  assert.equal(session1.body.email, first.email);
  assert.equal(JSON.stringify(session1.body).includes("password"), false);
  await first.agent.post("/api/auth/signout").expect(200);
  const guest = await first.agent.get("/api/auth/session").expect(200);
  assert.equal(guest.body, null);
});

test("auth: cookie is httpOnly with sameSite", async () => {
  const res = await request(app)
    .post("/api/auth/signin")
    .send({ email: first.email, password: "password123" })
    .expect(200);
  assert.match(res.headers["set-cookie"][0], /HttpOnly/);
  assert.match(res.headers["set-cookie"][0], /SameSite=Lax/);
});

test("private data is never cached by browsers", async () => {
  const res = await first.agent.get("/api/alerts").expect(200);
  assert.equal(res.headers["cache-control"], "no-store");
});

test("private routes need a session", async () => {
  await request(app).get("/api/holdings").expect(401);
  await request(app).get("/api/alerts").expect(401);
  await request(app).post("/api/watchlist/bitcoin").expect(401);
  await request(app).get("/api/notifications").expect(401);
});

test("watchlist toggles and rejects bad ids", async () => {
  const on = await first.agent.post("/api/watchlist/bitcoin").expect(200);
  assert.deepEqual(on.body.watchlist, ["bitcoin"]);
  const off = await first.agent.post("/api/watchlist/bitcoin").expect(200);
  assert.deepEqual(off.body.watchlist, []);
  await first.agent.post("/api/watchlist/BAD!").expect(400);
});

test("holdings stay private to each user", async () => {
  const created = await first.agent.post("/api/holdings").send(holding).expect(201);
  const others = await second.agent.get("/api/holdings").expect(200);
  assert.equal(others.body.length, 0);
  await second.agent.delete(`/api/holdings/${created.body._id}`).expect(404);
  await first.agent.delete(`/api/holdings/${created.body._id}`).expect(200);
  await first.agent
    .post("/api/holdings")
    .send({ ...holding, quantity: -1 })
    .expect(400);
});

test("sync moves guest data without duplicating the watchlist", async () => {
  await first.agent.post("/api/watchlist/bitcoin").expect(200);
  const res = await first.agent
    .post("/api/account/sync")
    .send({ watchlist: ["bitcoin", "ethereum"], holdings: [holding] })
    .expect(200);
  assert.deepEqual(res.body.watchlist, ["bitcoin", "ethereum"]);
  const list = await first.agent.get("/api/holdings").expect(200);
  assert.equal(list.body.length, 1);
});

test("alerts stay private and are limited", async () => {
  const created = await first.agent.post("/api/alerts").send(alert).expect(201);
  await second.agent.delete(`/api/alerts/${created.body._id}`).expect(404);
  await first.agent.post("/api/alerts").send({ ...alert, target: -5 }).expect(400);
  for (let index = 1; index < 20; index += 1) {
    await first.agent.post("/api/alerts").send(alert).expect(201);
  }
  await first.agent.post("/api/alerts").send(alert).expect(400);
});

test("worker makes no API call when there are no alerts", async () => {
  assert.equal(await checkAlerts(), 0);
  assert.equal(priceCalls, 0);
});

test("worker triggers once, notifies, and ignores untouched targets", async () => {
  await first.agent.post("/api/alerts").send(alert).expect(201);
  await first.agent
    .post("/api/alerts")
    .send({ ...alert, direction: "above", target: 9000000 })
    .expect(201);
  assert.equal(await checkAlerts(), 0);

  price = 6900000;
  assert.equal(await checkAlerts(), 1);
  assert.equal(priceCalls, 2);
  const alerts = await first.agent.get("/api/alerts").expect(200);
  const fired = alerts.body.find((item) => item.direction === "below");
  assert.equal(fired.active, false);
  assert.equal(fired.triggeredPrice, 6900000);
  assert.equal(alerts.body.find((item) => item.direction === "above").active, true);

  const notes = await first.agent.get("/api/notifications").expect(200);
  assert.equal(notes.body.length, 1);
  assert.match(notes.body[0].title, /Bitcoin price alert/);
  assert.equal(notes.body[0].link, "/coin/bitcoin");
  const others = await second.agent.get("/api/notifications").expect(200);
  assert.equal(others.body.length, 0);

  await checkAlerts();
  const again = await first.agent.get("/api/notifications").expect(200);
  assert.equal(again.body.length, 1);
  await first.agent.post("/api/notifications/read").expect(200);
  const read = await first.agent.get("/api/notifications").expect(200);
  assert.ok(read.body.every((item) => item.read));
});

test("two overlapping checks still notify only once", async () => {
  await first.agent.post("/api/alerts").send(alert).expect(201);
  price = 6900000;
  await Promise.all([checkAlerts(), checkAlerts()]);
  const notes = await first.agent.get("/api/notifications").expect(200);
  assert.equal(notes.body.length, 1);
});

test("worker emails the owner when email is configured", async () => {
  process.env.RESEND_API_KEY = "email-key";
  process.env.EMAIL_FROM = "AcroCrypto <alerts@test.com>";
  process.env.APP_URL = "https://acro.test";
  await first.agent.post("/api/alerts").send(alert).expect(201);
  price = 6900000;
  await checkAlerts();
  assert.equal(emails.length, 1);
  assert.equal(emails[0].auth, "Bearer email-key");
  assert.equal(emails[0].body.to, first.email);
  assert.match(emails[0].body.text, /https:\/\/acro\.test\/coin\/bitcoin/);
});

test("a failed email keeps the in-app alert and doesn't crash", async () => {
  process.env.RESEND_API_KEY = "email-key";
  process.env.EMAIL_FROM = "AcroCrypto <alerts@test.com>";
  emailStatus = 500;
  await first.agent.post("/api/alerts").send(alert).expect(201);
  price = 6900000;
  assert.equal(await checkAlerts(), 1);
  const notes = await first.agent.get("/api/notifications").expect(200);
  assert.equal(notes.body.length, 1);
  assert.equal(await Alert.countDocuments({ active: true }), 0);
});
