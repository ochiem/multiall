// =================================================================================
// DEX Service Module (moved intact) — Pindahkan utuh + shim
// =================================================================================
/**
 * DEX Service Module
 * - Strategy-based price quoting per aggregator (Kyber, 1inch, 0x/Matcha, Odos, OKX)
 * - getPriceDEX builds request and parses response per DEX
 */
(function initDEXService(global){
  const root = global || (typeof window !== 'undefined' ? window : {});
  const App = root.App || (root.App = {});

  // Map HTTP status codes to concise Indonesian descriptions for UI titles
  function describeHttpStatus(code) {
    const map = {
      // 3xx
      300: 'Multiple Choices — Banyak pilihan resource',
      301: 'Moved Permanently — URL pindah permanen',
      302: 'Found — Redirect sementara',
      303: 'See Other — Redirect dengan GET',
      304: 'Not Modified — Pakai cache',
      307: 'Temporary Redirect — Redirect sementara (method sama)',
      308: 'Permanent Redirect — Redirect permanen (method sama)',
      // 4xx
      400: 'Bad Request — Format request salah',
      401: 'Unauthorized — Token/Auth diperlukan',
      402: 'Payment Required — Terkait pembayaran (jarang)',
      403: 'Forbidden — Akses dilarang',
      404: 'Not Found — Resource tidak ada',
      405: 'Method Not Allowed — Method HTTP salah',
      406: 'Not Acceptable — Format tidak didukung',
      407: 'Proxy Auth Required — Autentikasi proxy',
      408: 'Request Timeout — Permintaan terlalu lama',
      409: 'Conflict — Konflik data',
      410: 'Gone — Resource sudah dihapus',
      411: 'Length Required — Header Content-Length wajib',
      412: 'Precondition Failed — If-* gagal',
      413: 'Payload Too Large — Data terlalu besar',
      414: 'URI Too Long — URL terlalu panjang',
      415: 'Unsupported Media Type — Format tidak didukung',
      416: 'Range Not Satisfiable — Range request salah',
      417: 'Expectation Failed — Header Expect gagal',
      421: 'Misdirected Request — Server tujuan salah',
      422: 'Unprocessable Entity — Validasi gagal',
      423: 'Locked — Resource terkunci',
      424: 'Failed Dependency — Ketergantungan gagal',
      425: 'Too Early — Terlalu cepat',
      426: 'Upgrade Required — Wajib upgrade protokol',
      428: 'Precondition Required — Butuh precondition',
      429: 'Too Many Requests — Rate limiting',
      431: 'Header Fields Too Large — Header terlalu besar',
      451: 'Unavailable For Legal Reasons — Diblokir secara legal',
      // 5xx
      500: 'Internal Server Error — Error di sisi server',
      501: 'Not Implemented — Endpoint belum tersedia',
      502: 'Bad Gateway — Kesalahan di gateway/proxy',
      503: 'Service Unavailable — Server sibuk/maintenance',
      504: 'Gateway Timeout — Timeout di server/gateway',
      505: 'HTTP Version Not Supported — Versi tidak didukung',
      507: 'Insufficient Storage — Server kehabisan ruang',
      508: 'Loop Detected — Loop di server',
      510: 'Not Extended — Butuh extension tambahan',
      511: 'Network Auth Required — Login ke jaringan',
    };
    return map[Number(code)] || `HTTP ${code} — Error dari server`;
  }

  // Helper: Calculate gas fee in USD with custom gas price override
  function calculateGasFeeUSD(chainName, gasEstimate, gasPriceGwei) {
    try {
      // Get gas price data from localStorage
      const allGasData = (typeof getFromLocalStorage === 'function')
        ? getFromLocalStorage("ALL_GAS_FEES")
        : null;

      if (!allGasData) return 0;

      // Find gas info for this chain
      const gasInfo = allGasData.find(g =>
        String(g.chain || '').toLowerCase() === String(chainName || '').toLowerCase()
      );

      if (!gasInfo || !gasInfo.nativeTokenPrice) return 0;

      // Get chain config for gas limit
      const chainConfig = (typeof root.CONFIG_CHAINS !== 'undefined')
        ? root.CONFIG_CHAINS[String(chainName || '').toLowerCase()]
        : null;

      const gasLimit = gasEstimate || (chainConfig ? chainConfig.GASLIMIT : 80000);

      // Calculate fee: gasLimit * gasPriceGwei * nativeTokenPrice / 1e9
      const feeUSD = (gasLimit * gasPriceGwei * gasInfo.nativeTokenPrice) / 1e9;

      return Number.isFinite(feeUSD) && feeUSD > 0 ? feeUSD : 0;
    } catch(e) {
      // console.error('[DEX] Error calculating gas fee:', e);
      return 0;
    }
  }

  // Helper: Get default swap fee from utils.js (fallback)
  function getFeeSwap(chainName) {
    if (typeof root.getFeeSwap === 'function') {
      return root.getFeeSwap(chainName);
    }
    // Fallback if getFeeSwap not available
    return 0;
  }

  const dexStrategies = {
    kyber: {
      buildRequest: ({ chainName, sc_input, sc_output, amount_in_big }) => {
        const kyberUrl = `https://aggregator-api.kyberswap.com/${chainName.toLowerCase()}/api/v1/routes?tokenIn=${sc_input}&tokenOut=${sc_output}&amountIn=${amount_in_big}&gasInclude=true`;
        return { url: kyberUrl, method: 'GET' };
      },
      parseResponse: (response, { des_output, chainName }) => {
        if (!response?.data?.routeSummary) throw new Error("Invalid KyberSwap response structure");
        return {
          amount_out: response.data.routeSummary.amountOut / Math.pow(10, des_output),
          FeeSwap: parseFloat(response.data.routeSummary.gasUsd) || getFeeSwap(chainName),
          dexTitle: 'KYBER'
        };
      }
    },
    // '1inch': {
    //   buildRequest: ({ codeChain, sc_input, sc_output, amount_in_big }) => {
    //     const baseUrl = 'https://api.1inch.dev/swap/v6.0';
    //     const chainId = codeChain;
    //     const url = `${baseUrl}/${chainId}/quote`;
    //     const params = new URLSearchParams({
    //       src: sc_input,
    //       dst: sc_output,
    //       amount: amount_in_big.toString()
    //     });
    //     return {
    //       url: `${url}?${params.toString()}`,
    //       method: 'GET'
    //     };
    //   },
    //   parseResponse: (response, { des_output, chainName }) => {
    //     if (!response?.dstAmount) throw new Error("1inch dstAmount not found in response");
    //     const amount_out = parseFloat(response.dstAmount) / Math.pow(10, des_output);
    //     const FeeSwap = getFeeSwap(chainName);
    //     return { amount_out, FeeSwap, dexTitle: '1INCH' };
    //   }
    // },
    paraswap5: {
      buildRequest: ({ codeChain, sc_input, sc_output, amount_in_big, des_input, des_output }) => {
        const params = new URLSearchParams({
          network: String(codeChain || ''),
          srcToken: sc_input,
          destToken: sc_output,
          amount: amount_in_big.toString(),
          side: 'SELL',
          srcDecimals: String(des_input),
          destDecimals: String(des_output),
          partner: 'paraswap.io'
        });
        return {
          url: `https://apiv5.paraswap.io/prices/?${params.toString()}`,
          method: 'GET'
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const route = response?.priceRoute;
        const destAmountStr = route?.destAmount;
        if (!destAmountStr) throw new Error('Invalid ParaSwap response');
        const destAmountNum = parseFloat(destAmountStr);
        if (!Number.isFinite(destAmountNum) || destAmountNum <= 0) throw new Error('Invalid ParaSwap dest amount');
        const amount_out = destAmountNum / Math.pow(10, des_output);
        const gasUsd = parseFloat(route.gasCostUSD || route.estimatedGasCostUSD || response?.gasCostUSD || 0);
        const FeeSwap = (Number.isFinite(gasUsd) && gasUsd > 0) ? gasUsd : getFeeSwap(chainName);
        return { amount_out, FeeSwap, dexTitle: 'PARASWAP' };
      },
      useProxy: false
    },
    paraswap6: {
      buildRequest: ({ codeChain, sc_input, sc_output, amount_in_big, des_input, des_output, SavedSettingData }) => {
        const userAddr = SavedSettingData?.walletMeta || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
          version: '6.2',
          network: String(codeChain || ''),
          srcToken: sc_input,
          destToken: sc_output,
          amount: amount_in_big.toString(),
          side: 'SELL',
          srcDecimals: String(des_input),
          destDecimals: String(des_output),
          otherExchangePrices: 'true',
          partner: 'paraswap.io',
          userAddress: userAddr
        });
        return {
          url: `https://api.paraswap.io/prices/?${params.toString()}`,
          method: 'GET'
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const route = response?.priceRoute;
        const destAmountStr = route?.destAmount;
        if (!destAmountStr) throw new Error('Invalid ParaSwap v6 response');
        const destAmountNum = parseFloat(destAmountStr);
        if (!Number.isFinite(destAmountNum) || destAmountNum <= 0) throw new Error('Invalid ParaSwap v6 dest amount');
        const amount_out = destAmountNum / Math.pow(10, des_output);
        const gasUsd = parseFloat(route.gasCostUSD || route.estimatedGasCostUSD || response?.gasCostUSD || 0);
        const FeeSwap = (Number.isFinite(gasUsd) && gasUsd > 0) ? gasUsd : getFeeSwap(chainName);
        return {
          amount_out,
          FeeSwap,
          dexTitle: 'PARASWAP',
          routeTool: 'PARASWAP V6'
        };
      },
      useProxy: false
    },
    'hinkal-odos': {
      // Hinkal ODOS proxy (pair-to-token per permintaan)
      buildRequest: ({ codeChain, SavedSettingData, amount_in_big, sc_input, sc_output }) => {
        const url = 'https://ethmainnet.server.hinkal.pro/OdosSwapData';
        return {
          url,
          method: 'POST',
          data: JSON.stringify({
            chainId: codeChain,
            inputTokens: [{ amount: amount_in_big.toString(), tokenAddress: sc_input }],
            outputTokens: [{ proportion: 1, tokenAddress: sc_output }],
            userAddr: SavedSettingData.walletMeta,
            slippageLimitPercent: 0.3,
            sourceBlacklist: [],
            sourceWhitelist: [],
            simulate: false,
            referralCode: 0
          })
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        // Gunakan jumlah output mentah (wei) dari outputTokens; outValues adalah nilai (USD) dan tidak dipakai untuk unit token
        const outRawStr = response?.odosResponse?.outputTokens?.[0]?.amount;
        if (!outRawStr) throw new Error('Invalid Hinkal ODOS out amount');
        const outRaw = parseFloat(outRawStr);
        if (!Number.isFinite(outRaw) || outRaw <= 0) throw new Error('Invalid Hinkal ODOS out amount');
        const amount_out = outRaw / Math.pow(10, des_output);
        const feeUsd = parseFloat(response?.odosResponse?.gasEstimateValue || response?.gasEstimateValue || 0);
        const FeeSwap = (Number.isFinite(feeUsd) && feeUsd > 0) ? feeUsd : getFeeSwap(chainName);
        return { amount_out, FeeSwap, dexTitle: 'ODOS' };
      },
      useProxy: false
    },
    // fly: {
    //   buildRequest: ({ chainName, sc_input, sc_output, amount_in_big, SavedSettingData }) => {
    //     const net = String(chainName || '').toLowerCase();
    //     const user = SavedSettingData.walletMeta || '0x0000000000000000000000000000000000000000';
    //     const url = `https://api.fly.trade/aggregator/quote?network=${net}&fromTokenAddress=${sc_input}&toTokenAddress=${sc_output}&fromAddress=${user}&toAddress=${user}&sellAmount=${String(amount_in_big)}&slippage=0.005&gasless=false`;
    //     return { url, method: 'GET' };
    //   },
    //   parseResponse: (response, { chainName, des_output }) => {
    //     const rawOut = response?.amountOut;
    //     const outNum = parseFloat(rawOut);
    //     if (!Number.isFinite(outNum) || outNum <= 0) throw new Error('Invalid FlyTrade amountOut');
    //     // Normalisasi ke unit token keluaran (selaras strategi lain)
    //     const amount_out = outNum / Math.pow(10, des_output);
    //     const feeDex = parseFloat(response?.fees?.[0]?.value || 0);
    //     const FeeSwap = (Number.isFinite(feeDex) && feeDex > 0) ? feeDex : getFeeSwap(chainName);
    //     // Use canonical display title matching app DEX key to avoid id mismatches elsewhere
    //     return { amount_out, FeeSwap, dexTitle: 'FLY' };
    //   }
    // },
    // ZeroSwap aggregator untuk 1inch
    'zero-1inch': {
      buildRequest: ({ sc_input, sc_output, amount_in_big, des_input, des_output, codeChain }) => {
        const baseUrl = 'https://api.zeroswap.io/quote/1inch';
        const params = new URLSearchParams({
          fromChain: codeChain,
          fromTokenAddress: sc_input,
          toTokenAddress: sc_output,
          fromTokenDecimals: des_input,
          toTokenDecimals: des_output,
          sellAmount: String(amount_in_big),
          slippage: '0.1'
        });
        return { url: `${baseUrl}?${params.toString()}`, method: 'GET' };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const q = response?.quote;
        const buyAmount = q?.estimation?.buyAmount;
        if (!buyAmount) throw new Error('Invalid ZeroSwap 1inch response');
        const amount_out = parseFloat(buyAmount) / Math.pow(10, des_output);
        const FeeSwap = getFeeSwap(chainName);
        return { amount_out, FeeSwap, dexTitle: '1INCH', routeTool: 'ZeroSwap' };
      }
    },
    // // Backward compatibility alias
    'zero': {
      buildRequest: (...args) => dexStrategies['zero-1inch'].buildRequest(...args),
      parseResponse: (...args) => dexStrategies['zero-1inch'].parseResponse(...args)
    },    
    // Hinkal proxy untuk 1inch (privacy-focused)
    'hinkal-1inch': {
      buildRequest: ({ sc_input, sc_output, amount_in_big, SavedSettingData, codeChain }) => {
        const userAddr = SavedSettingData?.walletMeta || '0x0000000000000000000000000000000000000000';
        const apiUrl = 'https://ethmainnet.server.hinkal.pro/OneInchSwapData';

        // Build 1inch API URL with dynamic chainId
        const chainId = codeChain || 1; // default to Ethereum mainnet
        const requestData = {
          url: `https://api.1inch.dev/swap/v5.2/${chainId}/swap?` +
            `fromTokenAddress=${sc_input}` +
            `&toTokenAddress=${sc_output}` +
            `&amount=${amount_in_big}` +
            `&fromAddress=${userAddr}` +
            `&slippage=10` +
            `&destReceiver=${userAddr}` +
            `&disableEstimate=true`
        };

        return {
          url: apiUrl,
          method: 'POST',
          data: JSON.stringify(requestData),
          headers: { 'Content-Type': 'application/json' }
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const outAmount = response?.oneInchResponse?.toAmount;
        if (!outAmount || parseFloat(outAmount) <= 0) {
          throw new Error('Invalid Hinkal 1inch response');
        }

        const amount_out = parseFloat(outAmount) / Math.pow(10, des_output);

        // Gas estimate with fallback
        let gasEstimate = parseFloat(response?.oneInchResponse?.tx?.gas || 0);
        if (!gasEstimate || gasEstimate === 0) gasEstimate = 350000;

        // Override gas price to 0.1 Gwei for privacy calculation
        const gweiOverride = 0.1;
        const FeeSwap = calculateGasFeeUSD(chainName, gasEstimate, gweiOverride);

        return {
          amount_out,
          FeeSwap,
          dexTitle: '1INCH',
          routeTool: 'Hinkal Privacy',
          gasEstimate,
          gasPrice: gweiOverride
        };
      }
    },
    // Alias untuk hinkal-1inch
    'hinkal': {
        buildRequest: (...args) => dexStrategies['hinkal-1inch'].buildRequest(...args),
        parseResponse: (...args) => dexStrategies['hinkal-1inch'].parseResponse(...args)
    },
    'zero-kyber': {
      buildRequest: ({ sc_input, sc_output, amount_in_big, des_input, des_output, codeChain }) => {
        const baseUrl = 'https://api.zeroswap.io/quote/kyberswap';
        const params = new URLSearchParams({
          fromChain: codeChain,
          fromTokenAddress: sc_input,
          toTokenAddress: sc_output,
          fromTokenDecimals: des_input,
          toTokenDecimals: des_output,
          sellAmount: String(amount_in_big),
          slippage: '0.1'
        });
        return { url: `${baseUrl}?${params.toString()}`, method: 'GET' };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const q = response?.quote;
        const buyAmount = q?.estimation?.buyAmount;
        if (!buyAmount) throw new Error('Invalid ZeroSwap Kyber response');
        const amount_out = parseFloat(buyAmount) / Math.pow(10, des_output);
        const FeeSwap = getFeeSwap(chainName);
        return { amount_out, FeeSwap, dexTitle: 'KYBER' };
      }
    },
    '0x': {
      buildRequest: ({ chainName, sc_input_in, sc_output_in, amount_in_big, codeChain, sc_output, sc_input, SavedSettingData }) => {
        const userAddr = SavedSettingData?.walletMeta || '0x0000000000000000000000000000000000000000';
        const url = chainName.toLowerCase() === 'solana'
          ? `https://matcha.xyz/api/swap/quote/solana?sellTokenAddress=${sc_input_in}&buyTokenAddress=${sc_output_in}&sellAmount=${amount_in_big}&dynamicSlippage=true&slippageBps=50&userPublicKey=Eo6CpSc1ViboPva7NZ1YuxUnDCgqnFDXzcDMDAF6YJ1L`
          : `https://matcha.xyz/api/swap/price?chainId=${codeChain}&buyToken=${sc_output}&sellToken=${sc_input}&sellAmount=${amount_in_big}&takerAddress=${userAddr}`;
        return { url, method: 'GET' };
      },
      parseResponse: (response, { des_output, chainName }) => {
        if (!response?.buyAmount) throw new Error("Invalid 0x response structure");
        return {
          amount_out: response.buyAmount / Math.pow(10, des_output),
          FeeSwap: getFeeSwap(chainName),
          dexTitle: '0X'
        };
      }
    },
    okx: {
      buildRequest: ({ amount_in_big, codeChain, sc_input_in, sc_output_in }) => {
        const selectedApiKey = getRandomApiKeyOKX(apiKeysOKXDEX);
        const timestamp = new Date().toISOString();
        const path = "/api/v5/dex/aggregator/quote";
        const queryParams = `amount=${amount_in_big}&chainIndex=${codeChain}&fromTokenAddress=${sc_input_in}&toTokenAddress=${sc_output_in}`;
        const dataToSign = timestamp + "GET" + path + "?" + queryParams;
        const signature = calculateSignature("OKX", selectedApiKey.secretKeyOKX, dataToSign);
        return {
          url: `https://web3.okx.com${path}?${queryParams}`,
          method: 'GET',
          headers: { "OK-ACCESS-KEY": selectedApiKey.ApiKeyOKX, "OK-ACCESS-SIGN": signature, "OK-ACCESS-PASSPHRASE": selectedApiKey.PassphraseOKX, "OK-ACCESS-TIMESTAMP": timestamp, "Content-Type": "application/json" }
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        if (!response?.data?.[0]?.toTokenAmount) throw new Error("Invalid OKX response structure");
        return {
          amount_out: response.data[0].toTokenAmount / Math.pow(10, des_output),
          FeeSwap: getFeeSwap(chainName),
          dexTitle: 'OKX'
        };
      }
    },
  };
  function createOdosStrategy(version){
    const endpoint = `https://api.odos.xyz/sor/quote/${version}`;
    return {
      buildRequest: ({ codeChain, SavedSettingData, amount_in_big, sc_input, sc_output }) => {
        const wallet = SavedSettingData?.walletMeta || '0x0000000000000000000000000000000000000000';
        return {
          url: endpoint,
          method: 'POST',
          data: JSON.stringify({
            chainId: codeChain,
            compact: true,
            disableRFQs: true,
            userAddr: wallet,
            inputTokens: [{ amount: amount_in_big.toString(), tokenAddress: sc_input }],
            outputTokens: [{ proportion: 1, tokenAddress: sc_output }],
            slippageLimitPercent: 0.3
          })
        };
      },
      parseResponse: (response, { des_output, chainName }) => {
        const rawOut = Array.isArray(response?.outAmounts) ? response.outAmounts[0] : response?.outAmounts;
        if (!rawOut) throw new Error("Invalid Odos response structure");
        const outNum = parseFloat(rawOut);
        if (!Number.isFinite(outNum) || outNum <= 0) throw new Error("Invalid Odos output amount");
        const gasEstimate = parseFloat(response?.gasEstimateValue || response?.gasFeeUsd || response?.gasEstimateUSD || 0);
        const FeeSwap = (Number.isFinite(gasEstimate) && gasEstimate > 0) ? gasEstimate : getFeeSwap(chainName);
        return {
          amount_out: outNum / Math.pow(10, des_output),
          FeeSwap,
          dexTitle: 'ODOS'
        };
      }
    };
  }
  dexStrategies.odos2 = createOdosStrategy('v2');
  dexStrategies.odos3 = createOdosStrategy('v3');
  dexStrategies.odos = dexStrategies.odos3;
  // Back-compat alias: support legacy 'kyberswap' key
  dexStrategies.kyberswap = dexStrategies.kyber;
  dexStrategies.paraswap5 = dexStrategies.paraswap;
  dexStrategies.paraswap = dexStrategies.paraswap6;
  // Alias untuk Matcha (0x)
  dexStrategies.matcha = dexStrategies['0x'];

  // -----------------------------
  // Helper: resolve fetch plan per DEX + arah
  // -----------------------------
  function actionKey(a){ return String(a||'').toLowerCase() === 'pairtotoken' ? 'pairtotoken' : 'tokentopair'; }
  function resolveFetchPlan(dexType, action){
    try {
      const key = String(dexType||'').toLowerCase();
      const cfg = (root.CONFIG_DEXS || {})[key] || {};
      const map = cfg.fetchdex || {};
      const ak = actionKey(action);
      const primary = map.primary && map.primary[ak] ? String(map.primary[ak]).toLowerCase() : null;
      const alternative = map.alternative && map.alternative[ak] ? String(map.alternative[ak]).toLowerCase() : null;
      return { primary, alternative };
    } catch(_){ return { primary: null, alternative: null }; }
  }

  /**
   * Quote swap output from a DEX aggregator.
   * Builds request by strategy, applies timeout, and returns parsed amounts.
   */
  function getPriceDEX(sc_input_in, des_input, sc_output_in, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, chainName, codeChain, action, tableBodyId) {
    return new Promise((resolve, reject) => {
      const sc_input = sc_input_in.toLowerCase();
      const sc_output = sc_output_in.toLowerCase();
      const SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
      const timeoutMilliseconds = Math.max(Math.round((SavedSettingData.speedScan || 4) * 1000));
      const amount_in_big = BigInt(Math.round(Math.pow(10, des_input) * amount_in));

      const runStrategy = (strategyName) => new Promise((res, rej) => {
        try {
          const sname = String(strategyName || '').toLowerCase();
          if (sname === 'swoop' || sname === 'dzap') {
            const force = sname; // paksa jenis fallback khusus
            getPriceAltDEX(sc_input, des_input, sc_output, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, chainName, codeChain, action, { force })
              .then(res)
              .catch(rej);
            return;
          }

          // Resolve dari registry jika ada STRATEGY override
          let sKey = sname;
          try {
            if (root.DEX && typeof root.DEX.get === 'function') {
              const entry = root.DEX.get(dexType);
              if (entry && entry.strategy) sKey = String(entry.strategy).toLowerCase();
            }
          } catch(_) {}

          const strategy = dexStrategies[sKey];
          if (!strategy) return rej(new Error(`Unsupported strategy: ${sKey}`));

          const requestParams = { chainName, sc_input, sc_output, amount_in_big, des_output, SavedSettingData, codeChain, action, des_input, sc_input_in, sc_output_in };
          const { url, method, data, headers } = strategy.buildRequest(requestParams);

          // Apply proxy if configured for this DEX
          const cfg = (typeof DEX !== 'undefined' && DEX.get) ? (DEX.get(dexType) || {}) : {};
          const strategyAllowsProxy = strategy?.useProxy !== false;
          const useProxy = !!cfg.proxy && strategyAllowsProxy;
          const proxyPrefix = (root.CONFIG_PROXY && root.CONFIG_PROXY.PREFIX) ? String(root.CONFIG_PROXY.PREFIX) : '';
          const finalUrl = (useProxy && proxyPrefix && typeof url === 'string' && !url.startsWith(proxyPrefix)) ? (proxyPrefix + url) : url;

          $.ajax({
            url: finalUrl, method, dataType: 'json', timeout: timeoutMilliseconds, headers, data,
            contentType: data ? 'application/json' : undefined,
            success: function (response) {
              try {
                const { amount_out, FeeSwap, dexTitle } = strategy.parseResponse(response, requestParams);
                res({ dexTitle, sc_input, des_input, sc_output, des_output, FeeSwap, amount_out, apiUrl: url, tableBodyId });
              } catch (error) {
                rej({ statusCode: 500, pesanDEX: `Parse Error: ${error.message}`, DEX: sKey.toUpperCase() });
              }
            },
            error: function (xhr, textStatus) {
              let status = 0;
              try { status = Number(xhr && xhr.status) || 0; } catch(_) {}
              // Heuristik: jika body JSON menyimpan status upstream (mis. 429) walau XHR 200/parsererror
              try {
                const txt = xhr && xhr.responseText;
                if (txt && typeof txt === 'string' && txt.length) {
                  try {
                    const parsed = JSON.parse(txt);
                    const upstream = Number(parsed.status || parsed.statusCode || parsed.code);
                    if (Number.isFinite(upstream) && upstream >= 400) status = upstream;
                  } catch(_) {}
                }
              } catch(_) {}
              const isParser = String(textStatus||'').toLowerCase() === 'parsererror';
              let coreMsg;
              if (textStatus === 'timeout') coreMsg = 'Request Timeout';
              else if (status === 200) coreMsg = isParser ? 'Parser Error (200)' : 'XHR Error (200)';
              else if (status > 0) coreMsg = describeHttpStatus(status);
              else coreMsg = `Error: ${textStatus||'unknown'}`;

              const label = status > 0 ? (status === 200 ? '[XHR ERROR 200]' : `[HTTP ${status}]`) : '';
              // FIX: Swap token & pair address untuk arah PairtoToken (DEX→CEX)
              const isPairtoToken = String(action || '').toLowerCase() === 'pairtotoken';
              const tokenAddr = isPairtoToken ? sc_output_in : sc_input_in;
              const pairAddr = isPairtoToken ? sc_input_in : sc_output_in;
              const linkDEX = generateDexLink(dexType, chainName, codeChain, NameToken, tokenAddr, NamePair, pairAddr);
              rej({ statusCode: status, pesanDEX: `${String(sKey||'').toUpperCase()}: ${label} ${coreMsg}` , DEX: String(sKey||'').toUpperCase(), dexURL: linkDEX, textStatus });
            },
          });
        } catch (error) {
          rej({ statusCode: 500, pesanDEX: `Request Build Error: ${error.message}`, DEX: String(strategyName||'').toUpperCase() });
        }
      });

      const plan = resolveFetchPlan(dexType, action);
      const primary = plan.primary || String(dexType||'').toLowerCase();
      const alternative = plan.alternative || null;

      runStrategy(primary)
        .then(resolve)
        .catch((e1) => {
          const code = Number(e1 && e1.statusCode);
          const primaryKey = String(primary || '').toLowerCase();
          // Treat ODOS variants + Hinkal proxy sebagai satu keluarga
          const isOdosFamily = ['odos','odos2','odos3','hinkal'].includes(primaryKey);
          const noResp = !Number.isFinite(code) || code === 0;
          const isNoRespFallback = noResp && (isOdosFamily || primaryKey === 'kyber' || primaryKey === '1inch');
          const computedAlt = alternative;
          // Fallback hanya untuk:
          // 1. Rate limit (429)
          // 2. Server error (500+)
          // 3. No response (timeout/network error)
          const shouldFallback = computedAlt && (
            (Number.isFinite(code) && (code === 429 || code >= 500)) || // Rate limit atau server error
            isNoRespFallback // Atau no response (timeout/network error)
          );
          if (!shouldFallback) return reject(e1);
          runStrategy(computedAlt)
            .then(resolve)
            .catch((e2) => reject(e2));
        });
    });
  }

  /**
   * Optional fallback quoting via external SWOOP service.
   */
  function getPriceAltDEX(sc_input, des_input, sc_output, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, nameChain, codeChain, action, options) {
    // Default fallback policy: SWOOP atau DZAP sesuai config DEX
    const force = options && options.force ? String(options.force).toLowerCase() : null; // 'swoop' | 'dzap' | null

    // untuk okx,0x,kyber,paraswap,odos gunakan fallback SWOOP
    function fallbackSWOOP(){
      return new Promise((resolve, reject) => {
        const dexLower = String(dexType || '').toLowerCase();
        const slugMap = {
          'odos': 'odos',
          'kyber': 'kyberswap',
          'paraswap': 'paraswap',
          '0x': '0x',
          'okx': 'okx'
        };
        const aggregatorSlug = slugMap[dexLower] || dexLower;

        const SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
        const payload = {
          chainId: codeChain, aggregatorSlug: aggregatorSlug, sender: SavedSettingData.walletMeta,
          inToken: { chainId: codeChain, type: 'TOKEN', address: sc_input.toLowerCase(), decimals: parseFloat(des_input) },
          outToken: { chainId: codeChain, type: 'TOKEN', address: sc_output.toLowerCase(), decimals: parseFloat(des_output) },
          amountInWei: String(BigInt(Math.round(Number(amount_in) * Math.pow(10, des_input)))),
          slippageBps: '100', gasPriceGwei: Number(getFromLocalStorage('gasGWEI', 0)),
        };
        $.ajax({
          url: 'https://bzvwrjfhuefn.up.railway.app/swap', // Endpoint SWOOP
          type: 'POST', contentType: 'application/json', data: JSON.stringify(payload),
          success: function (response) {
            if (!response || !response.amountOutWei) return reject({ pesanDEX: 'SWOOP response invalid' });
            const amount_out = parseFloat(response.amountOutWei) / Math.pow(10, des_output);
            const FeeSwap = getFeeSwap(nameChain);
            resolve({ dexTitle: dexType, sc_input, des_input, sc_output, des_output, FeeSwap, dex: dexType, amount_out });
          },
          error: function (xhr, textStatus) {
            let status = 0; try { status = Number(xhr && xhr.status) || 0; } catch(_) {}
            try {
              const txt = xhr && xhr.responseText;
              if (txt && typeof txt === 'string' && txt.length) {
                try {
                  const parsed = JSON.parse(txt);
                  const upstream = Number(parsed.status || parsed.statusCode || parsed.code);
                  if (Number.isFinite(upstream) && upstream >= 400) status = upstream;
                } catch(_) {}
              }
            } catch(_) {}
            const isParser = String(textStatus||'').toLowerCase() === 'parsererror';
            let coreMsg;
            if (textStatus === 'timeout') coreMsg = 'Request Timeout';
            else if (status === 200) coreMsg = isParser ? 'Parser Error (200)' : 'XHR Error (200)';
            else if (status > 0) coreMsg = describeHttpStatus(status);
            else coreMsg = `Error: ${textStatus||'unknown'}`;
            const prefix = status > 0 ? (status === 200 ? '[XHR ERROR 200]' : `[HTTP ${status}]`) : '';
            const isDark = (typeof window !== 'undefined' && window.isDarkMode && window.isDarkMode()) || (typeof document !== 'undefined' && document.body && document.body.classList.contains('dark-mode'));
            const errColor = isDark ? '#7e3636' : '#ffcccc';
            reject({ statusCode: status, pesanDEX: `SWOOP: ${prefix} ${coreMsg}`, color: errColor, DEX: dexType.toUpperCase(), textStatus });
          }
        });
      });
    }

    // untuk okx,zerox(0x),kyber,paraswap,odos gunakan fallback DZAP
    function fallbackDZAP(){
      return new Promise((resolve, reject) => {
        const SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
        const fromAmount = String(BigInt(Math.round(Number(amount_in) * Math.pow(10, des_input))));
        const dexLower = String(dexType || '').toLowerCase();
        const exchangeMap = {
          '0x': 'zerox',         // Sesuai respons DZAP
          'matcha': 'zerox',      // Alias untuk 0x
          'kyber': 'kyberSwap',   // Sesuai respons DZAP
          'kyberswap': 'kyberSwap', // Alias untuk kyber
          '1inch': '1inch',
          'odos': 'odos',
          'odos2': 'odos',
          'odos3': 'odos',
          'okx': 'okx',
          'paraswap': 'paraSwap' // Sesuai respons DZAP
        };
        const displayMap = {
          '0x': '0X',
          'kyber': 'KYBER',
          'kyberswap': 'KYBER',
          '1inch': '1INCH',
          'odos': 'ODOS',
          'odos2': 'ODOS',
          'odos3': 'ODOS',
          'okx': 'OKX',
          'paraswap': 'PARASWAP',
          'fly': 'FLY'
        };
        const exchangeSlug = exchangeMap[dexLower] || dexLower;
        const displayTitle = displayMap[dexLower] || dexLower.toUpperCase();

        // Format request body baru sesuai dengan contoh yang diberikan
        const body = {
          fromChain: Number(codeChain),
          data: [{
            amount: fromAmount,
            destDecimals: Number(des_output),
            destToken: sc_output.toLowerCase(),
            slippage: 0.3, // Nilai slippage default
            srcDecimals: Number(des_input),
            srcToken: sc_input.toLowerCase(),
            toChain: Number(codeChain)
          }],
          integratorId: 'dzap', // Sesuai contoh
          gasless: false
        };

        $.ajax({
          url: 'https://api.dzap.io/v1/quotes', // Endpoint tetap sama, hanya body yang berubah
          method: 'POST',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify(body),
          success: function(response){
            // Struktur respons Dzap bersarang dan memiliki key dinamis.
            const responseKey = Object.keys(response || {})[0];
            const quoteData = response?.[responseKey];
            const quoteRates = quoteData?.quoteRates;

            // Manual console log untuk respons dari provider DEX utama di Dzap
            // if (quoteRates && quoteRates[exchangeSlug]) {
            //   console.log(`[DZAP ALT RESPONSE for ${exchangeSlug.toUpperCase()}]`, quoteRates[exchangeSlug]);
            // } else {
            //   console.log(`[DZAP ALT RESPONSE] (Provider for ${exchangeSlug.toUpperCase()} not found, showing full response)`, response);
            // }

            if (!quoteRates || Object.keys(quoteRates).length === 0) {
              return reject({ pesanDEX: 'DZAP quote rates not found' });
            }

            // 1. Coba dapatkan quote dari provider yang sesuai dengan DEX utama (exchangeSlug).
            let targetQuote = quoteRates[exchangeSlug];

            // 2. Jika tidak ada, ambil quote pertama yang tersedia sebagai fallback.
            if (!targetQuote) {
              const firstProviderKey = Object.keys(quoteRates)[0];
              targetQuote = quoteRates[firstProviderKey];
            }

            if (!targetQuote || !targetQuote.destAmount) return reject({ pesanDEX: 'DZAP valid quote not found' });

            const amount_out = parseFloat(targetQuote.destAmount) / Math.pow(10, des_output);
            const feeUsd = parseFloat(targetQuote.fee?.gasFee?.[0]?.amountUSD || 0);
            const FeeSwap = (Number.isFinite(feeUsd) && feeUsd > 0) ? feeUsd : getFeeSwap(nameChain);
            // Gunakan ID provider dari Dzap sebagai routeTool untuk ditampilkan di UI (VIA ...)
            const rawTool = targetQuote.providerDetails?.id || exchangeSlug || 'dzap';

            resolve({
              dexTitle: displayTitle,
              sc_input, des_input, sc_output, des_output,
              FeeSwap, dex: dexType, amount_out,
              routeTool: String(rawTool).toUpperCase()
            });
          },
          error: function(xhr, textStatus){
            let status = 0; try { status = Number(xhr && xhr.status) || 0; } catch(_) {}
            try {
              const txt = xhr && xhr.responseText;
              if (txt && typeof txt === 'string' && txt.length) {
                try {
                  const parsed = JSON.parse(txt);
                  const upstream = Number(parsed.status || parsed.statusCode || parsed.code);
                  if (Number.isFinite(upstream) && upstream >= 400) status = upstream;
                } catch(_) {}
              }
            } catch(_) {}
            const isParser = String(textStatus||'').toLowerCase() === 'parsererror';
            let coreMsg;
            if (textStatus === 'timeout') coreMsg = 'Request Timeout';
            else if (status === 200) coreMsg = isParser ? 'Parser Error (200)' : 'XHR Error (200)';
            else if (status > 0) coreMsg = describeHttpStatus(status);
            else coreMsg = `Error: ${textStatus||'unknown'}`;
            const prefix = status > 0 ? (status === 200 ? '[XHR ERROR 200]' : `[HTTP ${status}]`) : '';
            const isDark = (typeof window !== 'undefined' && window.isDarkMode && window.isDarkMode()) || (typeof document !== 'undefined' && document.body && document.body.classList.contains('dark-mode'));
            const errColor = isDark ? '#7e3636' : '#ffcccc';
            reject({ statusCode: status, pesanDEX: `DZAP: ${prefix} ${coreMsg}`, color: errColor, DEX: dexType.toUpperCase(), textStatus });
          }
        });
      });
    }

    // Pilih fallback berdasarkan parameter 'force'
    if (force === 'dzap') {
      return fallbackDZAP();
    }
    // Default fallback adalah swoop jika tidak ada 'force' atau 'force' bukan 'dzap'
    return fallbackSWOOP();
  }

  if (typeof App.register === 'function') {
    App.register('Services', { DEX: { dexStrategies, getPriceDEX, getPriceAltDEX } });
  }

  // Lightweight DEX registry for link builders and policy
  (function initDexRegistry(){
    const REG = new Map();
    // Alias mapping untuk normalize nama DEX yang berbeda
    const ALIASES = {
      'kyberswap': 'kyber',
      'matcha': '0x',
      '1inch': '1inch',
      'odos2': 'odos',
      'odos3': 'odos',
      'hinkal': 'odos',
      'okxdex': 'okx'
    };
    function norm(n){
      const lower = String(n||'').toLowerCase();
      return ALIASES[lower] || lower;
    }
    const DexAPI = {
      register(name, def){
        const key = norm(name);
        if (!key) return;
        const entry = {
          builder: def?.builder,
          allowFallback: !!def?.allowFallback,
          strategy: def?.strategy || null,
          proxy: !!def?.proxy,
        };
        REG.set(key, entry);
        // keep CONFIG_DEXS in sync for existing callers
        root.CONFIG_DEXS = root.CONFIG_DEXS || {};
        root.CONFIG_DEXS[key] = root.CONFIG_DEXS[key] || {};
        if (typeof entry.builder === 'function') root.CONFIG_DEXS[key].builder = entry.builder;
        if ('allowFallback' in entry) root.CONFIG_DEXS[key].allowFallback = entry.allowFallback;
        if ('proxy' in entry) root.CONFIG_DEXS[key].proxy = entry.proxy;
      },
      get(name){ return REG.get(norm(name)) || null; },
      list(){ return Array.from(REG.keys()); },
      normalize(name){ return norm(name); }
    };

    // Seed from existing CONFIG_DEXS if present (builder, allowFallback, strategy)
    try {
      Object.keys(root.CONFIG_DEXS || {}).forEach(k => {
        const d = root.CONFIG_DEXS[k] || {};
        DexAPI.register(k, { builder: d.builder, allowFallback: !!d.allowFallback, strategy: d.STRATEGY || null, proxy: !!d.proxy });
      });
    } catch(_){}

    root.DEX = DexAPI;
  })();
})(typeof window !== 'undefined' ? window : this);
