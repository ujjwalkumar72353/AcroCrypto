import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Change from "../components/Change";
import CoinSearch from "../components/CoinSearch";
import { useData } from "../hooks/useData";
import { formatCompact, formatMoney } from "../lib/format";
import { usePreferences } from "../lib/preferences";
import { PORTFOLIO, useStoredList } from "../lib/storage";

function AddHolding({ currency, onAdd }) {
  const [coin, setCoin] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!coin) return;
    onAdd({
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      thumb: coin.thumb || "",
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      currency,
    });
    setCoin(null);
    setQuantity("");
    setBuyPrice("");
  };

  return (
    <form onSubmit={submit} className="card p-4 grid sm:grid-cols-[1fr_140px_180px_auto] gap-3 items-end mb-5">
      <div>
        <span className="text-sm font-medium block mb-1">{coin ? `Coin: ${coin.name}` : "Coin"}</span>
        <CoinSearch onPick={setCoin} label="Find a coin to add" placeholder="Search a coin" />
      </div>
      <label className="block">
        <span className="text-sm font-medium">Quantity</span>
        <input className="input num mt-1" type="number" min="0" step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Buy price ({currency.toUpperCase()})</span>
        <input className="input num mt-1" type="number" min="0" step="any" required value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} />
      </label>
      <button type="submit" className="btn-primary" disabled={!coin}>Add holding</button>
    </form>
  );
}

function Portfolio() {
  const { currency } = usePreferences();
  const [holdings, setHoldings] = useStoredList(PORTFOLIO);
  const ids = [...new Set(holdings.map((item) => item.coinId))].slice(0, 50).join(",");
  const markets = useData(ids ? "markets" : null, { currency, ids });
  const rates = useData("rates", undefined, { refreshMs: 300000 });

  const rows = useMemo(() => {
    if (!markets.data || !rates.data) return [];
    const prices = new Map(markets.data.map((coin) => [coin.id, coin.current_price]));
    return holdings.map((holding) => {
      const price = prices.get(holding.coinId) ?? null;
      const buyPrice = holding.buyPrice * (rates.data[currency] / rates.data[holding.currency]);
      const cost = holding.quantity * buyPrice;
      const value = price === null ? null : holding.quantity * price;
      return { ...holding, price, cost, value, gain: value === null ? null : value - cost };
    });
  }, [holdings, markets.data, rates.data, currency]);

  const priced = rows.filter((row) => row.value !== null);
  const totalValue = priced.reduce((sum, row) => sum + row.value, 0);
  const totalCost = priced.reduce((sum, row) => sum + row.cost, 0);
  const totalGain = totalValue - totalCost;
  const gainPercent = totalCost ? (totalGain / totalCost) * 100 : 0;
  const money = (value) => formatMoney(value, currency);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">Portfolio</h1>
      <p className="text-muted mb-6">Saved in this browser only. It isn't connected to any exchange or wallet.</p>

      <AddHolding
        currency={currency}
        onAdd={(holding) => setHoldings([...holdings, { ...holding, id: crypto.randomUUID() }])}
      />

      {holdings.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">No holdings yet</p>
          <p className="text-sm text-muted mt-1">Add a coin above to see your profit and loss.</p>
        </div>
      ) : (markets.error && !markets.data) || (rates.error && !rates.data) ? (
        <p role="alert" className="card p-8 text-center text-muted">
          {markets.error || rates.error} Trying again automatically.
        </p>
      ) : !markets.data || !rates.data ? (
        <p role="status" className="card p-8 text-center text-muted">Loading live prices</p>
      ) : (
        <>
          <dl className="grid sm:grid-cols-3 gap-3 mb-5">
            <div className="card p-4">
              <dt className="text-sm text-muted">Current value</dt>
              <dd className="num text-2xl font-semibold mt-1 m-0">{formatCompact(totalValue, currency)}</dd>
            </div>
            <div className="card p-4">
              <dt className="text-sm text-muted">Total invested</dt>
              <dd className="num text-2xl font-semibold mt-1 m-0">{formatCompact(totalCost, currency)}</dd>
            </div>
            <div className="card p-4">
              <dt className="text-sm text-muted">Profit or loss</dt>
              <dd className={`num text-2xl font-semibold mt-1 m-0 ${totalGain >= 0 ? "text-up" : "text-down"}`}>
                {formatCompact(totalGain, currency)}
              </dd>
              <dd className="m-0"><Change value={gainPercent} className="text-sm" /></dd>
            </div>
          </dl>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-muted border-b border-line text-right">
                  <th scope="col" className="px-4 py-2.5 font-medium text-left">Coin</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Quantity</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Value</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Profit or loss</th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 text-right">
                    <th scope="row" className="px-4 py-2.5 font-medium text-left">
                      <Link to={`/coin/${row.coinId}`} className="hover:text-brand flex items-center gap-2">
                        {row.thumb && <img src={row.thumb} alt="" className="h-5 w-5 rounded-full" />}
                        {row.name}
                      </Link>
                    </th>
                    <td className="px-4 py-2.5 num">{row.quantity}</td>
                    <td className="px-4 py-2.5 num">{money(row.price)}</td>
                    <td className="px-4 py-2.5 num">{money(row.value)}</td>
                    <td className={`px-4 py-2.5 num ${row.gain >= 0 ? "text-up" : "text-down"}`}>{money(row.gain)}</td>
                    <td className="pr-2">
                      <button type="button" aria-label={`Remove ${row.name}`} className="h-9 w-9 inline-flex items-center justify-center rounded-lg cursor-pointer hover:bg-raised" onClick={() => setHoldings(holdings.filter((item) => item.id !== row.id))}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Portfolio;
