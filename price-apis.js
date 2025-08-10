// jQuery API Functions for CEX and DEX Price Fetching
const GasPriceUSD = {
    BSC: 0,
    Ethereum: 0,
    Polygon: 0
};

const CHAIN_CONFIG = {
    ethereum: {
        name: 'Ethereum',
        code: 1,
        short: 'ERC',
        symbol: 'ETH',
        gasLimit: 250000,
        explorer: 'https://etherscan.io',
        rpc: 'https://eth.llamarpc.com'
    },
    bsc: {
        name: 'BSC',
        code: 56,
        short: 'BSC',
        symbol: 'BNB',
        gasLimit: 80000,
        explorer: 'https://bscscan.com',
        rpc: 'https://bsc-dataseed.binance.org/'
    },
    polygon: {
        name: 'Polygon',
        code: 137,
        short: 'POLY',
        symbol: 'MATIC',
        gasLimit: 80000,
        explorer: 'https://polygonscan.com',
        rpc: 'https://polygon-pokt.nodies.app'
    },
    arbitrum: {
        name: 'Arbitrum',
        code: 42161,
        short: 'ARB',
        symbol: 'ETH',
        gasLimit: 100000,
        explorer: 'https://arbiscan.io',
        rpc: 'https://arbitrum-one-rpc.publicnode.com'
    },
    base: {
        name: 'Base',
        code: 8453,
        short: 'BASE',
        symbol: 'ETH',
        gasLimit: 100000,
        explorer: 'https://basescan.org/',
        rpc: 'https://base.llamarpc.com'
    },
    solana: {
        name: 'Solana',
        code: 501,
        short: 'SOL',
        symbol: 'SOL',
        explorer: 'https://solscan.io/',
        rpc: ''
    }
};

const CONFIG_CEX = {
    GATE: {
        ApiKey: "577bb104ebb7977925c0ba7a292a722e",
        ApiSecret: "48b2cd4b122f076d2ebf8833359dfeffd268c5a0ce276b4cbe6ba5aa52e7f7cc",
        WARNA: "#D5006D",  // Pink tua
    },
    BINANCE: {
        ApiKey: "2U7YGMEUDri6tP3YEzmK3CcZWb9yQ5j3COp9s7pRRUv4vu8hJAlwH4NkbNK74hDU",
        ApiSecret: "XHjPVjLzbs741xoznV3xz1Wj5SFrcechNBjvezyXLcg8GLWF21VW32f0YhAsQ9pn",
        WARNA: "#e0a50c",  // Orange tua
    },
    MEXC: {
        ApiKey: "mx0vglBh22wwHBY0il", // Ganti dengan ApiKey asli
        ApiSecret: "429877e0b47c41b68dd77613cdfded64", // Ganti dengan ApiSecret asli
        WARNA: "#1448ce",  // Biru muda
    }
    
};

const CEXWallets = {
    polygon: {
        Kode_Chain: 137,
        WALLET_CEX: {
        GATEIO: {
            address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
            chainCEX: 'MATIC'
        },
        BINANCE: {
            address: '0x290275e3db66394C52272398959845170E4DCb88',
            chainCEX: 'MATIC'
        },
        MEXC: {
            address: '0x51E3D44172868Acc60D68ca99591Ce4230bc75E0',
            chainCEX: 'MATIC'
        },
        INDODAX: {
            address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6',
            chainCEX : 'POLYGON',
            },   
        }
    },
    arbitrum: {
        Kode_Chain: 42161,
        WALLET_CEX: {
            GATEIO: {
                address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
                chainCEX: 'ARBEVM'
            },
            BINANCE: {
                address: '0x290275e3db66394C52272398959845170E4DCb88',
                chainCEX: 'ARBITRUM'
            },
            MEXC: {
                address: '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB',
                chainCEX: 'ARB'
            },
            INDODAX: {
                address : '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2',
                chainCEX : 'ARB',
            } 
        }
    },
    ethereum: {
        Kode_Chain: 1,
        WALLET_CEX: {
            GATEIO: {
                address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
                chainCEX: 'ETH'
            },
            BINANCE: {
                address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
                chainCEX: 'ETH'
            },
            MEXC: {
                address: '0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88',
                chainCEX: 'ETH'
            },
            INDODAX: {
                address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6',
                chainCEX : 'ETH'
            }
        }
    },
    bsc: {
        Kode_Chain: 56,
        WALLET_CEX: {
            GATEIO: {
                address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
                chainCEX: 'BSC'
            },
            BINANCE: {
                address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3',
                chainCEX: 'BSC'
            },
            MEXC: {
                address: '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB',
                chainCEX: 'BSC'
            },
            INDODAX: {
                address : '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2',
                chainCEX : 'BSC',
            } 
        }
    },
    base: {
        Kode_Chain: 8453,
        WALLET_CEX: {
            GATEIO: {
                address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
                chainCEX: 'BASEEVM'
            },
            BINANCE: {
                address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
                chainCEX: 'BASE'
            },
            MEXC: {
                address: '0x4e3ae00E8323558fA5Cac04b152238924AA31B60',
                chainCEX: 'BASE'
            },  
            INDODAX: {
                address : '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2',
                chainCEX : 'BASE',
            } 
        }
    }
 };

function getCEXKeyAlias(name) {
    const map = {
        "BINANCE": "BINANCE",
        "Binance": "BINANCE",
        "MEXC": "MEXC",
        "Gateio": "GATEIO",
        "GATE": "GATEIO",
        "GATEIO": "GATEIO",
        "INDODAX": "INDODAX",
        "Indodax": "INDODAX"
    };
    return map[name] || name.toUpperCase();
}

window.withProxy = function(url, useProxy = true) {
    return useProxy ? `https://vercel-proxycors.vercel.app/?url=${encodeURIComponent(url)}` : url;
};

var settings = JSON.parse(localStorage.getItem('MULTIALL_SETTING') || '{}');
var timeoutApi = settings.TimeoutCount || 5000;

function withTimeout(promise, timeout) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
    ]);
}

async function fetchWithCountdown(cellId,dexName, promiseFn) {
    const cell = $(`#${cellId}`);
    let countdown = Math.floor(timeoutApi / 1000);

    //cell.html(`⏳ ${countdown--}s`);
    cell.html(`⏳ ${dexName} ${countdown--}s`);
    const interval = setInterval(() => {
        if (countdown > 0) {
            cell.html(`⏳ ${dexName} ${countdown--}s`);
        }
    }, 1000);

    try {
        const result = await withTimeout(promiseFn(), timeoutApi);
        clearInterval(interval);
        return result;
    } catch (err) {
        clearInterval(interval);
// ✅ Tangani error structured dari getMagpiePrice()
        if (err.name === 'TimeoutError') {
            console.warn(`🕒 Timeout pada ${dexName}: permintaan melebihi batas waktu`);
        } else if (err.exchange && err.error) {
            console.error(`❌ Error ${err.exchange}: ${err.error} (status: ${err.status || 'unknown'})`);
        } else {
            console.error(`💥 Error tidak diketahui dari ${dexName}:`, err);
        }

        throw err;
    }
    
}

function calculateSignature(exchange, apiSecret, dataToSign, hashMethod = "HmacSHA256") {
    if (!apiSecret || !dataToSign) {
        console.error(`[${exchange}] API Secret atau Data untuk Signature tidak valid!`);
        return null;
    }

    switch (exchange.toUpperCase()) {
        case "OKX":
            const hmac = CryptoJS.HmacSHA256(dataToSign, apiSecret);
            return CryptoJS.enc.Base64.stringify(hmac); // OKX Wajib BASE64
        default:
            return CryptoJS.HmacSHA256(dataToSign, apiSecret).toString(CryptoJS.enc.Hex);
    }
}

