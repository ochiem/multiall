// CEX registry providing unified registration + link builders
(function initCEXRegistry(global){
  const root = global || (typeof window !== 'undefined' ? window : {});

  const _registry = new Map();

  function normalizeName(name){ return String(name || '').toUpperCase(); }

  function defaultLinkBuilder(name, token, pair){
    const cex = normalizeName(name);
    const T = String(token||'').toUpperCase();
    const P = String(pair||'').toUpperCase();
    const tradeToken = (T === 'USDT') ? '#' :
      (cex==='GATE'    ? `https://www.gate.com/trade/${T}_USDT` :
       cex==='BINANCE' ? `https://www.binance.com/en/trade/${T}_USDT` :
       cex==='MEXC'    ? `https://www.mexc.com/exchange/${T}_USDT?_from=search` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/trade/${T}-USDT` :
       cex==='BITGET'  ? `https://www.bitget.com/spot/${T}USDT` :
       cex==='BYBIT'   ? `https://www.bybit.com/trade/spot/${T}/USDT` :
       cex==='INDODAX' ? `https://indodax.com/market/${T}IDR` : '#');
    const tradePair = (P === 'USDT') ? '#' :
      (cex==='GATE'    ? `https://www.gate.com/trade/${P}_USDT` :
       cex==='BINANCE' ? `https://www.binance.com/en/trade/${P}_USDT` :
       cex==='MEXC'    ? `https://www.mexc.com/exchange/${P}_USDT?_from=search` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/trade/${P}-USDT` :
       cex==='BITGET'  ? `https://www.bitget.com/spot/${P}USDT` :
       cex==='BYBIT'   ? `https://www.bybit.com/trade/spot/${P}/USDT` :
       cex==='INDODAX' ? `https://indodax.com/market/${P}IDR` : '#');
    // Build distinct DP/WD URLs for token and pair
    const withdrawTokenUrl =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/withdraw/${T}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${T}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/withdraw/${T}` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/assets/withdraw?currency=${T}` :
       cex==='BITGET'  ? `https://www.bitget.com/asset/withdraw?coin=${T}` :
       cex==='BYBIT'   ? `https://www.bybit.com/user/assets/withdraw?coin=${T}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${T}#kirim` : '#');
    const withdrawPairUrl =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/withdraw/${P}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${P}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/withdraw/${P}` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/assets/withdraw?currency=${P}` :
       cex==='BITGET'  ? `https://www.bitget.com/asset/withdraw?coin=${P}` :
       cex==='BYBIT'   ? `https://www.bybit.com/user/assets/withdraw?coin=${P}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${P}#kirim` : '#');
    const depositTokenUrl =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/deposit/${T}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${T}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/deposit/${T}` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/assets/deposit?currency=${T}` :
       cex==='BITGET'  ? `https://www.bitget.com/asset/deposit?coin=${T}` :
       cex==='BYBIT'   ? `https://www.bybit.com/user/assets/deposit?coin=${T}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${T}` : '#');
    const depositPairUrl =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/deposit/${P}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${P}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/deposit/${P}` :
       cex==='KUCOIN'  ? `https://www.kucoin.com/assets/deposit?currency=${P}` :
       cex==='BITGET'  ? `https://www.bitget.com/asset/deposit?coin=${P}` :
       cex==='BYBIT'   ? `https://www.bybit.com/user/assets/deposit?coin=${P}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${P}` : '#');
    return {
      tradeToken: tradeToken,
      tradePair: tradePair,
      // Back-compat single URLs
      withdrawUrl: withdrawTokenUrl,
      depositUrl: depositPairUrl,
      // Explicit URLs
      withdrawTokenUrl,
      depositTokenUrl,
      withdrawPairUrl,
      depositPairUrl,
    };
  }

  const CEX = {
    register(def){
      const name = normalizeName(def?.name);
      if (!name) return;
      const cfg = root.CONFIG_CEX?.[name] || {};
      const color = def?.color || cfg.WARNA || '#000';
      // Build orderbook from def or CONFIG_CEX.ORDERBOOK
      let orderbook = def?.orderbook || null; // { urlTpl: (coins)=>string, parser: fn | token }
      if (!orderbook && cfg.ORDERBOOK && typeof cfg.ORDERBOOK.urlTpl === 'function') {
        orderbook = { urlTpl: cfg.ORDERBOOK.urlTpl, parserToken: cfg.ORDERBOOK.parser };
      }
      const walletFetcher = def?.walletFetcher || null;

      // Build link builder from CONFIG_CEX.LINKS if available
      let linkBuilder = def?.linkBuilder;
      if (!linkBuilder) {
        const L = cfg.LINKS || {};
        linkBuilder = (t, p) => {
          const T = String(t||'').toUpperCase();
          const P = String(p||'').toUpperCase();
          const build = (fn, args) => {
            try { return typeof fn === 'function' ? fn(args) : null; } catch(_) { return null; }
          };
          const base = defaultLinkBuilder(name, T, P);
          const tradeToken = build(L.tradeToken, { cex: name, token: T, pair: P }) || base.tradeToken;
          const tradePair  = build(L.tradePair,  { cex: name, token: T, pair: P }) || base.tradePair;
          const withdrawTokenUrl = build(L.withdraw, { cex: name, token: T, pair: T }) || base.withdrawTokenUrl;
          const withdrawPairUrl  = build(L.withdraw, { cex: name, token: P, pair: P }) || base.withdrawPairUrl;
          const depositTokenUrl  = build(L.deposit,  { cex: name, token: T, pair: T }) || base.depositTokenUrl;
          const depositPairUrl   = build(L.deposit,  { cex: name, token: P, pair: P }) || base.depositPairUrl;
          const withdrawUrl = withdrawTokenUrl;
          const depositUrl  = depositPairUrl;
          return {
            tradeToken,
            tradePair,
            withdrawUrl,
            depositUrl,
            withdrawTokenUrl,
            depositTokenUrl,
            withdrawPairUrl,
            depositPairUrl
          };
        };
      }
      _registry.set(name, { name, color, orderbook, walletFetcher, linkBuilder });
    },
    getConfig(name){
      return _registry.get(normalizeName(name)) || null;
    },
    color(name){
      const e = this.getConfig(name);
      return (e && e.color) || (root.CONFIG_CEX?.[normalizeName(name)]?.WARNA) || '#000';
    },
    link: {
      buildAll(name, token, pair){
        const e = _registry.get(normalizeName(name));
        const b = e?.linkBuilder || ((t,p)=> defaultLinkBuilder(name, t, p));
        return b(token, pair);
      }
    },
    _all(){ return Array.from(_registry.values()); }
  };

  // Auto-register defaults from CONFIG_CEX if present
  try {
    Object.keys(root.CONFIG_CEX || {}).forEach(k => {
      CEX.register({ name: k });
    });
  } catch(_){}

  root.CEX = CEX;
})(this);
