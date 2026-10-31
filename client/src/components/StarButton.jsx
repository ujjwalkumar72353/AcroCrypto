import { Star } from "lucide-react";
import { useAccount } from "../lib/account";

function StarButton({ id, name }) {
  const { watchlist, toggleWatch } = useAccount();
  const active = watchlist.includes(id);
  return (
    <button
      type="button"
      aria-label={`${active ? "Remove" : "Add"} ${name} ${active ? "from" : "to"} watchlist`}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWatch(id).catch(() => {});
      }}
      className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer hover:bg-raised transition-colors"
    >
      <Star size={16} aria-hidden="true" className={active ? "fill-amber-400 text-amber-400" : "text-muted"} />
    </button>
  );
}

export default StarButton;
