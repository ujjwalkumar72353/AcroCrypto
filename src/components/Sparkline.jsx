const WIDTH = 120;
const HEIGHT = 36;

function Sparkline({ prices = [], label }) {
  if (prices.length < 2) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = high - low || 1;
  const points = prices
    .map((price, index) => {
      const x = (index / (prices.length - 1)) * WIDTH;
      const y = HEIGHT - 2 - ((price - low) / span) * (HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = prices[prices.length - 1] >= prices[0];
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img" aria-label={label}>
      <polyline fill="none" stroke={rising ? "var(--up)" : "var(--down)"} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default Sparkline;
