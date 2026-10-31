import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAccount } from "../lib/account";
import { get, remove } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";

const REFRESH_MS = 30000;

function Alerts() {
  const { user, ready } = useAccount();
  const { pathname } = useLocation();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return undefined;
    const load = () =>
      get("/alerts").then(setAlerts).catch((failure) => setError(failure.message));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [user]);

  if (!ready) return <div className="min-h-[60vh]" />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: pathname }} />;

  const removeAlert = async (id) => {
    await remove(`/alerts/${id}`);
    setAlerts(alerts.filter((alert) => alert._id !== id));
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">Price alerts</h1>
      <p className="text-muted mb-6">Prices are checked about every 10 minutes while the server is running.</p>
      {error && <p role="alert" className="card p-6 text-center text-muted">{error}</p>}
      {alerts?.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-semibold">No alerts yet</p>
          <p className="text-sm text-muted mt-1 mb-4">Open any coin and set a target price.</p>
          <Link to="/" className="btn-primary">Browse markets</Link>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {alerts?.map((alert) => (
          <li key={alert._id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/coin/${alert.coinId}`} className="font-medium hover:text-brand">{alert.name}</Link>
              <p className="text-sm text-muted">
                {alert.direction === "above" ? "Above" : "Below"}{" "}
                <span className="num">{formatMoney(alert.target, alert.currency)}</span>
                {alert.triggeredAt && (
                  <> · Hit <span className="num">{formatMoney(alert.triggeredPrice, alert.currency)}</span> on {formatDate(alert.triggeredAt)}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${alert.active ? "bg-raised" : "bg-brand text-on-brand"}`}>
                {alert.active ? "Watching" : "Triggered"}
              </span>
              <button type="button" aria-label={`Delete ${alert.name} alert`} className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer hover:bg-raised" onClick={() => removeAlert(alert._id)}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Alerts;
