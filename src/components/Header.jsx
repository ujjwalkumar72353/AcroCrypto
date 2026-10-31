import { Moon, Sun } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { usePreferences } from "../lib/preferences";
import CoinSearch from "./CoinSearch";

const navClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? "text-brand" : "text-muted hover:text-ink"
  }`;

function Header() {
  const { currency, setCurrency, theme, setTheme } = usePreferences();
  return (
    <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg mr-2">
          <span className="h-8 w-8 rounded-lg bg-brand text-on-brand flex items-center justify-center font-mono font-bold">
            A
          </span>
          AcroCrypto
        </Link>
        <nav aria-label="Main" className="flex items-center order-3 md:order-none w-full md:w-auto">
          <NavLink to="/" end className={navClass}>Markets</NavLink>
          <NavLink to="/watchlist" className={navClass}>Watchlist</NavLink>
          <NavLink to="/portfolio" className={navClass}>Portfolio</NavLink>
        </nav>
        <div className="flex-1 min-w-0 flex justify-end items-center gap-2">
          <div className="hidden sm:block w-64 min-w-0">
            <CoinSearch />
          </div>
          <select
            aria-label="Currency"
            className="input w-20 px-2"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="inr">INR</option>
            <option value="usd">USD</option>
          </select>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="h-10 w-10 shrink-0 rounded-xl border border-line bg-surface flex items-center justify-center cursor-pointer hover:bg-raised transition-colors"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
