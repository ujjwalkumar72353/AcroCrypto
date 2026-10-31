import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCompact, formatMoney } from "../lib/format";
import { usePreferences } from "../lib/preferences";
import Change from "./Change";
import Sparkline from "./Sparkline";
import StarButton from "./StarButton";

const PAGE_SIZE = 25;

const COLUMNS = [
  { key: "market_cap_rank", label: "#", className: "hidden sm:table-cell" },
  { key: "name", label: "Coin", align: "left" },
  { key: "current_price", label: "Price" },
  { key: "price_change_percentage_1h_in_currency", label: "1h", className: "hidden lg:table-cell" },
  { key: "price_change_percentage_24h_in_currency", label: "24h" },
  { key: "price_change_percentage_7d_in_currency", label: "7d", className: "hidden md:table-cell" },
  { key: "market_cap", label: "Market cap", className: "hidden md:table-cell" },
  { key: "total_volume", label: "Volume", className: "hidden xl:table-cell" },
];

const sortRows = (rows, key, direction) =>
  [...rows].sort((a, b) => {
    const first = a[key] ?? -Infinity;
    const second = b[key] ?? -Infinity;
    const order =
      typeof first === "string" ? first.localeCompare(second) : first - second;
    return direction === "asc" ? order : -order;
  });

export function TableSkeleton() {
  return (
    <div aria-hidden="true" className="card p-4 flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="h-9 bg-raised rounded-lg" />
      ))}
    </div>
  );
}

function CoinTable({ coins, paginate = true }) {
  const { currency } = usePreferences();
  const [sort, setSort] = useState({ key: "market_cap_rank", direction: "asc" });
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const rows = useMemo(
    () => sortRows(coins, sort.key, sort.direction),
    [coins, sort]
  );
  const pages = paginate ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, pages);
  const visible = paginate
    ? rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
    : rows;

  const toggle = (key) => {
    setPage(1);
    setSort((old) =>
      old.key === key
        ? { key, direction: old.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "market_cap_rank" || key === "name" ? "asc" : "desc" }
    );
  };

  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted border-b border-line">
              <th scope="col" className="w-10"><span className="sr-only">Watchlist</span></th>
              {COLUMNS.map(({ key, label, align, className = "" }) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                  className={`px-3 py-2.5 font-medium ${align === "left" ? "text-left" : "text-right"} ${className}`}
                >
                  <button type="button" className="inline-flex items-center gap-1 cursor-pointer hover:text-ink" onClick={() => toggle(key)}>
                    {label}
                    {sort.key === key &&
                      (sort.direction === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-medium text-right hidden lg:table-cell">Last 7 days</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((coin) => (
              <tr
                key={coin.id}
                onClick={() => navigate(`/coin/${coin.id}`)}
                className="border-b border-line last:border-0 cursor-pointer hover:bg-raised transition-colors"
              >
                <td className="pl-1"><StarButton id={coin.id} name={coin.name} /></td>
                <td className="px-3 py-2.5 text-right text-muted num hidden sm:table-cell">{coin.market_cap_rank ?? "-"}</td>
                <th scope="row" className="px-3 py-2.5 text-left font-medium">
                  <a href={`/coin/${coin.id}`} onClick={(event) => event.preventDefault()} className="flex items-center gap-2.5 min-w-0">
                    <img src={coin.image} alt="" loading="lazy" className="h-6 w-6 rounded-full shrink-0" />
                    <span className="truncate">{coin.name}</span>
                    <span className="text-xs text-muted uppercase hidden sm:inline">{coin.symbol}</span>
                  </a>
                </th>
                <td className="px-3 py-2.5 text-right num whitespace-nowrap">{formatMoney(coin.current_price, currency)}</td>
                <td className="px-3 py-2.5 text-right hidden lg:table-cell"><Change value={coin.price_change_percentage_1h_in_currency} /></td>
                <td className="px-3 py-2.5 text-right"><Change value={coin.price_change_percentage_24h_in_currency} /></td>
                <td className="px-3 py-2.5 text-right hidden md:table-cell"><Change value={coin.price_change_percentage_7d_in_currency} /></td>
                <td className="px-3 py-2.5 text-right num hidden md:table-cell whitespace-nowrap">{formatCompact(coin.market_cap, currency)}</td>
                <td className="px-3 py-2.5 text-right num hidden xl:table-cell whitespace-nowrap">{formatCompact(coin.total_volume, currency)}</td>
                <td className="px-3 py-1 hidden lg:table-cell">
                  <div className="flex justify-end">
                    <Sparkline prices={coin.sparkline_in_7d?.price} label={`${coin.name} price, last 7 days`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center items-center gap-3 mt-5">
          <button type="button" className="btn-ghost" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
          <span className="text-sm text-muted">Page {current} of {pages}</span>
          <button type="button" className="btn-ghost" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
        </nav>
      )}
    </div>
  );
}

export default CoinTable;