function calculateSignatureLAMA(exchange, apiSecret, dataToSign, hashMethod = "HmacSHA256") {
    if (!apiSecret || !dataToSign) {
        console.error(`[${exchange}] API Secret atau Data untuk Signature tidak valid!`);
        return null;
    }

    switch (exchange.toUpperCase()) {
        case "OKX":
            const hmac = CryptoJS.HmacSHA256(dataToSign, apiSecret);
            return CryptoJS.enc.Base64.stringify(hmac);
        default:
            return CryptoJS.HmacSHA256(dataToSign, apiSecret).toString(CryptoJS.enc.Hex);
    }
}

const CEXAPIs = {
    getBinanceOrderBook: async function(pair) {
        if (pair.baseSymbol === 'USDT' && pair.quoteSymbol === 'USDT') {
            //console.warn('⏭️ Skip Binance USDT/USDT ');
            return {
                buy: 1, sell: 1, topAsks: [], topBids: [], quotePriceUSDT: 1
            };
        }

        const baseResp = await withTimeout(fetch(`https://api-gcp.binance.com/api/v3/depth?symbol=${pair.baseSymbol}USDT&limit=5`), timeoutApi);
        const baseData = await baseResp.json();

        let quotePriceUSDT = 1;
        if (pair.quoteSymbol !== 'USDT') {
            const quoteResp = await withTimeout(fetch(`https://api-gcp.binance.com/api/v3/depth?symbol=${pair.quoteSymbol}USDT&limit=5`), timeoutApi);
            const quoteData = await quoteResp.json();
            quotePriceUSDT = parseFloat(quoteData.asks[0][0]);
        }

        return {
            buy: parseFloat(baseData.asks[0][0]),
            sell: parseFloat(baseData.bids[0][0]),
            topAsks: baseData.asks.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            topBids: baseData.bids.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            quotePriceUSDT
        };
    },

    getMEXCOrderBook: async function(pair) {
        if (pair.baseSymbol === 'USDT' && pair.quoteSymbol === 'USDT') {
          //  console.warn('⏭️ Skip MEXC USDT/USDT ');
            return {
                buy: 1, sell: 1, topAsks: [], topBids: [], quotePriceUSDT: 1
            };
        }

        const baseUrl = `https://api.mexc.com/api/v3/depth?symbol=${pair.baseSymbol}USDT&limit=5`;
        const baseResp = await withTimeout(fetch(withProxy(baseUrl)), timeoutApi);
        const baseData = await baseResp.json();

        let quotePriceUSDT = 1;
        if (pair.quoteSymbol !== 'USDT') {
            const quoteResp = await withTimeout(fetch(`https://api.mexc.com/api/v3/depth?symbol=${pair.quoteSymbol}USDT&limit=5`), timeoutApi);
            const quoteData = await quoteResp.json();
            quotePriceUSDT = parseFloat(quoteData.asks[0][0]);
        }

        return {
            buy: parseFloat(baseData.asks[0][0]),
            sell: parseFloat(baseData.bids[0][0]),
            topAsks: baseData.asks.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            topBids: baseData.bids.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            quotePriceUSDT
        };
    },

    getGateOrderBook: async function(pair) {
        if (pair.baseSymbol === 'USDT' && pair.quoteSymbol === 'USDT') {
           // console.warn('⏭️ Skip Gate.io USDT/USDT ');
            return {
                buy: 1, sell: 1, topAsks: [], topBids: [], quotePriceUSDT: 1
            };
        }

        //const baseUrl = `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${pair.baseSymbol}_USDT&limit=5`;
       // const baseResp = await withTimeout(fetch(withProxy(baseUrl)), timeoutApi);

        const baseResp = await withTimeout(fetch(`https://proxykiri.awokawok.workers.dev/?https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${pair.baseSymbol}_USDT&limit=5`), timeoutApi); 
        const baseData = await baseResp.json();       

        let quotePriceUSDT = 1;
        if (pair.quoteSymbol !== 'USDT') {

           // const quoteUrl = `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${pair.quoteSymbol}_USDT&limit=5`;
            //const quoteResp = await withTimeout(fetch(withProxy(quoteUrl)), timeoutApi);
            
            const quoteResp = await withTimeout(fetch(`https://proxykiri.awokawok.workers.dev/?https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${pair.quoteSymbol}_USDT&limit=5`), timeoutApi);
            const quoteData = await quoteResp.json();
            quotePriceUSDT = parseFloat(quoteData.asks[0][0]);
        }

        return {
            buy: parseFloat(baseData.asks[0][0]),
            sell: parseFloat(baseData.bids[0][0]),
            topAsks: baseData.asks.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            topBids: baseData.bids.slice(0, 5).map(x => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) })),
            quotePriceUSDT
        };
    },
    
    getIndodaxOrderBook: async function (pair) {
        const base = pair.baseSymbol.toLowerCase();
        const quote = pair.quoteSymbol.toLowerCase();

        // Jika pair adalah USDT/USDT
        if (base === 'usdt' && quote === 'usdt') {
            return {
                buy: 1, sell: 1, topAsks: [], topBids: [], quotePriceUSDT: 1
            };
        }

        const baseUrl = `https://indodax.com/api/depth/${base}idr?limit=5`;
        const baseResp = await withTimeout(fetch(withProxy(baseUrl)), timeoutApi);
        const baseData = await baseResp.json();

        // ✅ Ambil rate USDT/IDR global agar konsisten dengan CellResult()
        const usdtToIDR = window.ExchangeRates?.IndodaxUSDT || 16000; // fallback default
        const rateIDRtoUSDT = 1 / usdtToIDR;

        if (!baseData?.sell?.length || !baseData?.buy?.length) {
            console.warn(`❌ Order book Indodax kosong untuk ${base}IDR`);
            return {
                buy: 0,
                sell: 0,
                topAsks: [],
                topBids: [],
                quotePriceUSDT: rateIDRtoUSDT
            };
        }

        const topAsks = baseData.buy.map(([price, qty]) => ({
            price: parseFloat(price) * rateIDRtoUSDT, // ✅ harga beli → dikonversi ke USDT
            qty: parseFloat(qty)
        }));

        const topBids = baseData.sell.map(([price, qty]) => ({
            price: parseFloat(price) * rateIDRtoUSDT, // ✅ harga jual → dikonversi ke USDT
            qty: parseFloat(qty)
        }));

        return {
            // ✅ BENAR: buy = harga jual (bid), sell = harga beli (ask)
            buy: topBids[0].price,
            sell: topAsks[0].price,
            topAsks,
            topBids,
            quotePriceUSDT: rateIDRtoUSDT
        };
    }

};

