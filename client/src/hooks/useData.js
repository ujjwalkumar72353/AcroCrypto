import { useEffect, useRef, useState } from "react";

const MINUTE = 60000;

// Keeps showing the last good data if a refresh fails
export const useData = (url, { refreshMs = MINUTE } = {}) => {
  const [state, setState] = useState({ data: null, error: null, stale: false, loading: Boolean(url) });
  const current = useRef(url);

  useEffect(() => {
    current.current = url;
    setState({ data: null, error: null, stale: false, loading: Boolean(url) });
    if (!url) return undefined;

    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) {
          throw new Error(body?.message || "Could not load data");
        }
        setState({
          data: body,
          error: null,
          stale: response.headers.get("x-data-stale") === "true",
          loading: false,
        });
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        setState((old) => ({ ...old, error: error.message, loading: false }));
      }
    };

    load();
    const timer = refreshMs ? setInterval(() => {
      if (!document.hidden) load();
    }, refreshMs) : null;
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [url, refreshMs]);

  return state;
};
