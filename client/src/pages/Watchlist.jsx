import { Link } from "react-router-dom";
import CoinTable, { TableSkeleton } from "../components/CoinTable";
import { useData } from "../hooks/useData";
import { useAccount } from "../lib/account";
import { usePreferences } from "../lib/preferences";

function Watchlist() {
  const { currency } = usePreferences();
  const { watchlist, user } = useAccount();
  const ids = watchlist.slice(0, 50).join(",");
  const { data, error, loading } = useData(
    ids ? `/api/markets?currency=${currency}&ids=${ids}` : null
  );

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">Watchlist</h1>
      <p className="text-muted mb-6">
        {user ? "Saved to your account." : "Saved in this browser. Sign in to keep it on every device."}
      </p>
      {watchlist.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">Your watchlist is empty</p>
          <p className="text-sm text-muted mt-1 mb-4">Tap the star on any coin to track it here.</p>
          <Link to="/" className="btn-primary">Browse markets</Link>
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : error && !data ? (
        <p role="alert" className="card p-8 text-center text-muted">{error}</p>
      ) : (
        <CoinTable coins={(data || []).filter((coin) => watchlist.includes(coin.id))} paginate={false} />
      )}
    </div>
  );
}

export default Watchlist;
