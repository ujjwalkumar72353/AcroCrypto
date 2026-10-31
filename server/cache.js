const MAX_ENTRIES = 500;

// Keeps expired values, so a failed upstream call can still serve the last good data
export const createCache = () => {
  const entries = new Map();
  const pending = new Map();

  const remember = (key, value, ttlMs) => {
    entries.delete(key);
    entries.set(key, { value, expires: Date.now() + ttlMs });
    if (entries.size > MAX_ENTRIES) {
      entries.delete(entries.keys().next().value);
    }
  };

  const load = async (key, ttlMs, fetcher) => {
    const entry = entries.get(key);
    if (entry && entry.expires > Date.now()) {
      return { value: entry.value, stale: false };
    }
    if (!pending.has(key)) {
      pending.set(
        key,
        fetcher()
          .then((value) => {
            remember(key, value, ttlMs);
            return { value, stale: false };
          })
          .catch((error) => {
            if (entry) return { value: entry.value, stale: true };
            throw error;
          })
          .finally(() => pending.delete(key))
      );
    }
    return pending.get(key);
  };

  return { load, clear: () => entries.clear() };
};
