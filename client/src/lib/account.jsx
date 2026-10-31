import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { get, post, remove } from "./api";
import { PORTFOLIO, useStoredList, WATCHLIST } from "./storage";

const AccountContext = createContext(null);

// Guests keep data in the browser. Signing in moves it into the account.
export function AccountProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [holdings, setHoldings] = useState([]);
  const [guestWatchlist, setGuestWatchlist] = useStoredList(WATCHLIST);
  const [guestHoldings, setGuestHoldings] = useStoredList(PORTFOLIO);

  const loadHoldings = useCallback(() => get("/holdings").then(setHoldings), []);

  useEffect(() => {
    get("/auth/session")
      .then((session) => {
        setUser(session);
        return session ? loadHoldings() : null;
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [loadHoldings]);

  const enter = useCallback(
    async (account) => {
      let current = account;
      if (guestWatchlist.length || guestHoldings.length) {
        const { watchlist } = await post("/account/sync", {
          watchlist: guestWatchlist,
          holdings: guestHoldings.map(({ id, ...holding }) => holding),
        });
        current = { ...account, watchlist };
        setGuestWatchlist([]);
        setGuestHoldings([]);
      }
      setUser(current);
      await loadHoldings();
    },
    [guestWatchlist, guestHoldings, setGuestWatchlist, setGuestHoldings, loadHoldings]
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      watchlist: user ? user.watchlist : guestWatchlist,
      holdings: user ? holdings : guestHoldings,
      signIn: async (values) => enter(await post("/auth/signin", values)),
      signUp: async (values) => enter(await post("/auth/signup", values)),
      signOut: async () => {
        await post("/auth/signout");
        setUser(null);
        setHoldings([]);
      },
      toggleWatch: async (id) => {
        if (user) {
          const { watchlist } = await post(`/watchlist/${id}`);
          setUser((old) => ({ ...old, watchlist }));
        } else {
          setGuestWatchlist(
            guestWatchlist.includes(id)
              ? guestWatchlist.filter((item) => item !== id)
              : [...guestWatchlist, id]
          );
        }
      },
      addHolding: async (holding) => {
        if (user) {
          const created = await post("/holdings", holding);
          setHoldings((old) => [...old, created]);
        } else {
          setGuestHoldings([...guestHoldings, { ...holding, id: crypto.randomUUID() }]);
        }
      },
      removeHolding: async (holding) => {
        if (user) {
          await remove(`/holdings/${holding._id}`);
          setHoldings((old) => old.filter((item) => item._id !== holding._id));
        } else {
          setGuestHoldings(guestHoldings.filter((item) => item.id !== holding.id));
        }
      },
    }),
    [user, ready, holdings, guestWatchlist, guestHoldings, enter, setGuestHoldings, setGuestWatchlist]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const useAccount = () => useContext(AccountContext);