// DEX API Functions
const DEXAPIs = {
    // KyberSwap API
    getKyberSwapPrice: function(tokenIn, tokenOut, amountIn, chainName) {
        const net = chainName === 'avax' ? 'avalanche' : chainName;
        const url = `https://aggregator-api.kyberswap.com/${net}/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&gasInclude=true`;
 
        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                method: 'GET',
                //timeout: timeoutApi,
                success: function(data) {
                    if (data && data.data && data.data.routeSummary) {
                        const route = data.data.routeSummary;
                        // Hitung feeSwap manual via PriceUtils
                        const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, route.gas);
                        resolve({
                            exchange: 'KyberSwap',
                            amountIn: amountIn,
                            amountOut: route.amountOut,
                            price: parseFloat(route.amountOut) / parseFloat(amountIn),
                            gasEstimate: route.gasEstimate || 0,
                            gasPrice: route.gasPrice || 0,
                            feeDEX: parseFloat(route.gasUsd),
                            feeSwapUSDT : parseFloat(feeSwapUSDT),
                            rawRate: parseFloat(amountIn) / parseFloat(route.amountOut),
                            timestamp: Date.now()
                        });
                    } else {
                        reject({ exchange: 'KyberSwap', error: 'Invalid response', status: 'invalid_data' });
                    }
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'KYBERSWAP',
                        error: errText,
                        status,             // jQuery's internal error status (e.g., 'timeout', 'error')
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }

            });
        });
    },

    // ODOS API
    getODOSPrice: function(inputTokens, outputTokens, userAddr,amountIn, chainId,chainName) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'https://api.odos.xyz/sor/quote/v2',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    chainId: parseInt(chainId),
                    inputTokens,
                    outputTokens,
                    userAddr,
                    slippageLimitPercent: 0.3,
                    sourceBlacklist: [],
                    sourceWhitelist: [],
                    simulate: false,
                    referralCode: 0
                }),
                //timeout: timeoutApi,
                success: function(data) {
                    // Hitung feeSwap manual via PriceUtils
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, data.gasEstimate);

                    if (data && data.outAmounts && data.outAmounts.length > 0) {
                        resolve({
                            exchange: 'ODOS',
                            amountIn: amountIn,
                            outAmounts: data.outAmounts,
                            amountOut: data.outAmounts?.[0] || '0',
                            price: parseFloat(data.outAmounts[0]) / parseFloat(amountIn),
                            rawRate: parseFloat(amountIn) / parseFloat(data.outAmounts[0]),
                            feeDEX: parseFloat(data.gasEstimateValue),
                            feeSwapUSDT: parseFloat(feeSwapUSDT),
                            timestamp: Date.now()
                        });
                    } else {
                        reject({ exchange: 'ODOS', error: 'Invalid response', status: 'invalid_data' });
                    }
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'ODOS',
                        error: errText,
                        status,             // jQuery's internal error status (e.g., 'timeout', 'error')
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }

            });
        });
    },

    getHinkalODOSPrice: function(inputTokens, outputTokens, userAddr,amountIn, chainId,chainName) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `https://ethmainnet.server.hinkal.pro/OdosSwapData`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    chainId: parseInt(chainId),
                    inputTokens,
                    outputTokens,
                    userAddr,
                    slippageLimitPercent: 0.3,
                    sourceBlacklist: [],
                    sourceWhitelist: [],
                    simulate: false,
                    referralCode: 0
                }),
                //timeout: timeoutApi,
                success: function(data) {
                    // Hitung feeSwap manual via PriceUtils
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, data.gasEstimate);

                    if (data && data.outAmounts && data.outAmounts.length > 0) {
                        resolve({
                            exchange: 'ODOS',
                            amountIn: amountIn,
                            outAmounts: data.odosResponse.outValues[0],
                            amountOut: data.odosResponse.outValues[0]?.[0] || '0',
                            price: parseFloat(data.odosResponse.outValues[0]) / parseFloat(amountIn),
                            rawRate: parseFloat(amountIn) / parseFloat(data.odosResponse.outValues[0]),
                            feeDEX: parseFloat(data.odosResponse.gasEstimateValue),
                            feeSwapUSDT: parseFloat(feeSwapUSDT),
                            timestamp: Date.now()
                        });
                    } else {
                        reject({ exchange: 'HINKAL ODOS', error: 'Invalid response', status: 'invalid_data' });
                    }
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'HINKAL ODOS',
                        error: errText,
                        status,             // jQuery's internal error status (e.g., 'timeout', 'error')
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }

            });
        });
    },

    getHinkal1InchPrice: function(inputTokens, outputTokens, userAddr, amountIn, chainId, chainName) {
        return new Promise((resolve, reject) => {
            const sc_input = inputTokens[0]?.tokenAddress;
            const sc_output = outputTokens[0]?.tokenAddress;
            const apiUrl = "https://ethmainnet.server.hinkal.pro/OneInchSwapData";

            const requestData = {
                url: "https://api.1inch.dev/swap/v5.2/" + chainId + "/swap?" +
                    "fromTokenAddress=" + sc_input +
                    "&toTokenAddress=" + sc_output +
                    "&amount=" + amountIn +
                    "&fromAddress=" + userAddr +
                    "&slippage=10" +
                    "&destReceiver=" + userAddr +
                    "&disableEstimate=true"
            };

            $.ajax({
                url: apiUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                //timeout: timeoutApi,
                success: function(data) {
                    const outAmount = data?.oneInchResponse?.toAmount || '0';

                    // Ambil gasEstimate, fallback ke 350000 jika tidak tersedia
                    let gasEstimate = parseFloat(data?.oneInchResponse?.tx?.gas || 0);
                    if (!gasEstimate || gasEstimate === 0) gasEstimate = 350000;

                    // Gunakan gasPrice pribadi override: 0.1 Gwei
                    const gweiOverride = 0.1;

                    // Hitung feeSwapUSDT manual
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, gasEstimate, gweiOverride);

                    if (parseFloat(outAmount) > 0) {
                        resolve({
                            exchange: '1INCH',
                            amountIn: amountIn,
                            outAmounts: [outAmount],
                            amountOut: outAmount,
                            price: parseFloat(outAmount) / parseFloat(amountIn),
                            rawRate: parseFloat(amountIn) / parseFloat(outAmount),
                            gasEstimate: gasEstimate,
                            gasPrice: gweiOverride, // ditampilkan sesuai override
                            feeDEX: 0, // kosong karena tidak tersedia dari 1inch
                            feeSwapUSDT: parseFloat(feeSwapUSDT),
                            timestamp: Date.now()
                        });
                    } else {
                        reject({ exchange: '1INCH', error: 'Invalid response', status: 'invalid_data' });
                    }
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: '1INCH',
                        error: errText,
                        status,
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }
            });
        });
    },

    get0xPrice: function (sellToken, buyToken, sellAmount, chainId, direction,chainName) {
         //https://api.0x.org/swap/v1/quote?buyToken=0xdAC17F958D2ee523a2206206994597C13D831ec7&sellAmount=1000000000000000000&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&slippagePercentage=0.01&affiliateAddress=0x8c128f336B479b142429a5f351Af225457a987Fa&enableSlippageProtection=false&intentOnFilling=true&takerAddress=0x0000000000000000000000000000000000000000&skipValidation=true&feeRecipientTradeSurplus=0x8c128f336B479b142429a5f351Af225457a987Fa
            // api key 6f5d5c4d-bfdd-4fc7-8d3f-d3137094feb5
            //url: `https://polygon.api.0x.org/swap/v1/price?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`
       // console.log(direction);
        return new Promise((resolve, reject) => {
             if (direction === 'cex_to_dex') {
                var proxiedUrl = `https://proxykiri.awokawok.workers.dev/?https://matcha.xyz/api/swap/price?chainId=${chainId}&buyToken=${buyToken}&sellToken=${sellToken}&sellAmount=${sellAmount}`;
             }else{
                var proxiedUrl = `https://proxykanan.awokawok.workers.dev/?https://matcha.xyz/api/swap/price?chainId=${chainId}&buyToken=${buyToken}&sellToken=${sellToken}&sellAmount=${sellAmount}`;
             }

            // const rawUrl = `https://matcha.xyz/api/swap/price?chainId=${chainId}&buyToken=${buyToken}&sellToken=${sellToken}&sellAmount=${sellAmount}`;
            // const proxiedUrl = window.withProxy ? window.withProxy(rawUrl) : rawUrl;

            $.ajax({
                url: proxiedUrl,
                method: 'GET',
                //timeout: timeoutApi,
                success: function (data) {
                    let feeETH = 0;
                    if (data.totalNetworkFee) {
                        feeETH = parseFloat(data.totalNetworkFee) / 1e18;
                    } else if (data.estimatedGas && data.gasPrice) {
                        feeETH = (parseFloat(data.estimatedGas) * parseFloat(data.gasPrice)) / 1e18;
                    }

                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, data.gas);
                   
                    resolve({
                        exchange: 'Matcha',
                        sellToken: sellToken,
                        buyToken: buyToken,
                        sellAmount: sellAmount,
                        buyAmount: data.buyAmount,
                        price: parseFloat(data.price),
                        gasPrice: parseFloat(data.gasPrice || 0),
                        estimatedGas: parseFloat(data.estimatedGas || 0),
                        feeDEX: feeSwapUSDT,
                        feeSwapUSDT : feeSwapUSDT,
                        rawRate: 1 / parseFloat(data.price),
                        timestamp: Date.now()
                    });
                },
                error: function (xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'MATCHA',
                        error: errText,
                        status,
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }
            });
        });
    },

    getFlyTradePrice: function(fromToken, toToken, amount, chainName, userAddr) {
        const url = `https://api.fly.trade/aggregator/quote?network=${chainName}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&fromAddress=${userAddr}&toAddress=${userAddr}&sellAmount=${amount}&slippage=0.005&gasless=false`;

        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                method: 'GET',
                //timeout: timeoutApi,
                success: function(data) {
                     console.log("MAGPIE",data);
                    if (data && data.amountOut) {
                        const amountIn = parseFloat(data.typedData?.message?.amountIn || amount);
                        const amountOut = parseFloat(data.amountOut);
                        const fee = parseFloat(data.fees?.[0]?.value || 0);
                        const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, data.resourceEstimate.gasLimit);
                        
                        resolve({
                            exchange: 'FlyTrade',
                            amountOut: amountOut,
                            price: amountOut / amountIn,
                            feeDEX: fee,
                            feeSwapUSDT:feeSwapUSDT,
                            rawRate: amountIn / amountOut,
                            timestamp: Date.now()
                        });
                    } else {
                        reject({ exchange: 'FlyTrade', error: 'Invalid response format', status: 'invalid_data' });
                    }
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'FlyTrade',
                        error: errText,
                        status,
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }
            });
        });
    },

     getOKXDEXPrice: function(fromToken, toToken, amountIn, chainName) {
        const apiKeys = [        
            {
            ApiKeyOKX : "a4569d13-8a59-4ecd-9936-6c4e1233bff8",
            secretKeyOKX : "4484BC9B2FC22C35CB1071A2A520FDC8",
            PassphraseOKX : "Macpro-2025",
            },
             {
            ApiKeyOKX : "71cbe094-380a-4146-b619-e81a254c0702",
            secretKeyOKX : "5116D48C1847EB2D7BDD6DDD1FC8B199",
            PassphraseOKX : "Macpro-2025"
            },
             {
            ApiKeyOKX : "81a072cc-b079-410c-9963-fb8e49c16d9d",
            secretKeyOKX : "BF44AE00CF775DC6DDB0FDADF61EC724",
            PassphraseOKX : "Macpro-2025"
            },
            {
            ApiKeyOKX : "adad55d1-bf90-43ac-ac03-0a43dc7ccee2",
            secretKeyOKX : "528AFB3ECC88653A9070F05CC3839611",
            PassphraseOKX : "Cek_Horeg_911",
            },
            {
            ApiKeyOKX : "6866441f-6510-4175-b032-342ad6798817",
            secretKeyOKX : "E6E4285106CB101B39FECC385B64CAB1",
            PassphraseOKX : "Arekpinter123.",
            }
            
        ];
        
        const selectedKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

        const chainIdMap = {
            bsc: 56,
            ethereum: 1,
            polygon: 137,
            arbitrum: 42161,
            base: 8453,
            solana: 501
        };

        const chainId = chainIdMap[chainName.toLowerCase()] || 1;
        const queryString = `/api/v5/dex/aggregator/quote?amount=${amountIn}&chainIndex=${chainId}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}`;
        const timestamp = new Date().toISOString();
        const method = "GET";
        const dataToSign = timestamp + method + queryString;
        const signature = calculateSignature("OKX", selectedKey.secretKeyOKX, dataToSign, "HmacSHA256");

        return new Promise((resolve, reject) => {
            $.ajax({
                url: `https://web3.okx.com${queryString}`,
                method: method,
                headers: {
                    'OK-ACCESS-KEY': selectedKey.ApiKeyOKX,
                    'OK-ACCESS-SIGN': signature,
                    'OK-ACCESS-TIMESTAMP': timestamp,
                    'OK-ACCESS-PASSPHRASE': selectedKey.PassphraseOKX
                },
                //timeout: timeoutApi,
                success: function (data) {

                    const result = data?.data?.[0];
                    if (!result) {
                        reject({ exchange: 'OKXDEX', error: 'Invalid response format' });
                        return;
                    }
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, result.estimateGasFee);
                    
                    resolve({
                        exchange: 'OKXDEX',
                        amountOut: result.toTokenAmount || "0",
                        price: parseFloat(result.amountOut) / parseFloat(amountIn),
                        rawRate: parseFloat(amountIn) / parseFloat(result.amountOut), 
                        feeDEX: parseFloat(result.tradeFee || 0),
                        feeSwapUSDT : feeSwapUSDT,
                        timestamp: Date.now()
                    });

                },
               error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || res.msg || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'OKXDEX',
                        apikey:selectedKey.ApiKeyOKX,
                        error: errText,
                        status,             // jQuery's internal error status (e.g., 'timeout', 'error')
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }

            });
        });
    },
    getParaSwapPrice: function (fromToken, toToken, amountIn, fromDecimals, toDecimals, networkId, direction,userAddr,chainName) {
        
        apiUrl = `https://api.paraswap.io/prices/?version=6.2&srcToken=${fromToken}&destToken=${toToken}&amount=${amountIn}&srcDecimals=${fromDecimals}&destDecimals=${toDecimals}&side=SELL&network=${networkId}&otherExchangePrices=true&partner=paraswap.io&userAddress=${userAddr}`;

        return new Promise((resolve, reject) => {
            $.ajax({
                url: apiUrl,
                method: 'GET',
                //timeout: timeoutApi,
                success: function (response) {
                    let amountOut = 0;
                    let gasEstimate = 0;
                    let fee = 0;
                    let gasPrice = 0;

                    const pr = response?.priceRoute;
                    if (!pr || !pr.destAmount || !pr.gasCostUSD) {
                        return reject({
                            exchange: 'ParaSwap',
                            error: 'Invalid response structure',
                            rawResponse: response
                        });
                    }

                    amountOut = parseFloat(pr.destAmount);
                    fee = parseFloat(pr.gasCostUSD);           // total biaya swap dalam USD
                    gasEstimate = parseFloat(pr.gasCost);      // estimasi gas dalam unit
                    gasPrice = 0;                              // tidak diberikan dalam response

                    // Hitung feeSwapUSDT dari data gas langsung (bukan dari chainName)
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, gasEstimate);

                    if (!amountOut || isNaN(amountOut) || amountOut === 0) {
                        return reject({
                            exchange: 'ParaSwap',
                            error: 'Invalid destAmount',
                            rawResponse: response
                        });
                    }

                    resolve({
                        exchange: 'ParaSwap',
                        amountIn: parseFloat(amountIn),
                        amountOut: amountOut,
                        price: amountOut / parseFloat(amountIn),
                        rawRate: parseFloat(amountIn) / amountOut,
                        feeDEX: fee,
                        feeSwapUSDT: parseFloat(feeSwapUSDT),
                        gasEstimate: gasEstimate,
                        gasPrice: gasPrice,
                        timestamp: Date.now()
                    });
                },

                error: function (xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: 'PARASWAP',
                        error: errText,
                        status,
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }
            });
        });
    },

    getSWOOPPrice: function ( dexSlug,direction,inputAddress, outputAddress, rawAmountIn, decimalsIn, decimalsOut, chainId, userAddr, quotePriceUSDT,chainName ) {
        return new Promise((resolve, reject) => {
            const gasData = JSON.parse(localStorage.getItem('MULTIALL_gasTokenInfo') || '{}');
            const chainKey = chainName.toLowerCase(); // Misalnya: 'ethereum', 'bsc', dsb
            const feeUSDT = parseFloat(gasData[chainKey]?.gasFeeUSDT || 0); 
            
            const payload = {
                chainId,
                aggregatorSlug: dexSlug,
                sender: userAddr,
                inToken: {
                    chainId,
                    type: 'TOKEN',
                    address: inputAddress.toLowerCase(),
                    decimals: decimalsIn
                },
                outToken: {
                    chainId,
                    type: 'TOKEN',
                    address: outputAddress.toLowerCase(),
                    decimals: decimalsOut
                },
                amountInWei: String(rawAmountIn),
                slippageBps: "100",
               // gasPriceGwei: gasGwei
            };

            $.ajax({
                url: 'https://bzvwrjfhuefn.up.railway.app/swap',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                success: function (res) {
                    // console.log("SWOOP",res);
                    const amountOut = parseFloat(res.amountOutWei) / Math.pow(10, decimalsOut);
                    const normalizedIn = parseFloat(rawAmountIn) / Math.pow(10, decimalsIn);
                    const priceRaw = amountOut / normalizedIn;
                    const rawRate = normalizedIn / amountOut;
                    
                   resolve({
                        exchange: dexSlug + " via SWOOP ",
                        amountOut: res.amountOutWei,
                        price: priceRaw * quotePriceUSDT,
                        rawRate,
                        feeDEX: feeUSDT,
                        feeSwapUSDT: feeUSDT,
                        isFallback: true,
                        gasEstimate: gasData[chainKey]?.gasLimit || 0,
                        gasPrice: gasData[chainKey]?.gwei || 0,
                        timestamp: Date.now()
                    });
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    let httpStatus = xhr.status || 0;
                    let statusText = xhr.statusText || 'No status text';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: dexSlug+' ',
                        error: errText,
                        status,             // jQuery's internal error status (e.g., 'timeout', 'error')
                        httpCode: httpStatus,
                        httpText: statusText,
                        rawResponse: responseText
                    });
                }

            });
        });
    },

    getMarblePrice: function ( fromToken, toToken, amountIn, fromDecimals, toDecimals, chainId, token,  allowedExchanges, direction,chainName ) {
        const apiUrl = "https://api-v1.marbleland.io/api/v1/jumper/api/p/lifi/advanced/routes";
        
        const ALL_KNOWN_DEX = [
            "1inch", "0x", "paraswap", "dodo", "enso", "odos", "openocean",
            "stable", "kyberswap", "lifidexaggregator", "jupiter", "sushiswap",
            "bebop", "aftermath", "superswap", "bluefin7k", "liquidswap", "hyperbloom",
            "okx", "merkle"
        ];
        
        const optionsObj = {
            integrator: "swap.marbleland.io",
            order: "CHEAPEST",
            slippage: 0.003,
            maxPriceImpact: 0.4,
            allowSwitchChain: true,
            bridges: {
            deny: [
                "cbridge", "optimism", "arbitrum", "across", "omni", "celercircle", "allbridge",
                "thorswap", "symbiosis", "squid", "mayan", "mayanWH", "mayanMCTP", "relay",
                "polygon", "glacis", "stargateV2", "stargateV2Bus", "chainflip", "gasZipBridge"
            ]
            }
        };

        // Exchange config
        if (Array.isArray(allowedExchanges) && allowedExchanges.length > 0) {
            const allowed = allowedExchanges.map(e => e.toLowerCase());
            if (allowed.length === 1) {
            const denyList = ALL_KNOWN_DEX.filter(dex => !allowed.includes(dex));
            optionsObj.exchanges = { deny: denyList };
            } else {
            optionsObj.exchanges = { allow: allowed };
            }
        }

        const requestData = {
            fromAmount: amountIn.toString(),
            fromChainId: parseInt(chainId),
            fromTokenAddress: fromToken,
            toChainId: parseInt(chainId),
            toTokenAddress: toToken,
            options: optionsObj
        };

        return new Promise((resolve, reject) => {
            $.ajax({
            url: apiUrl,
            method: 'POST',
            contentType: 'application/json',
            headers: direction === 'dex_to_cex'
                ? { 'x-lifi-api-key': '36e8ccb2-d4e1-4321-8ca7-d78bae3d1461.5eacae7f-1e16-4ea9-9d5d-f9dcb03f7d50' }
                : {},
            data: JSON.stringify(requestData),
            //timeout: timeoutApi,

            success: function (response) {
                const bestRoute = response.routes?.[0];
                if (!bestRoute) return reject({ exchange: 'LiFi', error: 'No route found' });

                const rawOut = bestRoute.toAmount;
                const dexUsed = bestRoute.steps?.[0]?.tool || 'Unknown';

                const gasEstimate = parseFloat(
                bestRoute.steps?.[0]?.estimate?.gasCosts?.[0]?.estimate || 0
                );
                const gasPrice = parseFloat(
                bestRoute.steps?.[0]?.estimate?.gasCosts?.[0]?.price || 0
                );

                const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, gasEstimate);

                resolve({
                exchange: dexUsed,
                amountIn: amountIn,
                amountOut: rawOut,
                price: parseFloat(rawOut) / parseFloat(amountIn),
                gasEstimate: gasEstimate,
                gasPrice: gasPrice,
                feeDEX: parseFloat(bestRoute.gasCostUSD || "0"),
                feeSwapUSDT: feeSwapUSDT,
                rawRate: parseFloat(amountIn) / parseFloat(rawOut),
                timestamp: Date.now()
                });
            },

            error: function (xhr, status, error) {
                let errText = 'Unknown error';
                try {
                const res = JSON.parse(xhr.responseText);
                errText = res.message || error?.toString() || status;
                } catch {
                errText = error?.toString() || status;
                }

                reject({
                exchange: 'LIFI',
                error: errText,
                status,
                httpCode: xhr.status || 0,
                httpText: xhr.statusText || 'No status text',
                rawResponse: xhr.responseText
                });
            }
            });
        });
    },

    getDZAPPrice: function ({ account, chainId, sellToken, sellDecimals, buyToken, buyDecimals, sellAmount,direction, slippage = 0.3, integratorId = 'dzap',  allowedSources = [] }) {
        return new Promise((resolve, reject) => {
        $.ajax({
            url: 'https://api.dzap.io/v1/quotes',
            method: 'POST',
            //timeout: timeoutApi,
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                account: account || '0x0000000000000000000000000000000000000000',
                fromChain: chainId,
                integratorId,
                allowedSources: allowedSources.length > 0 ? allowedSources : [ // fallback jika kosong
                    "bebop",
                    "enso",
                    "iceCreamSwap",
                    "izumi",
                    "kyberSwap",
                    "lifi",
                    "magpie",
                    "odos",
                    "okx",
                    "oneInchViaLifi",
                    "openOcean",
                    "paraSwap",
                    "sushiswap",
                    "synapse",
                    "uniswap",
                    "unizen",
                    "vaporDex",
                    "woodSwap",
                    "xyFinance",
                    "zerox",
                    "orbiter",
                    "relayLink",
                    "mayanFinance",
                    "jupiter"
                ],
                   
                    data: [{
                        amount: sellAmount?.toString(),
                        srcToken: sellToken,
                        srcDecimals: parseInt(sellDecimals),
                        destToken: buyToken,
                        destDecimals: parseInt(buyDecimals),
                        slippage,
                        toChain: chainId,
                    }]

                }),
                success: function (response) {
                    try {
                        const key = Object.keys(response)[0];
                        const result = response[key];

                        if (!result || !result.recommendedSource || !result.quoteRates) {
                            return reject({
                                exchange: 'DZAP',
                                error: 'Invalid response structure',
                                rawResponse: response
                            });
                        }

                        const recommended = result.recommendedSource;
                        const bestQuote = result.quoteRates[recommended];

                        if (!bestQuote || !bestQuote.destAmount || !bestQuote.srcAmount) {
                            return reject({
                                exchange: 'DZAP',
                                error: 'Invalid quote for recommended source',
                                rawResponse: bestQuote
                            });
                        }

                        const rawOut = bestQuote.destAmount;
                        const rawIn = bestQuote.srcAmount;

                        const price = parseFloat(rawOut) / parseFloat(rawIn);
                        const rawRate = parseFloat(rawIn) / parseFloat(rawOut);

                        // Estimasi feeSwapUSDT: dari gasFee (ETH → USD)
                        const feeDEX = parseFloat(bestQuote?.fee?.totalUSD || 0); // ambil dari DZAP
                        const gasData = bestQuote?.fee?.gasFee?.[0];
                        const gasAmount = gasData?.amount || 0;
                        const gasAmountFloat = parseFloat(gasAmount);
                        const feeSwapUSDT = parseFloat(gasData?.amountUSD || 0);
                        const gasEstimate = gasAmountFloat > 0 ? gasAmountFloat / 1e9 : 0; // → satuan Gwei (opsional)
                        const gasPrice = 0; // DZAP tidak sediakan langsung

                        resolve({
                            exchange: '1INCH', // agar konsisten kolom, atau ganti 'DZAP' kalau beda kolom
                            amountIn: rawIn,
                            amountOut: rawOut,
                            price: price,
                            rawRate: rawRate,
                            gasEstimate: gasEstimate,
                            gasPrice: gasPrice,
                            feeDEX: feeDEX, // Jika DZAP sediakan fee lain, tambahkan di sini
                            feeSwapUSDT: feeSwapUSDT,
                            timestamp: Date.now()
                        });

                    } catch (e) {
                        reject({
                            exchange: 'DZAP',
                            error: 'Parsing error: ' + e.message,
                            rawResponse: response
                        });
                    }
                },

                error: function (xhr, status, error) {
                    let errText = 'Unknown error';
                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error;
                    } catch {
                        errText = error;
                    }

                    reject({
                        exchange: (allowedSources.length ? allowedSources.join(', ') : 'unknown') + ' ',
                        error: errText,
                        status,
                        httpCode: xhr.status || 0,
                        rawResponse: xhr.responseText
                    });
                }
            });
        });
    },

    getZero1inchPrice: function (fromToken, toToken, amountIn, fromDecimals, toDecimals, chainId, direction , chainName) {
        return new Promise((resolve, reject) => {
            const baseUrl = "https://api.zeroswap.io/quote/1inch";
            const params = new URLSearchParams({
                fromChain: chainId,
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                fromTokenDecimals: fromDecimals,
                toTokenDecimals: toDecimals,
                sellAmount: amountIn.toString(),
                slippage: "0.1"
            });

            const fullUrl = `${baseUrl}?${params.toString()}`;

            $.ajax({
                url: fullUrl,
                method: 'GET',
                //timeout: timeoutApi,
                success: function (response) {
                    const q = response?.quote;
                    if (!q || !q.estimation || !q.estimation.buyAmount) {
                        return reject({
                            exchange: 'ZeroSwap',
                            error: 'Invalid quote or estimation'
                        });
                    }

                    const route = q.estimation; // samakan dengan Kyber
                    const buyAmount = route.buyAmount;

                    const amountInFloat = parseFloat(amountIn) / (10 ** fromDecimals);
                    const amountOutFloat = parseFloat(buyAmount) / (10 ** toDecimals);

                    const price = amountOutFloat > 0 ? amountOutFloat / amountInFloat : 0;
                    const rawRate = amountOutFloat > 0 ? amountInFloat / amountOutFloat : 0;

                    // Ambil gas dan gasPrice
                    const gasEstimate = parseFloat(q.tx?.gas || q.tx?.estimatedGas || 0);
                    const gasPrice = parseFloat(q.tx?.gasPrice || 0) / 1e9; // wei to gwei

                    // Hitung feeSwap USDT (via localStorage MULTIALL_gasTokenInfo)
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName || '', gasEstimate);

                    resolve({
                        exchange: '1inch', // disamakan
                        amountIn: amountIn,
                        amountOut: buyAmount,
                        price: price,
                        gasEstimate: gasEstimate,
                        gasPrice: gasPrice,
                        feeDEX: 0, // ZeroSwap belum punya info ini
                        feeSwapUSDT: parseFloat(feeSwapUSDT),
                        rawRate: rawRate,
                        timestamp: Date.now()
                    });
                },

                error: function (xhr, status, error) {
                    let errText = 'Unknown error';
                    let responseText = xhr.responseText;

                    try {
                        const res = JSON.parse(responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: '1inch',
                        error: errText,
                        status,
                        httpCode: xhr.status || 0,
                        httpText: xhr.statusText || '',
                        rawResponse: responseText
                    });
                }
            });
        });
    },

    get1inchQuotePrice: function(tokenIn, tokenOut, amountIn, chainId, chainName, userAddr) {
        return new Promise((resolve, reject) => {
            const gasInfoMap = JSON.parse(localStorage.getItem('MULTIALL_gasTokenInfo') || '{}');
            const gasInfo = gasInfoMap[chainName];

            if (!gasInfo || !gasInfo.tokenPrice || !gasInfo.gwei) {
                return reject({
                    exchange: '1inch',
                    error: `Missing gas info for ${chainName} in localStorage`
                });
            }

            const gasPriceGwei = gasInfo.gwei;
            const gasPriceWei = (gasPriceGwei * 1e9).toFixed(0).toString();

            const url = `https://proxy-app.1inch.io/v2.0/v2.2/chain/${chainId}/router/v5/quotesv2?fromTokenAddress=${tokenIn}&toTokenAddress=${tokenOut}&amount=${amountIn}&gasPrice=${gasPriceWei}&preset=maxReturnResult&walletAddress=${userAddr}`;

            $.ajax({
                url: url,
                method: 'GET',
                //timeout: timeoutApi,
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImNiZmY5ZDI3LThhYTEtNDExMy04MTc4LTJhNjkzYmNjYmUyNSIsImV4cCI6MTc1MzY5MjE5MCwiZGV2aWNlIjoiYnJvd3NlciIsImlhdCI6MTc1MzY4ODU5MH0.ECh_mhSEWGOH0v5L1OSd9YptQWOmHyVxKFSWUNnBYJIBIUZ_3f69F4q80_HsiLXLxNtaAR8W8AoFsUkWnIh2YA',
                    'accept': 'application/json',
                    'content-type': 'application/json'
                },
                success: function (response) {
                    const result = response?.bestResult;
                    if (!result || !result.tokenAmount || !result.gas || !result.eth) {
                        return reject({
                            exchange: '1inch',
                            error: 'Invalid response structure',
                            rawResponse: response
                        });
                    }

                    // Hitung feeSwap manual via PriceUtils
                    const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName, result.gas);
                        
                    const amountOut = result.tokenAmount;
                    const gasEstimate = parseFloat(result.gas);

                    resolve({
                        exchange: '1inch',
                        amountIn: amountIn,
                        amountOut: amountOut,
                        price: parseFloat(amountOut) / parseFloat(amountIn),
                        gasEstimate: gasEstimate,
                        gasPrice: gasPriceWei,
                        feeDEX: feeSwapUSDT,
                        feeSwapUSDT: feeSwapUSDT,
                        rawRate: parseFloat(amountIn) / parseFloat(amountOut),
                        timestamp: Date.now()
                    });
                },
                error: function(xhr, status, error) {
                    let errText = 'Unknown error';
                    try {
                        const res = JSON.parse(xhr.responseText);
                        errText = res.message || error?.toString() || status;
                    } catch {
                        errText = error?.toString() || status;
                    }

                    reject({
                        exchange: '1inch',
                        error: errText,
                        status,
                        httpCode: xhr.status || 0,
                        httpText: xhr.statusText || '',
                        rawResponse: xhr.responseText
                    });
                }
            });
        });
    },

    getZeroKyberPrice: function (fromToken, toToken, amountIn, fromDecimals, toDecimals, chainId, direction , chainName) {
            return new Promise((resolve, reject) => {
                const baseUrl = "https://api.zeroswap.io/quote/kyberswap";
                const params = new URLSearchParams({
                    fromChain: chainId,
                    fromTokenAddress: fromToken,
                    toTokenAddress: toToken,
                    fromTokenDecimals: fromDecimals,
                    toTokenDecimals: toDecimals,
                    sellAmount: amountIn.toString(),
                    slippage: "0.1"
                });

                const fullUrl = `${baseUrl}?${params.toString()}`;

                $.ajax({
                    url: fullUrl,
                    method: 'GET',
                    //timeout: timeoutApi,
                    success: function (response) {
                        const q = response?.quote;
                        if (!q || !q.estimation || !q.estimation.buyAmount) {
                            return reject({
                                exchange: 'ZeroSwap',
                                error: 'Invalid quote or estimation'
                            });
                        }

                        const route = q.estimation; // samakan dengan Kyber
                        const buyAmount = route.buyAmount;

                        const amountInFloat = parseFloat(amountIn) / (10 ** fromDecimals);
                        const amountOutFloat = parseFloat(buyAmount) / (10 ** toDecimals);

                        const price = amountOutFloat > 0 ? amountOutFloat / amountInFloat : 0;
                        const rawRate = amountOutFloat > 0 ? amountInFloat / amountOutFloat : 0;

                        // Ambil gas dan gasPrice
                        const gasEstimate = parseFloat(q.tx?.gas || q.tx?.estimatedGas || 0);
                        const gasPrice = parseFloat(q.tx?.gasPrice || 0) / 1e9; // wei to gwei

                        // Hitung feeSwap USDT (via localStorage MULTIALL_gasTokenInfo)
                        const feeSwapUSDT = PriceUtils.getGasFeeUSD(chainName || '', gasEstimate);

                        resolve({
                            exchange: 'kyber', // disamakan
                            amountIn: amountIn,
                            amountOut: buyAmount,
                            price: price,
                            gasEstimate: gasEstimate,
                            gasPrice: gasPrice,
                            feeDEX: 0, // ZeroSwap belum punya info ini
                            feeSwapUSDT: parseFloat(feeSwapUSDT),
                            rawRate: rawRate,
                            timestamp: Date.now()
                        });
                    },

                    error: function (xhr, status, error) {
                        let errText = 'Unknown error';
                        let responseText = xhr.responseText;

                        try {
                            const res = JSON.parse(responseText);
                            errText = res.message || error?.toString() || status;
                        } catch {
                            errText = error?.toString() || status;
                        }

                        reject({
                            exchange: 'kyber',
                            error: errText,
                            status,
                            httpCode: xhr.status || 0,
                            httpText: xhr.statusText || '',
                            rawResponse: responseText
                        });
                    }
                });
            });
        },
};

