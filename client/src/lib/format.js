const LOCALES = { usd: "en-US", inr: "en-IN" };

export const formatMoney = (value, currency) => {
  if (value === null || value === undefined) return "-";
  const size = Math.abs(value);
  const digits = size >= 1 ? 2 : size >= 0.01 ? 4 : 8;
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: size >= 1 ? 2 : 2,
    maximumFractionDigits: digits,
  }).format(value);
};

export const formatCompact = (value, currency) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (value) =>
  value === null || value === undefined
    ? "-"
    : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);

export const formatPercent = (value) =>
  value === null || value === undefined
    ? "-"
    : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

export const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
