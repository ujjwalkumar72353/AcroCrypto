import { Flame, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Change from "../components/Change";
import CoinTable, { TableSkeleton } from "../components/CoinTable";
import { useData } from "../hooks/useData";
import { usePreferences } from "../lib/preferences";

const CHANGE = "price_change_percentage_24h_in_currency";
const TABS = ["All", "Gainers", "Losers"];

function MoverCard({ title, icon: Icon, tone, items }) {
  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-semibold mb-3">
        <Icon size={17} className={tone} aria-hidden="true" /> {title}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((coin) => (
          <li key={coin.id}>
            <Link to={`/coin/${coin.id}`} className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-raised transition-colors">
              {(coin.image || coin.thumb) && <img src={coin.image || coin.thumb} alt="" loading="lazy" className="h-5 w-5 rounded-full" />}
              <span className="flex-1 truncate text-sm">{coin.name}</span>
              <Change value={coin.change} className="text-sm" />
            </Link>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">No data yet</li>}
      </ul>
    </section>
  );
}

function Markets() {
  const { currency } = usePreferences();
  const { data, error, stale, loading } = useData(`/api/markets?currency=${currency}`);
  const trending = useData("/api/trending", { refreshMs: 600000 });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");

  const coins = data || [];
  const movers = useMemo(() => {
    const ranked = coins
      .filter((coin) => coin[CHANGE] !== null && coin[CHANGE] !== undefined)
      .map((coin) => ({ ...coin, change: coin[CHANGE] }))
      .sort((a, b) => b.change - a.change);
    return { up: ranked.slice(0, 5), down: ranked.slice(-5).reverse() };
  }, [coins]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    let rows = coins.filter(
      (coin) =>
        !term ||
        coin.name.toLowerCase().includes(term) ||
        coin.symbol.toLowerCase().includes(term)
    );
    if (tab === "Gainers") rows = rows.filter((coin) => coin[CHANGE] > 0);
    if (tab === "Losers") rows = rows.filter((coin) => coin[CHANGE] < 0);
    return rows;
  }, [coins, query, tab]);

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Crypto markets</h1>
      <p className="text-muted mt-1 mb-6">Top 100 coins by market cap, refreshed every minute.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MoverCard title="Top gainers" icon={TrendingUp} tone="text-up" items={movers.up} />
        <MoverCard title="Top losers" icon={TrendingDown} tone="text-down" items={movers.down} />
        <MoverCard
          title="Trending"
          icon={Flame}
          tone="text-amber-500"
          items={(trending.data || []).slice(0, 5).map((coin) => ({ ...coin, change: coin.change24h }))}
        />
      </div>

      {stale && <p role="status" className="text-sm text-muted mb-3">Showing the last saved prices while live data catches up.</p>}

      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <div role="tablist" aria-label="Market filter" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`px-3 h-8 rounded-lg text-sm font-medium cursor-pointer transition-colors ${tab === name ? "bg-brand text-on-brand" : "text-muted hover:text-ink"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Filter coins" className="input pl-9" placeholder="Filter top 100" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      {loading && <TableSkeleton />}
      {error && !data && (
        <div role="alert" className="card p-8 text-center">
          <p className="font-semibold">Market data is unavailable</p>
          <p className="text-sm text-muted mt-1">{error}</p>
        </div>
      )}
      {data && (shown.length > 0 ? (
        <CoinTable key={`${tab}-${query}`} coins={shown} />
      ) : (
        <p className="card p-8 text-center text-muted">No coins match this filter.</p>
      ))}
    </div>
  );
}

export default Markets;
