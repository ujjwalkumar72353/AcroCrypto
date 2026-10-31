import { useEffect, useMemo, useState } from "react";
import { loadMarket } from "../lib/market";

const MINUTE = 60000;
const RETRY_MS = 15000;
const MAX_RETRIES = 8;

// Keeps showing the last good data if a refresh fails
export const useData = (type, params, { refreshMs = MINUTE } = {}) => {
  const [state, setState] = useState({ data: null, error: null, stale: false, loading: Boolean(type) });
  const key = useMemo(() => JSON.stringify(params ?? {}), [params]);

  useEffect(() => {
    setState({ data: null, error: null, stale: false, loading: Boolean(type) });
    if (!type) return undefined;

    let active = true;
    let retries = 0;
    let retryTimer;
    let hasData = false;
    const values = JSON.parse(key);
    const load = async () => {
      try {
        const { data, stale } = await loadMarket(type, values);
        if (!active) return;
        hasData = true;
        setState({ data, error: null, stale, loading: false });
      } catch (error) {
        if (!active) return;
        setState((old) => ({ ...old, error: error.message, loading: false }));
        // A new visitor has no saved data, so a rate limit would otherwise leave an empty page
        if (!hasData && retries < MAX_RETRIES) {
          retries += 1;
          retryTimer = setTimeout(load, RETRY_MS);
        }
      }
    };

    load();
    const timer = refreshMs
      ? setInterval(() => {
          if (!document.hidden) load();
        }, refreshMs)
      : null;
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(retryTimer);
    };
  }, [type, key, refreshMs]);

  return state;
};
