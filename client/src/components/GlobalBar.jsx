import { useData } from "../hooks/useData";
import { formatCompact, formatPercent } from "../lib/format";
import { usePreferences } from "../lib/preferences";

const MOOD_COLORS = (value) =>
  value < 40 ? "text-down" : value > 60 ? "text-up" : "text-ink";

function Stat({ label, children }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted">{label} </span>
      <span className="num text-ink">{children}</span>
    </span>
  );
}

function GlobalBar() {
  const { currency } = usePreferences();
  const { data } = useData("/api/global", { refreshMs: 120000 });
  const mood = useData("/api/fear-greed", { refreshMs: 1800000 });
  if (!data) return <div className="h-9 border-b border-line" />;
  return (
    <div className="border-b border-line bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-9 flex items-center gap-6 text-xs overflow-x-auto">
        <Stat label="Market cap">{formatCompact(data.total_market_cap?.[currency], currency)}</Stat>
        <Stat label="24h volume">{formatCompact(data.total_volume?.[currency], currency)}</Stat>
        <Stat label="BTC share">{data.market_cap_percentage?.btc?.toFixed(1)}%</Stat>
        <Stat label="24h change">{formatPercent(data.market_cap_change_percentage_24h_usd)}</Stat>
        {mood.data && (
          <span className="whitespace-nowrap">
            <span className="text-muted">Fear and Greed </span>
            <span className={`num ${MOOD_COLORS(mood.data.value)}`}>
              {mood.data.value} {mood.data.label}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export default GlobalBar;
