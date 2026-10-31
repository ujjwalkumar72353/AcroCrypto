import { useEffect, useState } from "react";

const STREAM = "wss://stream.binance.com:9443/ws";
const RETRY_MS = 5000;

// USD price from Binance. Coins without a USDT pair simply stay on API prices.
export const useLivePrice = (symbol) => {
  const [price, setPrice] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setPrice(null);
    setLive(false);
    if (!symbol || symbol.toLowerCase() === "usdt") return undefined;

    let socket;
    let timer;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(`${STREAM}/${symbol.toLowerCase()}usdt@miniTicker`);
      socket.onmessage = (event) => {
        const tick = JSON.parse(event.data);
        if (tick.c) {
          setPrice(Number(tick.c));
          setLive(true);
        }
      };
      socket.onclose = () => {
        setLive(false);
        if (!closed) timer = setTimeout(connect, RETRY_MS);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket.close();
    };
  }, [symbol]);

  return { price, live };
};
