import jwt from "jsonwebtoken";
import { isProduction } from "./config.js";

const COOKIE = "acro_session";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const options = { httpOnly: true, sameSite: "lax", secure: isProduction };

export const startSession = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, { ...options, maxAge: MAX_AGE });
};

export const endSession = (res) => res.clearCookie(COOKIE, options);

export const readUserId = (req) => {
  try {
    return jwt.verify(req.cookies[COOKIE], process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
};

export const requireUser = (req, res, next) => {
  const id = readUserId(req);
  if (!id) {
    return res.status(401).json({ success: false, message: "Please sign in to continue" });
  }
  req.userId = id;
  next();
};
