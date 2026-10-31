import { ExternalLink, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Change from "../components/Change";
import PriceChart from "../components/PriceChart";
import StarButton from "../components/StarButton";
import { useData } from "../hooks/useData";
import { useLivePrice } from "../hooks/useLivePrice";
import { formatCompact, formatDate, formatMoney, formatNumber } from "../lib/format";
import { usePreferences } from "../lib/preferences";

const RANGES = [
  ["1", "24H"],
  ["7", "7D"],
  ["30", "1M"],
  ["90", "3M"],
  ["365", "1Y"],
];

function Converter({ coin, price, currency }) {
  const [amount, setAmount] = useState("1");
  const coins = Number(amount) || 0;
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Converter</h2>
      <label className="block">
        <span className="text-sm text-muted uppercase">{coin.symbol} amount</span>
        <input className="input num mt-1" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <p className="num text-xl font-semibold mt-3" aria-label="Converted value">
        {formatMoney(coins * (price || 0), currency)}
      </p>
    </section>
  );
}

function Coin() {
  const { id } = useParams();
  const { currency } = usePreferences();
  const [days, setDays] = useState("7");
  const { data: coin, error } = useData("coin", { id });
  const chart = useData("chart", { id, currency, days }, { refreshMs: 300000 });
  const { price: liveUsd, live } = useLivePrice(coin?.symbol);

  const apiPrice = coin?.market?.price?.[currency];
  const usdPrice = coin?.market?.price?.usd;
  const price = useMemo(() => {
    if (!live || !liveUsd || !usdPrice) return apiPrice;
    return liveUsd * (apiPrice / usdPrice);
  }, [live, liveUsd, usdPrice, apiPrice]);

  const previous = useRef(price);
  const tick = price > previous.current ? "tick-up" : price < previous.current ? "tick-down" : "";
  useEffect(() => {
    previous.current = price;
  }, [price]);

  if (error && !coin) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">{error}</h1>
        <Link to="/" className="btn-primary mt-5">Back to markets</Link>
      </div>
    );
  }
  if (!coin) {
    return (
      <div aria-hidden="true" className="animate-pulse">
        <div className="h-10 w-64 bg-raised rounded-lg" />
        <div className="h-96 bg-raised rounded-2xl mt-6" />
      </div>
    );
  }

  const { market } = coin;
  const stats = [
    ["Market cap", formatCompact(market.marketCap?.[currency], currency)],
    ["24h volume", formatCompact(market.volume?.[currency], currency)],
    ["24h high", formatMoney(market.high24h?.[currency], currency)],
    ["24h low", formatMoney(market.low24h?.[currency], currency)],
    ["All-time high", formatMoney(market.ath?.[currency], currency)],
    ["ATH date", market.athDate ? formatDate(market.athDate) : "-"],
    ["Circulating supply", formatNumber(market.circulatingSupply)],
    ["Max supply", market.maxSupply ? formatNumber(market.maxSupply) : "No cap"],
  ];
  const summary = coin.description.split("\n\n")[0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {coin.image && <img src={coin.image} alt="" className="h-11 w-11 rounded-full" />}
        <h1 className="text-3xl font-bold tracking-tight">{coin.name}</h1>
        <span className="text-muted uppercase">{coin.symbol}</span>
        {coin.rank && <span className="num text-xs rounded-md bg-raised px-2 py-1">Rank {coin.rank}</span>}
        <StarButton id={coin.id} name={coin.name} />
      </div>

      <div className="flex flex-wrap items-end gap-4 mt-4">
        <p key={price} className={`num text-3xl md:text-4xl font-semibold ${tick}`}>
          {formatMoney(price, currency)}
        </p>
        <Change value={market.change24h} className="text-lg mb-1" />
        {live && (
          <span className="flex items-center gap-1.5 text-xs text-up mb-2">
            <Radio size={13} aria-hidden="true" /> Live
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 mt-6">
        <section className="card p-4 min-w-0 self-start w-full">
          <div role="group" aria-label="Chart range" className="flex gap-1 mb-3">
            {RANGES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() => setDays(value)}
                className={`px-3 h-8 rounded-lg text-sm num cursor-pointer transition-colors ${days === value ? "bg-brand text-on-brand" : "text-muted hover:bg-raised"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {chart.data ? (
            <PriceChart prices={chart.data} />
          ) : chart.error ? (
            <p className="h-80 flex items-center justify-center text-muted">{chart.error}</p>
          ) : (
            <div aria-hidden="true" className="h-80 bg-raised rounded-xl animate-pulse" />
          )}
        </section>

        <div className="flex flex-col gap-5">
          <Converter coin={coin} price={price} currency={currency} />
          <section className="card p-5">
            <h2 className="font-semibold mb-2">Performance</h2>
            <dl className="text-sm">
              {[["24 hours", market.change24h], ["7 days", market.change7d], ["1 year", market.change1y]].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1">
                  <dt className="text-muted">{label}</dt>
                  <dd className="m-0"><Change value={value} /></dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="num font-medium mt-1 m-0">{value}</dd>
          </div>
        ))}
      </dl>

      {summary && (
        <section className="card p-5 mt-5">
          <h2 className="font-semibold">About {coin.name}</h2>
          <p className="text-muted mt-2 leading-relaxed whitespace-pre-line">{summary}</p>
          {coin.homepage && /^https?:\/\//.test(coin.homepage) && (
            <a href={coin.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand mt-3">
              Official website <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </section>
      )}
    </div>
  );
}

export default Coin;