// Utility Functions
const PriceUtils = {
     // Tambahan normalisasi dan perhitungan fee dalam USD
    normalizeAmount(amount, decimals) {
        return parseFloat(amount) / Math.pow(10, decimals);
    },

    getGasFeeUSD(chainKey, gasEstimate) {
        const gasData = JSON.parse(localStorage.getItem("MULTIALL_gasTokenInfo") || "{}");
        const info = gasData[chainKey];

        const tokenPrice = info.tokenPrice; // Harga native token dalam USDT
        const gasPriceGwei = info.gwei;
        const gasInNative = (gasEstimate * gasPriceGwei) / 1e9; // Konversi ke native token
        return gasInNative * tokenPrice; // Konversi ke USDT
    },

    // Convert token symbol to CEX format
    formatCEXSymbol: function(tokenSymbol, pairSymbol) {
        return `${tokenSymbol}${pairSymbol}`;
    },

    // Convert token symbol to Gate.io format
    formatGateSymbol: function(tokenSymbol, pairSymbol) {
        return `${tokenSymbol}_${pairSymbol}`;
    },

    // Get chain ID from chain name
    getChainId: function(chainName) {
        const chainMap = {
            "BSC": 56,
            "Ethereum": 1,
            "Polygon": 137,
            "Arbitrum": 42161,
            "Base": 8453,
            "Aolana": 501
        };
        return chainMap[chainName] || '1';
    },

    // Calculate amount with decimals
    calculateAmount: function(amount, decimals) {
        return BigInt(Math.round(Math.pow(10, decimals) * amount));
    },

    // Calculate PNL
    calculatePNL: function(buyPrice, sellPrice, amount, fee) {
        const revenue = sellPrice * amount;
        const cost = buyPrice * amount + fee;
        return revenue - cost;
    },

    // Format fee display
    formatFee: function(fee) {
        return `$${fee.toFixed(4)}`;
    },

    // Format PNL display
    formatPNL: function(pnl) {
        const sign = pnl >= 0 ? '+' : '';
        return `${sign}$${pnl.toFixed(2)}`;
    },

    formatPrice(val) {
        const price = parseFloat(val);
        if (isNaN(price)) return '-';
        if (price === 0) return '$0.0000';

        if (price >= 1) {
            return `${price.toFixed(4)}`;
        }

        let strPrice = price.toFixed(20).replace(/0+$/, '');
        let match = strPrice.match(/0\.(0*)(\d+)/); // nol dan angka signifikan

        if (match) {
            const zeroCount = match[1].length;
            let significant = match[2].substring(0, 4).padEnd(4, '0');

            if (zeroCount >= 2) {
                return `0.{${zeroCount}}${significant}`;
            } else {
                return `0.${match[1]}${significant}`;
            }
        }

        return `${price.toFixed(8)}`;
    },

    formatFee(val) {
        return `$${parseFloat(val).toFixed(2)}`;
    },

    formatPNL(val) {
        const prefix = val >= 0 ? '+' : '';
        return `${prefix}${parseFloat(val).toFixed(2)}`;
    }

};

