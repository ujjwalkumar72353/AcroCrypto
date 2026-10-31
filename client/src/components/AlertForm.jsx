import { BellPlus, Check } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount } from "../lib/account";
import { post } from "../lib/api";

function AlertForm({ coin, price, currency }) {
  const { user } = useAccount();
  const { pathname } = useLocation();
  const [direction, setDirection] = useState("below");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState({ busy: false, saved: false, error: "" });

  if (!user) {
    return (
      <section className="card p-5">
        <h2 className="font-semibold mb-2">Price alert</h2>
        <p className="text-sm text-muted mb-3">Get notified when {coin.name} hits your price.</p>
        <Link to="/sign-in" state={{ from: pathname }} className="btn-ghost w-full">
          Sign in to set an alert
        </Link>
      </section>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(target);
    const alreadyThere = direction === "above" ? price >= value : price <= value;
    if (alreadyThere) {
      setStatus({ busy: false, saved: false, error: `The price is already ${direction} this target.` });
      return;
    }
    setStatus({ busy: true, saved: false, error: "" });
    try {
      await post("/alerts", {
        coinId: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        currency,
        direction,
        target: value,
      });
      setTarget("");
      setStatus({ busy: false, saved: true, error: "" });
    } catch (error) {
      setStatus({ busy: false, saved: false, error: error.message });
    }
  };

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Price alert</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block">
          <span className="text-sm text-muted">Notify me when price goes</span>
          <select className="input mt-1" value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="below">Below</option>
            <option value="above">Above</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-muted">Target price ({currency.toUpperCase()})</span>
          <input className="input num mt-1" type="number" min="0" step="any" required value={target} onChange={(event) => { setTarget(event.target.value); setStatus({ busy: false, saved: false, error: "" }); }} />
        </label>
        <button type="submit" className="btn-primary" disabled={status.busy}>
          <BellPlus size={16} aria-hidden="true" /> {status.busy ? "Saving" : "Set alert"}
        </button>
        {status.saved && (
          <p role="status" className="text-sm text-up flex items-center gap-1.5">
            <Check size={15} aria-hidden="true" /> Alert saved
          </p>
        )}
        {status.error && <p role="alert" className="text-sm text-down">{status.error}</p>}
      </form>
    </section>
  );
}

export default AlertForm;
