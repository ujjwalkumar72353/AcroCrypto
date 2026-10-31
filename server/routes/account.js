import express from "express";
import bcryptjs from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { endSession, readUserId, requireUser, startSession } from "../auth.js";
import { handle, HttpError, parseBody } from "../http.js";
import Alert from "../models/alert.js";
import Holding from "../models/holding.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";

const router = express.Router();

// Account data is private and changes often, so browsers must never reuse it
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const MAX_HOLDINGS = 200;
const MAX_ALERTS = 20;
const MAX_WATCHLIST = 50;

const email = z.string().trim().toLowerCase().email();
const coinId = z.string().regex(/^[a-z0-9-]{1,80}$/);
const currency = z.enum(["usd", "inr"]);
const coinFields = {
  coinId,
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().min(1).max(20),
};
const amount = z.number().positive().max(1e15);
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email,
  password: z.string().min(8, "must be at least 8 characters").max(72),
});
const signinSchema = z.object({ email, password: z.string().min(1) });
const holdingSchema = z.object({
  ...coinFields,
  thumb: z.string().max(500).default(""),
  quantity: amount,
  buyPrice: amount,
  currency,
});
const alertSchema = z.object({
  ...coinFields,
  currency,
  direction: z.enum(["above", "below"]),
  target: amount,
});
const syncSchema = z.object({
  watchlist: z.array(coinId).max(MAX_WATCHLIST).default([]),
  holdings: z.array(holdingSchema).max(MAX_HOLDINGS).default([]),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later" },
});

const profile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  watchlist: user.watchlist,
});

router.post(
  "/auth/signup",
  authLimiter,
  handle(async (req, res) => {
    const values = parseBody(signupSchema, req.body);
    if (await User.exists({ email: values.email })) {
      throw new HttpError(409, "This email is already registered");
    }
    const user = await User.create({
      ...values,
      password: await bcryptjs.hash(values.password, 10),
    });
    startSession(res, user._id);
    res.status(201).json(profile(user));
  })
);

router.post(
  "/auth/signin",
  authLimiter,
  handle(async (req, res) => {
    const values = parseBody(signinSchema, req.body);
    const user = await User.findOne({ email: values.email }).select("+password");
    if (!user || !(await bcryptjs.compare(values.password, user.password))) {
      throw new HttpError(401, "Invalid email or password");
    }
    startSession(res, user._id);
    res.json(profile(user));
  })
);

router.post("/auth/signout", (req, res) => {
  endSession(res);
  res.json({ success: true });
});

router.get(
  "/auth/session",
  handle(async (req, res) => {
    const id = readUserId(req);
    const user = id && (await User.findById(id));
    res.json(user ? profile(user) : null);
  })
);

// Moves a guest's browser data into their account after signing in
router.post(
  "/account/sync",
  requireUser,
  handle(async (req, res) => {
    const { watchlist, holdings } = parseBody(syncSchema, req.body);
    const user = await User.findById(req.userId);
    user.watchlist = [...new Set([...user.watchlist, ...watchlist])].slice(0, MAX_WATCHLIST);
    await user.save();
    const existing = await Holding.countDocuments({ user: req.userId });
    const room = Math.max(0, MAX_HOLDINGS - existing);
    await Holding.insertMany(
      holdings.slice(0, room).map((holding) => ({ ...holding, user: req.userId }))
    );
    res.json({ watchlist: user.watchlist });
  })
);

router.post(
  "/watchlist/:coinId",
  requireUser,
  handle(async (req, res) => {
    const id = parseBody(coinId, req.params.coinId);
    const user = await User.findById(req.userId);
    const saved = user.watchlist.includes(id);
    if (!saved && user.watchlist.length >= MAX_WATCHLIST) {
      throw new HttpError(400, `You can watch up to ${MAX_WATCHLIST} coins`);
    }
    user.watchlist = saved
      ? user.watchlist.filter((item) => item !== id)
      : [...user.watchlist, id];
    await user.save();
    res.json({ watchlist: user.watchlist });
  })
);

router.get(
  "/holdings",
  requireUser,
  handle(async (req, res) => {
    res.json(await Holding.find({ user: req.userId }).sort({ createdAt: 1 }));
  })
);

router.post(
  "/holdings",
  requireUser,
  handle(async (req, res) => {
    const values = parseBody(holdingSchema, req.body);
    if ((await Holding.countDocuments({ user: req.userId })) >= MAX_HOLDINGS) {
      throw new HttpError(400, `You can keep up to ${MAX_HOLDINGS} holdings`);
    }
    res.status(201).json(await Holding.create({ ...values, user: req.userId }));
  })
);

router.delete(
  "/holdings/:id",
  requireUser,
  handle(async (req, res) => {
    const id = parseBody(objectId, req.params.id);
    const removed = await Holding.findOneAndDelete({ _id: id, user: req.userId });
    if (!removed) throw new HttpError(404, "Holding not found");
    res.json({ success: true });
  })
);

router.get(
  "/alerts",
  requireUser,
  handle(async (req, res) => {
    res.json(await Alert.find({ user: req.userId }).sort({ active: -1, createdAt: -1 }));
  })
);

router.post(
  "/alerts",
  requireUser,
  handle(async (req, res) => {
    const values = parseBody(alertSchema, req.body);
    const active = await Alert.countDocuments({ user: req.userId, active: true });
    if (active >= MAX_ALERTS) {
      throw new HttpError(400, `You can keep up to ${MAX_ALERTS} active alerts`);
    }
    res.status(201).json(await Alert.create({ ...values, user: req.userId }));
  })
);

router.delete(
  "/alerts/:id",
  requireUser,
  handle(async (req, res) => {
    const id = parseBody(objectId, req.params.id);
    const removed = await Alert.findOneAndDelete({ _id: id, user: req.userId });
    if (!removed) throw new HttpError(404, "Alert not found");
    res.json({ success: true });
  })
);

router.get(
  "/notifications",
  requireUser,
  handle(async (req, res) => {
    res.json(
      await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(30)
    );
  })
);

router.post(
  "/notifications/read",
  requireUser,
  handle(async (req, res) => {
    await Notification.updateMany({ user: req.userId, read: false }, { read: true });
    res.json({ success: true });
  })
);

export default router;
