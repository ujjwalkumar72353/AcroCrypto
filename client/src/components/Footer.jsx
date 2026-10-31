function Footer() {
  return (
    <footer className="border-t border-line mt-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-sm text-muted flex flex-col gap-1">
        <p>
          Market data from{" "}
          <a className="underline hover:text-ink" href="https://www.coingecko.com" target="_blank" rel="noreferrer">CoinGecko</a>,
          live ticks from Binance, sentiment from{" "}
          <a className="underline hover:text-ink" href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noreferrer">Alternative.me</a>.
        </p>
        <p>Prices can be delayed. Nothing here is financial advice.</p>
      </div>
    </footer>
  );
}

export default Footer;