async function checkAllCEXWalletsPerChain() {
    $('#loadingOverlay').fadeIn(150);
    const results = {};

    console.log("🚀 Memulai pengecekan wallet & fee WD semua CEX...");
    $('#infoupdateWALLET').html('🚀 Memulai pengecekan semua wallet & fee WD CEX...');

    // ✅ Hanya panggil sekali per CEX
    $('#infoupdateWALLET').html('📡 Ambil Data dari BINANCE...');
    const binanceData = await fetchBinance();

    $('#infoupdateWALLET').html('📡 Ambil Data dari MEXC...');
    const mexcData = await fetchMexc();

    $('#infoupdateWALLET').html('📡 Ambil Data dari GATE...');
    const gateData = await fetchGate();

    // 🔁 Proses berdasarkan kombinasi chain dan cexKey
    for (const chainName in CEXWallets) {
        const walletList = CEXWallets[chainName].WALLET_CEX;

        for (const cexName in walletList) {
            const cexKey = getCEXKeyAlias(cexName);
            const chainCEX = walletList[cexName].chainCEX;
            const storageKey = `${chainCEX}_${cexKey}`;

            let allData = [];
            if (cexKey === "BINANCE") allData = binanceData;
            else if (cexKey === "MEXC") allData = mexcData;
            else if (cexKey === "GATEIO") allData = gateData;

            results[storageKey] = allData.filter(item =>
                item.chain?.toUpperCase() === chainCEX.toUpperCase()
            );

           // console.log(`📦 Loaded data for ${storageKey}: ${results[storageKey].length} token(s)`);
            $('#infostatus').html(`Hasil Data ${storageKey}: ${results[storageKey].length} token(s)`);
        }
    }

   // console.log("🔧 Menyisipkan info wallet ke setiap token di MULTIALL_TOKENS...");

    const tokenMulti = JSON.parse(localStorage.getItem("MULTIALL_TOKENS") || "[]");

    const tokenMultiUpdated = tokenMulti.map((token, idx) => {
        const { symbol, pairSymbol, chain, selectedCexs } = token;
        const cexInfo = {};
        const chainConfig = CEXWallets[chain.toLowerCase()];

        console.log(`\n📍 [${idx + 1}] Token: ${symbol} on ${chain}`);

        for (const cex of selectedCexs || []) {
            const cexKey = getCEXKeyAlias(cex);
            const chainCEX = chainConfig?.WALLET_CEX?.[cexKey]?.chainCEX;
            const key = `${chainCEX}_${cexKey}`;
            const walletList = results[key];

            console.log(`🔍 Cek di: ${key} (CEX ${cex})`);

            if (!walletList || !Array.isArray(walletList)) {
                console.warn(`⛔️ Tidak ada wallet list untuk ${key}`);
                continue;
            }

            const addToCexInfo = (tokenName) => {
                const symbolClean = tokenName?.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const match = walletList.find(entry =>
                    entry.tokenName?.toUpperCase().replace(/[^A-Z0-9]/g, '') === symbolClean ||
                    entry.token?.toUpperCase().replace(/[^A-Z0-9]/g, '') === symbolClean
                );

                if (match) {
                    if (!cexInfo[cex]) cexInfo[cex] = {};
                    cexInfo[cex][symbolClean] = {
                        depo: !!match.depositEnable,
                        wd: !!match.withdrawEnable,
                        feewd: parseFloat(match.feeWDs || 0)
                    };
                    console.log(`✅ MATCHED: ${symbolClean} in ${key} | fee: ${match.feeWDs}, depo: ${match.depositEnable}, wd: ${match.withdrawEnable}`);
                } else {
                    console.warn(`❌ NOT FOUND: ${symbolClean} in ${key}`);
                }
            };

            // Cek token utama (symbol) & pasangannya (pairSymbol)
            addToCexInfo(symbol);
            if (pairSymbol) addToCexInfo(pairSymbol);
        }

        return {
            ...token,
            cexInfo: Object.keys(cexInfo).length > 0 ? cexInfo : token.cexInfo || {}
        };
    });

    try {
        localStorage.setItem("MULTIALL_TOKENS", JSON.stringify(tokenMultiUpdated));
        console.log("✅ MULTIALL_TOKENS updated:", tokenMultiUpdated);

        app.logAction(`UPDATE WALLETS`);
        setTimeout(() => {
            $('#loadingOverlay').fadeOut(200);
            alert("🎉 Update wallet berhasil! Halaman akan direfresh.");
            location.reload();
        }, 800);

    } catch (e) {
        $('#loadingOverlay').fadeOut(200);
        console.error("❌ Gagal menyimpan MULTIALL_TOKENS:", e);
        alert("❌ Gagal menyimpan MULTIALL_TOKENS: " + e.message);
    }
}

