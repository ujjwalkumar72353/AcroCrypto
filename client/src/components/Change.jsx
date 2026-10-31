import { formatPercent } from "../lib/format";

function Change({ value, className = "" }) {
  const tone =
    value === null || value === undefined
      ? "text-muted"
      : value >= 0
        ? "text-up"
        : "text-down";
  return <span className={`num ${tone} ${className}`}>{formatPercent(value)}</span>;
}

export default Change;
