import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEBOUNCE_MS = 300;

// Pass onPick to choose a coin instead of opening its page
function CoinSearch({ onPick, placeholder = "Search any coin", label = "Search coins" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setResults(await response.json());
          setOpen(true);
        }
      } catch {}
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const pick = (coin) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    if (onPick) onPick(coin);
    else navigate(`/coin/${coin.id}`);
  };

  return (
    <div ref={ref} className="relative">
      <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        aria-label={label}
        className="input pl-9"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 card shadow-xl p-1 z-40 max-h-80 overflow-y-auto">
          {results.map((coin) => (
            <li key={coin.id}>
              <button
                type="button"
                onClick={() => pick(coin)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-raised cursor-pointer text-left"
              >
                {coin.thumb && <img src={coin.thumb} alt="" className="h-5 w-5 rounded-full" />}
                <span className="truncate flex-1">{coin.name}</span>
                <span className="text-xs text-muted uppercase">{coin.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CoinSearch;