async function fetchBinance() {
    const { ApiKey, ApiSecret } = CONFIG_CEX.BINANCE;
    const timestamp = Date.now().toString();
    const queryString = `timestamp=${timestamp}`;
    const signature = calculateSignature("BINANCE", ApiSecret, queryString, "HmacSHA256");
    // bisa dibrowser
    const url = `https://proxykanan.awokawok.workers.dev/?https://api-gcp.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;
    
   // const originalUrl = `https://api3.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;
   // const url = withProxy(originalUrl); // 💡 gunakan proxy Vercel Anda

    const response = await $.ajax({
        url,
        headers: { "X-MBX-ApiKey": ApiKey },
        method: "GET"
    });

    const result = [];

    for (const item of response) {
        if (!item.trading || !Array.isArray(item.networkList)) continue;

        for (const net of item.networkList) {
            result.push({
                cex: "BINANCE",
                tokenName: item.coin,
                chain: net.network,
                feeWDs: parseFloat(net.withdrawFee || 0),
                depositEnable: !!net.depositEnable,
                withdrawEnable: !!net.withdrawEnable
            });
        }
    }

    console.log("✅ fetchBinance():", result.length, "items");
    return result;
}

async function fetchMexc() {
    const { ApiKey, ApiSecret } = CONFIG_CEX.MEXC;
    const timestamp = Date.now();
    const queryString = `recvWindow=5000&timestamp=${timestamp}`;
    const signature = calculateSignature("MEXC", ApiSecret, queryString);

    const url = `https://proxykiri.awokawok.workers.dev/?https://api.mexc.com/api/v3/capital/config/getall?${queryString}&signature=${signature}`;
    const response = await $.ajax({
        url,
        headers: { "X-MEXC-APIKEY": ApiKey },
        method: "GET"
    });

    const result = [];

    for (const item of response) {
        if (!Array.isArray(item.networkList)) continue;

        for (const net of item.networkList) {
            result.push({
                cex: "MEXC",
                tokenName: item.coin,
                chain: net.netWork,
                feeWDs: parseFloat(net.withdrawFee || 0),
                depositEnable: !!net.depositEnable,
                withdrawEnable: !!net.withdrawEnable
            });
        }
    }

    console.log("✅ fetchMexc():", result.length, "items");
    return result;
}

