import { useSyncExternalStore } from "react";

const stores = new Map();

const createStore = (key) => {
  let value;
  try {
    value = JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    value = [];
  }
  const listeners = new Set();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const getStore = (key) => {
  if (!stores.has(key)) stores.set(key, createStore(key));
  return stores.get(key);
};

export const useStoredList = (key) => {
  const store = getStore(key);
  const items = useSyncExternalStore(store.subscribe, store.get);
  return [items, store.set];
};

export const WATCHLIST = "acro.watchlist";
export const PORTFOLIO = "acro.portfolio";
