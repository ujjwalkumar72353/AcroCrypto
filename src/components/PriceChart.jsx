import { AreaSeries, ColorType, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { usePreferences } from "../lib/preferences";

const toSeries = (prices) => {
  const seen = new Set();
  return prices
    .map(([time, value]) => ({ time: Math.floor(time / 1000), value }))
    .filter(({ time }) => {
      if (seen.has(time)) return false;
      seen.add(time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
};

function PriceChart({ prices }) {
  const element = useRef(null);
  const { theme, currency } = usePreferences();

  useEffect(() => {
    const series = toSeries(prices);
    if (series.length < 2) return undefined;
    const styles = getComputedStyle(document.documentElement);
    const color = (name) => styles.getPropertyValue(name).trim();
    const rising = series[series.length - 1].value >= series[0].value;
    const stroke = color(rising ? "--up" : "--down");

    const chart = createChart(element.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color("--muted"),
        fontFamily: "JetBrains Mono Variable, monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: color("--line") },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (value) =>
          new Intl.NumberFormat(currency === "inr" ? "en-IN" : "en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
            maximumFractionDigits: value >= 1 ? 2 : 6,
          }).format(value),
      },
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: stroke,
      topColor: `${stroke}55`,
      bottomColor: `${stroke}05`,
      lineWidth: 2,
    });
    area.setData(series);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [prices, theme, currency]);

  return <div ref={element} role="img" aria-label="Price chart" className="h-80 w-full" />;
}

export default PriceChart;