async function fetchGate() {
    const { ApiKey, ApiSecret } = CONFIG_CEX.GATE;
    const host = "https://proxykiri.awokawok.workers.dev/?https://api.gateio.ws";
    const timestamp = Math.floor(Date.now() / 1000);
    const method = "GET";
    const prefix = "/api/v4";

    const buildSignature = (url, body) => {
        const bodyHash = CryptoJS.SHA512(body).toString(CryptoJS.enc.Hex);
        const signString = `${method}\n${prefix}${url}\n\n${bodyHash}\n${timestamp}`;
        return CryptoJS.HmacSHA512(signString, ApiSecret).toString(CryptoJS.enc.Hex);
    };

    const headers = {
        KEY: ApiKey,
        SIGN: buildSignature("/wallet/withdraw_status", ""),
        Timestamp: timestamp
    };

    const wdData = await $.ajax({
        url: `${host}${prefix}/wallet/withdraw_status`,
        method,
        headers
    });

    const statusData = await $.ajax({
        url: `${host}${prefix}/spot/currencies`,
        method,
        headers
    });

    const result = [];

    for (const item of statusData) {
        if (!Array.isArray(item.chains)) continue;

        for (const chain of item.chains) {
            const feeItem = wdData.find(f =>
                f.currency?.toUpperCase() === item.currency?.toUpperCase() &&
                f.withdraw_fix_on_chains &&
                f.withdraw_fix_on_chains[chain.name]
            );

            result.push({
                cex: "GATEIO",
                tokenName: item.currency,
                chain: chain.name,
                feeWDs: feeItem ? parseFloat(feeItem.withdraw_fix_on_chains[chain.name]) : 0,
                depositEnable: !chain.deposit_disabled,
                withdrawEnable: !chain.withdraw_disabled
            });
        }
    }

    console.log("✅ fetchGate():", result.length, "items");
    return result;
}

// Export for use in main application
window.CEXAPIs = CEXAPIs;
window.DEXAPIs = DEXAPIs;
window.PriceUtils = PriceUtils;

