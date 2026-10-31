import Alert from "./models/alert.js";
import Notification from "./models/notification.js";
import User from "./models/user.js";
import { coingecko } from "./upstream.js";

const CURRENCIES = "usd,inr";
const MAX_IDS = 250;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

const isCrossed = ({ direction, target }, price) =>
  direction === "above" ? price >= target : price <= target;

const describe = (alert, price) =>
  `${alert.name} is now ${price.toLocaleString("en-US")} ${alert.currency.toUpperCase()}, ${alert.direction} your target of ${alert.target.toLocaleString("en-US")}.`;

const sendEmail = async (alert, body) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return;
  const user = await User.findById(alert.user);
  if (!user) return;
  const base = process.env.RESEND_BASE || "https://api.resend.com";
  const appUrl = process.env.APP_URL || "";
  const response = await fetch(`${base}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from,
      to: user.email,
      subject: `${alert.name} price alert`,
      text: `${body}\n\n${appUrl}/coin/${alert.coinId}`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Email failed with ${response.status}`);
};

const trigger = async (alert, price) => {
  // Only one worker can claim an alert, so a user is never notified twice
  const claimed = await Alert.findOneAndUpdate(
    { _id: alert._id, active: true },
    { active: false, triggeredAt: new Date(), triggeredPrice: price },
    { returnDocument: "after" }
  );
  if (!claimed) return;
  const body = describe(alert, price);
  await Notification.create({
    user: alert.user,
    title: `${alert.name} price alert`,
    body,
    link: `/coin/${alert.coinId}`,
  });
  await sendEmail(alert, body).catch((error) => console.error(error.message));
};

export const checkAlerts = async () => {
  const alerts = await Alert.find({ active: true });
  if (alerts.length === 0) return 0;
  const ids = [...new Set(alerts.map((alert) => alert.coinId))].slice(0, MAX_IDS);
  const prices = await coingecko("/simple/price", {
    ids: ids.join(","),
    vs_currencies: CURRENCIES,
  });
  const crossed = alerts.filter((alert) => {
    const price = prices[alert.coinId]?.[alert.currency];
    return price !== undefined && isCrossed(alert, price);
  });
  await Promise.all(
    crossed.map((alert) => trigger(alert, prices[alert.coinId][alert.currency]))
  );
  return crossed.length;
};

export const startAlertWorker = () => {
  const interval = Number(process.env.ALERT_CHECK_MS) || DEFAULT_INTERVAL_MS;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await checkAlerts();
    } catch (error) {
      console.error("Alert check failed:", error.message);
    } finally {
      running = false;
    }
  }, interval);
  return () => clearInterval(timer);
};
