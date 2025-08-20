     // fungsi dapatkan harga token dari Exchanger
    function getPriceCEX(coins, NameToken, NamePair, cex, callback) {
        const config = exchangeConfig[cex];
        if (!config) {
            callback(`Exchange ${cex} tidak ditemukan dalam konfigurasi.`, null);
            return;
        }

        const feeList = getFromLocalStorage("TOKEN_SCANNER", []);
        if (!Array.isArray(feeList) || feeList.length === 0) {
            toastr.error("PERIKSA ULANG FEE WD dari EXCHANGER !!");
            callback("Token scanner belum diatur.", null);
            return;
        }

        const tokenData = feeList.find(item =>
            item.symbol_in === NameToken && item.symbol_out === NamePair && item.cex === cex
        );

        const isStablecoin = (token) => stablecoins.includes(token);
        let results = {};

        const urls = [
            isStablecoin(NameToken) ? null : config.url({ symbol: NameToken }),
            isStablecoin(NamePair) ? null : config.url({ symbol: NamePair })
        ];

        const processFinalResult = () => {
            if (Object.keys(results).length === 2) {
                const priceBuyToken = results[NameToken]?.price_buy || 0;
                const priceBuyPair = results[NamePair]?.price_buy || 0;

                const feeWDToken = parseFloat(tokenData?.feeWDToken || 0) * priceBuyToken;
                const feeWDPair = parseFloat(tokenData?.feeWDPair || 0) * priceBuyPair;

                if (isNaN(feeWDToken) || feeWDToken < 0) {
                    callback(`FeeWD untuk ${NameToken} di ${cex} tidak valid: ${feeWDToken}`, null);
                    return;
                }
                if (isNaN(feeWDPair) || feeWDPair < 0) {
                    callback(`FeeWD untuk ${NamePair} di ${cex} tidak valid: ${feeWDPair}`, null);
                    return;
                }

                const finalResult = {
                    token: NameToken.toUpperCase(),
                    sc_input: coins.sc_in,
                    sc_output: coins.sc_out,
                    pair: NamePair.toUpperCase(),
                    cex: cex.toUpperCase(),
                    price_sellToken: results[NameToken]?.price_sell || 0,
                    price_buyToken: priceBuyToken,
                    price_sellPair: results[NamePair]?.price_sell || 0,
                    price_buyPair: priceBuyPair,
                    volumes_sellToken: results[NameToken]?.volumes_sell || [],
                    volumes_buyToken: results[NameToken]?.volumes_buy || [],
                    volumes_sellPair: results[NamePair]?.volumes_sell || [],
                    volumes_buyPair: results[NamePair]?.volumes_buy || [],
                    feeWDToken: feeWDToken,
                    feeWDPair: feeWDPair
                };

                updateTableVolCEX({}, finalResult, cex);
                callback(null, finalResult);
            }
        };

        urls.forEach((url, index) => {
            const tokenName = index === 0 ? NameToken : NamePair;
            if (isStablecoin(tokenName)) {
                results[tokenName] = {
                    price_sell: 1,
                    price_buy: 1,
                    volumes_sell: Array(3).fill({ price: 1, volume: 10000 }),
                    volumes_buy: Array(3).fill({ price: 1, volume: 10000 })
                };
                processFinalResult();
                return;
            }

            if (url) {
                $.ajax({
                    url: url,
                    method: 'GET',
                    success: function (data) {
                        let processedData;
                        try {
                            processedData = config.processData(data);
                        } catch (error) {
                            console.error(`Error processing data untuk ${tokenName} di ${cex}:`, error);
                            callback(`Error processing data untuk ${tokenName} di ${cex}.`, null);
                            return;
                        }

                        const isIndodax = cex.toLowerCase() === "indodax";
                        let priceBuy, priceSell, volumesBuy, volumesSell;

                        if (isIndodax) {
                            priceBuy = processedData?.priceSell?.[2]?.price || 0;
                            priceSell = processedData?.priceBuy?.[2]?.price || 0;
                            volumesBuy = processedData?.priceSell || [];
                            volumesSell = processedData?.priceBuy || [];
                        } else {

                            // Urutkan data harga dan volume
                            volumesBuy = (processedData?.priceBuy || []).sort((a, b) => b.price - a.price);   // beli → tertinggi ke rendah
                            volumesSell = (processedData?.priceSell || []).sort((a, b) => a.price - b.price); // jual → terendah ke tinggi

                            // Ambil harga berdasarkan urutan yang sudah benar
                            priceBuy = volumesBuy[2]?.price || 0;
                            priceSell = volumesSell[2]?.price || 0;

                        }

                        if (priceBuy <= 0 || priceSell <= 0) {
                            callback(`Harga tidak valid untuk ${tokenName} di ${cex}.`, null);
                            return;
                        }

                        results[tokenName] = {
                            price_sell: priceSell,
                            price_buy: priceBuy,
                            volumes_sell: processedData?.priceBuy || [],
                            volumes_buy: processedData?.priceSell || []
                        };

                        processFinalResult();
                    },
                    error: function (xhr) {
                        const errorMessage = xhr.responseJSON?.msg || "Unknown ERROR";
                        callback(`Error koneksi API untuk ${tokenName} di ${cex}: ${errorMessage}`, null);
                    }
                });
            }
        });
    }

    function updateTableVolCEX(processedData, finalResult, cex) {
        const cexName = cex.toUpperCase();
        const TokenPair = finalResult.token + "_" + finalResult.pair;
        const isIndodax = cexName === 'INDODAX';

        const getPriceIDR = priceUSDT => {
            const rateIDR = getFromLocalStorage("PriceRateUSDT", 0);
            return rateIDR ? (priceUSDT * rateIDR).toLocaleString("id-ID", { style: "currency", currency: "IDR" }) : "N/A";
        };

        // LEFT: token → pair
        const volumesBuyToken = isIndodax
            ? finalResult.volumes_buyToken.slice().sort((a, b) => b.price - a.price)
            : finalResult.volumes_buyToken.slice().sort((a, b) => b.price - a.price); // harga besar → kecil

        const volumesSellPair = isIndodax
            ? finalResult.volumes_sellPair
            : finalResult.volumes_sellPair; // harga kecil → besar

        // RIGHT: pair → token
        const volumesBuyPair = isIndodax
            ? finalResult.volumes_buyPair.slice().sort((a, b) => b.price - a.price) // harga besar → kecil
            : finalResult.volumes_buyPair.slice().sort((a, b) => b.price - a.price); 

        const volumesSellToken = isIndodax
            ? finalResult.volumes_sellToken
            : finalResult.volumes_sellToken.slice().sort((a, b) => b.price - a.price); // harga besar → kecil

        $('#LEFT_' + cexName + '_' + TokenPair + '_' + DTChain.Nama_Chain.toUpperCase()).html(
            volumesBuyToken.map(data => `
                <span class='uk-text-success' title="IDR: ${getPriceIDR(data.price)}">
                    ${formatPrice(data.price || 0)} : <b>${data.volume.toFixed(2) || 0}$</b><br/>
                </span>
            `).join('') +
            `<span class='uk-text-primary uk-text-bolder'>${finalResult.token} -> ${finalResult.pair}</span><br/>` +
            volumesSellPair.map(data => `
                <span class='uk-text-danger' title="IDR: ${getPriceIDR(data.price)}">
                    ${formatPrice(data.price || 0)} : <b>${data.volume.toFixed(2) || 0}$</b><br/>
                </span>
            `).join('')
        );

        $('#RIGHT_' + cexName + '_' + TokenPair + '_' + DTChain.Nama_Chain.toUpperCase()).html(
            volumesBuyPair.map(data => `
                <span class='uk-text-success' title="IDR: ${getPriceIDR(data.price)}">
                    ${formatPrice(data.price || 0)} : <b>${data.volume.toFixed(2) || 0}$</b><br/>
                </span>
            `).join('') +
            `<span class='uk-text-primary uk-text-bolder'>${finalResult.pair} -> ${finalResult.token}</span><br/>` +
            volumesSellToken.map(data => `
                <span class='uk-text-danger' title="IDR: ${getPriceIDR(data.price)}">
                    ${formatPrice(data.price || 0)} : <b>${data.volume.toFixed(2) || 0}$</b><br/>
                </span>
            `).join('')
        );
    }
    // Fungsi untuk mengecek harga pada DEX  
    function generateDexLink(dex, NameToken, sc_input, NamePair, sc_output) {
        const link = {
            'kyberswap': `https://kyberswap.com/swap/${DTChain.Nama_Chain}/${sc_input}-to-${sc_output}`,
            'kana': `https://app.paraswap.xyz/#/swap/${sc_input}-${sc_output}?version=6.2&network=${DTChain.Nama_Chain}`,
            'odos': "https://app.odos.xyz",
            '0x': DTChain.Nama_Chain.toLowerCase() === 'solana' 
                ? `https://matcha.xyz/tokens/solana/${sc_input}?sellChain=1399811149&sellAddress=${sc_output}` 
                : `https://matcha.xyz/tokens/${DTChain.Nama_Chain}/${sc_input.toLowerCase()}?buyChain=${DTChain.Kode_Chain}&buyAddress=${sc_output.toLowerCase()}`,
            '1inch': ` https://app.1inch.io/advanced/swap?network=${DTChain.Kode_Chain}&src=${sc_input.toUpperCase()}&dst=${sc_output.toUpperCase()}`,
          // '1inch': `https://app.1inch.io/#/${DTChain.Kode_Chain}/advanced/swap/${sc_input}/${sc_output}`,
            'okx': `https://www.okx.com/web3/dex-swap?inputChain=${DTChain.Kode_Chain}&inputCurrency=${sc_input}&outputChain=501&outputCurrency=${sc_output}`,
            'magpie': `https://app.magpiefi.xyz/swap/${DTChain.Nama_Chain.toLowerCase()}/${NameToken.toUpperCase()}/${DTChain.Nama_Chain.toLowerCase()}/${NamePair.toUpperCase()}`,
            'paraswap': `https://app.paraswap.xyz/#/swap/${sc_input}-${sc_output}?version=6.2&network=${DTChain.Nama_Chain}`,
            'openocean' : `https://app.openocean.finance/swap/${DTChain.Nama_Chain}/${sc_input}/${sc_output}`,
            'jupiter': `https://jup.ag/swap/${sc_input}-${sc_output}`,
            'lifi' : `https://jumper.exchange/?fromChain=${DTChain.Kode_Chain}&fromToken=${sc_input}&toChain=${DTChain.Kode_Chain}&toToken=${sc_output}`,
        };
        return link[dex] || null;
    }

    function getPriceDEX(sc_input_in, des_input, sc_output_in, des_output, amount_in, PriceRate,  dexType, NameToken, NamePair, cex,action, callback) {
        var selectedServer = getRandomServerFromCORSList();
        var sc_input=sc_input_in.toLowerCase();
        var sc_output=sc_output_in.toLowerCase();
        var dexId = `${cex}_${dexType.toUpperCase()}_${NameToken}_${NamePair}_${(DTChain.Nama_Chain).toUpperCase()}`;
        var SavedSettingData = getFromLocalStorage('DATA_SETTING', {});
        var selectedApiKey = getRandomApiKeyOKX();
        var amount_in = BigInt(Math.round(Math.pow(10, des_input) * amount_in));
        var apiUrl, requestData,headers;   
        var linkDEX = generateDexLink(dexType, NameToken, sc_input_in, NamePair, sc_output_in);
      
        switch (dexType) {
            case 'kyberswap':
                    let NetChain;
                    if (DTChain.Nama_Chain.toUpperCase() === "AVAX") {
                        NetChain = "avalanche";
                    }else{
                        NetChain=DTChain.Nama_Chain;
                    }
                    

             //    if (action === "TokentoPair") {
                    apiUrl = "https://aggregator-api.kyberswap.com/" + NetChain.toLowerCase() + "/api/v1/routes?tokenIn=" + sc_input + "&tokenOut=" + sc_output + "&amountIn=" + amount_in+ "&gasInclude=true";
                //  } else if (action === "PairtoToken") {
                //     if(DTChain.Kode_Chain==1){
                //         apiUrl = `https://api.zeroswap.io/quote/kyberswap?fromChain=${DTChain.Kode_Chain}&fromTokenAddress=${sc_input}&toTokenAddress=${sc_output}&fromTokenDecimals=${des_input}&toTokenDecimals=${des_output}&sellAmount=${amount_in}&slippage=0.3`;
                //     }else{
                //         apiUrl = "https://aggregator-api.kyberswap.com/" + NetChain.toLowerCase() + "/api/v1/routes?tokenIn=" + sc_input + "&tokenOut=" + sc_output + "&amountIn=" + amount_in+ "&gasInclude=true";
                //     }
                // }    
                break;
            
            case '1inch':
                // apiUrl = "https://1inch-nginx-proxy.vercel.app/swap/v6.1/"+ DTChain.Kode_Chain +"/quote?src="+sc_input+"&dst="+ sc_output +"&amount="+amount_in;
                if (action === "TokentoPair") {
                    apiUrl = "https://api.dzap.io/v1/quotes"; 
                    
                    requestData = {
                        account: SavedSettingData.walletMeta || '0x0000000000000000000000000000000000000000',
                        fromChain: DTChain.Kode_Chain,
                        integratorId: 'dzap', // opsional
                        allowedSources: ["oneInchViaLifi"],
                        notAllowedSources: [],
                        data: [{
                            amount: amount_in.toString(),
                            srcToken: sc_input,
                            srcDecimals: des_input, // kamu harus ambil dari metadata token
                            destToken: sc_output,
                            destDecimals: des_output, // ambil dari metadata juga
                            slippage: 0.3,
                            toChain: DTChain.Kode_Chain
                        }]
                    };
 
                } else if (action === "PairtoToken") {
                    apiUrl = "https://api-v1.marbleland.io/api/v1/jumper/api/p/lifi/advanced/routes";   
                    
                    requestData = {
                        fromAmount: amount_in.toString(),
                        fromChainId: DTChain.Kode_Chain,
                        fromTokenAddress: sc_input,
                        toChainId: DTChain.Kode_Chain,
                        toTokenAddress: sc_output,
                        options: {
                            integrator: "swap.marbleland.io",
                            order: "CHEAPEST",
                            maxPriceImpact: 0.4,
                            allowSwitchChain: false,
                            bridges: {
                                deny: [
                                    "hop", "cbridge", "optimism", "arbitrum", "across", "omni", "celercircle", "allbridge",
                                    "thorswap", "symbiosis", "squid", "mayan", "mayanWH", "mayanMCTP", "relay", "polygon",
                                    "glacis", "stargateV2", "stargateV2Bus", "chainflip"
                                ]
                            },
                            exchanges: {
                                allow: ["1inch"]
                            }
                        }
                    };

                }
                break;

            case 'lifi':
                 if (action === "TokentoPair") {
                    // Menggunakan MARBLE API (tidak membatasi hanya ke "1inch")
                    apiUrl = "https://api-v1.marbleland.io/api/v1/jumper/api/p/lifi/advanced/routes";

                    requestData = {
                        fromAmount: amount_in.toString(),
                        fromChainId: DTChain.Kode_Chain,
                        fromTokenAddress: sc_input,
                        toChainId: DTChain.Kode_Chain,
                        toTokenAddress: sc_output,
                        options: {
                            integrator: "swap.marbleland.io",
                            order: "CHEAPEST",
                            maxPriceImpact: 0.4,
                            allowSwitchChain: false,
                            bridges: {
                                deny: [
                                    "hop", "cbridge", "optimism", "arbitrum", "across", "omni", "celercircle", "allbridge",
                                    "thorswap", "symbiosis", "squid", "mayan", "mayanWH", "mayanMCTP", "relay", "polygon",
                                    "glacis", "stargateV2", "stargateV2Bus", "chainflip"
                                ]
                            },
                            // Tidak ada exchanges.allow → biarkan Marble memilih semua DEX terbaik
                            // Jika ingin eksplisit: hapus properti 'exchanges' atau biarkan kosong
                        }
                    };
                }else if (action === "PairtoToken") {
                    // Menggunakan DZAP API (tidak membatasi ke "1inch" saja)
                    apiUrl = "https://api.dzap.io/v1/quotes";
                    
                    requestData = {
                        account: SavedSettingData.walletMeta || '0x0000000000000000000000000000000000000000',
                        fromChain: DTChain.Kode_Chain,
                        integratorId: 'dzap',
                        allowedSources: [ // biarkan semua source aktif (tanpa dibatasi hanya "1inch")
                            "bebop", "enso", "iceCreamSwap", "izumi", "kyberSwap", "lifi", "magpie",
                            "odos", "okx", "oneInchViaLifi", "openOcean", "paraSwap", "sushiswap",
                            "synapse", "uniswap", "unizen", "vaporDex", "woodSwap", "xyFinance",
                            "zerox", "orbiter", "relayLink", "mayanFinance", "jupiter"
                        ],
                        notAllowedSources: [],
                        data: [{
                            amount: amount_in.toString(),
                            srcToken: sc_input,
                            srcDecimals: des_input,  // ← ambil dari metadata token
                            destToken: sc_output,
                            destDecimals: des_output, // ← ambil dari metadata token
                            slippage: 0.3,
                            toChain: DTChain.Kode_Chain
                        }]
                    };
                    
                } 

                break;

            case 'odos':
                 if (action === "TokentoPair") {
                    apiUrl = "https://ethmainnet.server.hinkal.pro/OdosSwapData";
                    requestData = {
                        chainId: DTChain.Kode_Chain,
                        compact: true,
                        disableRFQs: true,
                        userAddr: SavedSettingData.walletMeta,
                        inputTokens: [{ amount: amount_in.toString(), tokenAddress: sc_input }],
                        outputTokens: [{ proportion: 1, tokenAddress: sc_output }],
                        slippageLimitPercent: 0.3,
                    }; 
                 } else if (action === "PairtoToken") {
                    // apiUrl = "https://bzvwrjfhuefn.up.railway.app/swap";               
                   //  var amount_in = BigInt(Math.round(Number(amount_in)));
                    
                    // var requestData = {
                    //     "chainId": DTChain.Kode_Chain,
                    //     "aggregatorSlug": 'odos',
                    //     "sender": SavedSettingData.walletMeta,
                    //     "inToken": {
                    //         "chainId": DTChain.Kode_Chain,
                    //         "type": "TOKEN",
                    //         "address": sc_input.toLowerCase(),
                    //         "decimals": parseFloat(des_input)
                    //     },
                    //     "outToken": {
                    //         "chainId": DTChain.Kode_Chain,
                    //         "type": "TOKEN",
                    //         "address": sc_output.toLowerCase(),
                    //         "decimals": parseFloat(des_output)
                    //     },
                    //     "amountInWei": String(amount_in),
                    //     "slippageBps": "100",
                    //     "gasPriceGwei": Number(getFromLocalStorage('gasGWEI', 0)),
                    // };
                    
                    apiUrl = "https://api.odos.xyz/sor/quote/v3";               
                    requestData = {
                        chainId: DTChain.Kode_Chain,
                        compact: true,
                        disableRFQs: true,
                        userAddr: SavedSettingData.walletMeta,
                        inputTokens: [{ amount: amount_in.toString(), tokenAddress: sc_input }],
                        outputTokens: [{ proportion: 1, tokenAddress: sc_output }],
                        slippageLimitPercent: 0.3,
                    };         
                    
                 }
                 break;

            case '0x':           
                if(DTChain.Nama_Chain.toLowerCase() === 'solana'){
                    apiUrl = selectedServer+"https://matcha.xyz/api/swap/quote/solana?sellTokenAddress="+sc_input_in+"&buyTokenAddress="+sc_output_in+"&sellAmount="+amount_in+"&dynamicSlippage=true&slippageBps=50&userPublicKey=Eo6CpSc1ViboPva7NZ1YuxUnDCgqnFDXzcDMDAF6YJ1L";
                }else{
                    apiUrl = "https://matcha.xyz/api/swap/price?chainId=" + DTChain.Kode_Chain +"&buyToken=" + sc_output + "&sellToken=" + sc_input + "&sellAmount=" + amount_in ;
                }
                break;
                
            case 'okx':
                var timestamp = new Date().toISOString();
                var method = "GET";

                var path = "/api/v5/dex/aggregator/quote";
                var queryParams = `amount=${amount_in}` +
                                `&chainIndex=${DTChain.Kode_Chain}` +
                                `&fromTokenAddress=${sc_input_in}` +
                                `&toTokenAddress=${sc_output_in}`;

                var dataToSign = timestamp + method + path + "?" + queryParams;
                var signature = calculateSignature("OKX", selectedApiKey.secretKeyOKX, dataToSign, "BASE64");

                apiUrl = `https://web3.okx.com${path}?${queryParams}`;
                break;


            case 'jupiter':
                apiUrl = "https://quote-api.jup.ag/v6/quote?inputMint=" + sc_input_in + "&outputMint=" + sc_output_in + "&amount=" + amount_in;
                headers = {}; // Tidak memerlukan header khusus
                break; 
            

            default:
                console.error("Unsupported DEX type");
                return;
        }

            // Siapkan URL dan data sebelumnya (misalnya: apiUrl, requestData, signature, timestamp, selectedApiKey)
        $.ajax({
            url: apiUrl,
            method: ['odos', '1inch', 'lifi'].includes(dexType) ? 'POST' : 'GET',

            headers: Object.assign(
                {},
                headers || {},
                dexType === 'okx' ? {
                    "OK-ACCESS-KEY": selectedApiKey.ApiKeyOKX,
                    "OK-ACCESS-SIGN": signature,
                    "OK-ACCESS-PASSPHRASE": selectedApiKey.PassphraseOKX,
                    "OK-ACCESS-TIMESTAMP": timestamp,
                    "Content-Type": "application/json"
                } : {}
            ),

            data: ['odos', '1inch', 'lifi'].includes(dexType)
                ? JSON.stringify(requestData)  // Untuk DEX POST seperti ODOS, 1inch, dll
                : undefined, // Untuk GET seperti OKX
            contentType: ['odos', '1inch', 'lifi'].includes(dexType)
                ? 'application/json'
                : undefined,
          //  timeout: parseInt(SavedSettingData.waktuTunggu) * 1000, // Ambil waktu tunggu dari localStorage atau default ke 0
            success: function (response, xhr) {
                //console.log("RESPONSE DEX: ",response)
                var amount_out = null, FeeSwap = null; // Default kosong
                try {
                        switch (dexType) {
                            case 'kyberswap':
                                dexTitle="KYBESWAP";
                              //  if (action === "TokentoPair") {
                                    amount_out = response.data.routeSummary.amountOut / Math.pow(10, des_output);
                                    FeeSwap =  parseFloat(response.data.routeSummary.gasUsd);
                                // }  else if (action === "PairtoToken") {
                                //     if(DTChain.Kode_Chain==1){
                                //         const estimation = response.quote.estimation;
                                //         // Hitung amount_out dari buyAmount, sesuaikan dengan desimal token output
                                //         amount_out = parseFloat(estimation.buyAmount) / Math.pow(10, des_output);

                                //         // Estimasi fee swap, misalnya dari gasPrice dan estimatedGas
                                //         const gasPriceGwei = parseFloat(response.quote.tx.gasPrice); // dalam wei
                                //         const estimatedGas = parseFloat(response.quote.tx.estimatedGas);

                                //         // Konversi gas fee ke USD jika ada estimasi (anggap kamu punya harga ETH to USD jika perlu)
                                //         // Tapi jika pakai langsung dari API Zero, bisa pakai nilai `gasUsd` jika ada, atau manual:
                                //         FeeSwap = (gasPriceGwei * estimatedGas) / 1e18; // ETH
                                //         // Kalau kamu punya ethPriceUsd:
                                //         // FeeSwap = (gasPriceGwei * estimatedGas / 1e18) * ethPriceUsd;
                                //     }else{
                                //          amount_out = response.data.routeSummary.amountOut / Math.pow(10, des_output);
                                //          FeeSwap =  parseFloat(response.data.routeSummary.gasUsd);
                                //     }
                                    
                                // }

                                break;
                            
                            case 'odos':
                                dexTitle="ODOS";
                                if (action === "TokentoPair") {
                                   amount_out = parseFloat(response.odosResponse.outValues[0]) / PriceRate; 
                                   FeeSwap = response.odosResponse.gasEstimateValue;
                                } 
                                 else if (action === "PairtoToken") { 
                                    amount_out = parseFloat(response.outAmounts) / Math.pow(10, des_output);
                                    FeeSwap = response.gasEstimateValue;   
                                  
                                   // from swoop  
                                  //  amount_out = parseFloat(response.amountOutWei) / Math.pow(10, des_output);
                                  //  FeeSwap = ((parseFloat(getFromLocalStorage('gasGWEI')) * 250000) / Math.pow(10, 9))*parseFloat(getFromLocalStorage('PRICEGAS'));

                                }   
                                
                                break;

                            case '1inch':
                                dexTitle="1INCH";
                                if (action === "TokentoPair") {
                                    const key = Object.keys(response)[0];
                                    const quoteData = response[key]?.quoteRates?.oneInchViaLifi;

                                    if (quoteData) {
                                        amount_out = parseFloat(quoteData.destAmount / Math.pow(10, des_output));

                                        const gasFee = quoteData.fee?.gasFee?.[0]?.amountUSD || "0";
                                        FeeSwap = parseFloat(gasFee); // sudah dalam USD
                                    } else {
                                        throw new Error("Quote data for 1inch via Dzap not found");
                                    }
                                } else if (action === "PairtoToken") { 
                                    const quoteData = response.routes?.[0];

                                    if (quoteData) {
                                        amount_out = parseFloat(quoteData.toAmount / Math.pow(10, des_output));

                                        const gasFee = quoteData.gasCostUSD || "0";
                                        FeeSwap = parseFloat(gasFee); // sudah dalam USD
                                    } else {
                                        throw new Error("Quote data for 1inch via Marble not found");
                                    }
                                }
                             break;

                            case '0x':
                                // Konversi buyAmount ke satuan desimal (jumlah token yang diterima)
                                amount_out = response.buyAmount / Math.pow(10, des_output);
                                dexTitle="0X";
                                if (DTChain.Nama_Chain.toLowerCase() === 'solana') {
                                    // Jika jaringan adalah Solana, fee berasal dari totalNetworkFee (dalam lamport)
                                    let feeLamport = Number(response.totalNetworkFee || 0); // fallback jika null
                                    FeeSwap =( feeLamport / 1e9)* parseFloat(getFromLocalStorage('PRICEGAS', 0)); // konversi lamport ke SOL
                                    
                                } else {
                                    const gasUsed = parseFloat(response.gas); // contoh: 164208
                                    const gasPriceGwei = parseFloat(response.gasPrice) / 1e9; // dari wei → gwei
                                    const PRICEGAS = parseFloat(getFromLocalStorage('PRICEGAS', 0)); // harga ETH (USD)

                                     FeeSwap = (gasUsed * gasPriceGwei) / 1e9 * PRICEGAS;
                                   // FeeSwap = (response.gas / 1e9) * parseFloat(getFromLocalStorage('PRICEGAS', 0)); // hasil dalam native coin (ETH, BNB, dll.)
                                }
                                break;

                            case 'okx':
                                dexTitle="0KX";
                                amount_out = response.data[0].toTokenAmount / Math.pow(10, des_output);
                                FeeSwap = (response.data[0].estimateGasFee / Math.pow(10, 9)) * parseFloat(getFromLocalStorage('gasGWEI', 0)) * parseFloat(getFromLocalStorage('PRICEGAS', 0));            
                                break;  

                            case 'lifi':
                                if (action === "TokentoPair") {
                                    const routes = response.routes;

                                    if (!routes || !Array.isArray(routes)) {
                                        console.error("Respon Marble tidak sesuai format:", response);
                                        throw new Error("Format response Marble tidak sesuai");
                                    }

                                    let bestQuote = null;
                                    let bestAmount = 0;

                                    for (const route of routes) {
                                        if (route?.toAmount) {
                                            const amount = parseFloat(route.toAmount) / Math.pow(10, des_output);
                                            if (amount > bestAmount) {
                                                bestAmount = amount;
                                                bestQuote = route;
                                            }
                                        }
                                    }

                                    if (bestQuote) {
                                        amount_out = bestAmount;
                                        FeeSwap = parseFloat(bestQuote.gasCostUSD || "0");
                                        // Ambil nama tool dan susun title
                                        const toolName = bestQuote.steps?.[0]?.tool || "unknown";
                                        dexTitle = `${toolName} via LIFI`;
                                    } else {
                                        console.error("Respon Marble valid tapi tidak ada quote terbaik:", response);
                                        throw new Error("Quote terbaik via Marble tidak ditemukan");
                                    }

                                } else if (action === "PairtoToken") {
                                    const key = Object.keys(response)[0]; // contoh: 'USDT_ETH'
                                    const quoteSources = response[key]?.quoteRates;

                                    if (!quoteSources || typeof quoteSources !== 'object') {
                                        console.error("Respon DZAP tidak sesuai format:", response);
                                        throw new Error("Format response DZAP tidak sesuai");
                                    }

                                    let bestQuote = null;
                                    let bestAmount = 0;

                                    for (const [source, data] of Object.entries(quoteSources)) {
                                        // Pastikan destAmount valid
                                        if (data?.destAmount && !isNaN(data.destAmount)) {
                                            const amount = parseFloat(data.destAmount) / Math.pow(10, des_output);
                                            if (!isNaN(amount) && amount > bestAmount) {
                                                bestAmount = amount;
                                                bestQuote = data;
                                            }
                                        }
                                    }

                                    if (bestQuote) {
                                        amount_out = bestAmount;

                                        // Ambil gas fee dengan validasi aman
                                        const gasFeeUSD = bestQuote?.fee?.gasFee?.[0]?.amountUSD;
                                        FeeSwap = isNaN(parseFloat(gasFeeUSD)) ? 0 : parseFloat(gasFeeUSD);
                                          // Buat dexTitle: nama DEX via DZAP
                                        const dexName = response[key]?.recommendedSource || bestSource || "unknown";
                                        dexTitle = `${dexName} via DZAP`;

                                    } else {
                                        console.error("Respon DZAP valid tapi tidak ada quote terbaik:", response);
                                        throw new Error("Quote terbaik via DZAP tidak ditemukan");
                                    }
                                }

                                break;

                        default:
                            throw new Error(`DEX type ${dexType} not supported.`);
                        }
                
                        const result = {
                            dexTitle: dexTitle,
                            sc_input: sc_input,
                            des_input: des_input,
                            sc_output: sc_output,
                            des_output: des_output,
                            FeeSwap: FeeSwap,
                            amount_out: amount_out,
                            apiUrl: apiUrl,
                        };

                        callback(null, result);
                    } catch (error) {
                        callback({
                            statusCode: 500,
                            pesanDEX: `Error DEX : ${error.message}`,
                            color: "#ffe0e6",
                            DEX: dexType.toUpperCase(),
                        }, null);
                    }
            },
            
            error: function (xhr) {
                var alertMessage = "Terjadi kesalahan";
                var warna = "#ffe0e6";
                switch (xhr.status) {
                    case 0:  
                        if(dexType=='kyberswap' || dexType =='odos' ||  dexType == '0x'){
                            alertMessage = "KENA LIMIT";
                        }
                            else{
                            alertMessage = "NULL RESPONSE";
                        }
                        break;                        
                    case 400:
                        try { 
                            var errorResponse = JSON.parse(xhr.responseText);
                            if (
                                (errorResponse.description && errorResponse.description.toLowerCase().includes("insufficient liquidity")) || 
                                (errorResponse.error && errorResponse.error.toLowerCase().includes("no routes found with enough liquidity"))
                            ) {
                                alertMessage = "NO LP (No Liquidity Provider)";
                                warna = "#ffe0e6";
                            } else {
                                alertMessage = errorResponse.detail || errorResponse.description || errorResponse.error || "KONEKSI BURUK";
                            }
                        } catch (e) {
                            alertMessage = "KONEKSI LAMBAT"; // Jika parsing gagal
                        }
                    break;
                    case 401:
                        alertMessage = "API SALAH";
                        break;
                    case 403:
                        alertMessage = "AKSES DIBLOK";
                        warna = "#fff";
                        break;
                    case 404:
                        alertMessage = "Permintaan tidak ditemukan";
                        break ;
                    case 429:
                            warna = "#ffe0e6";
                            alertMessage = "AKSES KENA LIMIT";
                        break;
                    case 500:
                        try {
                            var errorResponse = JSON.parse(xhr.responseText);
                            if (errorResponse.msg && errorResponse.msg.toLowerCase().includes("too many requests")) {
                                alertMessage = "AKSES KENA LIMIT (500 Too Many Requests)";
                                warna = "#ffe0e6";
                            } else {
                                alertMessage = errorResponse.detail || "GAGAL DAPATKAN DATA";
                            }
                        } catch (e) {
                            alertMessage = "GAGAL DAPATKAN DATA";
                        }
                        break;
                    case 503:
                        alertMessage = "Layanan tidak tersedia";
                        break;
                    case 502:
                        alertMessage = "Respons tidak valid";
                        break;
                    default:
                        warna = "#ffe0e6";
                        alertMessage = "Status: " + xhr.status;
                }
                $(`#SWAP_${dexId}`).html(`<a href="${linkDEX}" title="${dexType.toUpperCase()}: ${alertMessage}" target="_blank" class="uk-text-danger"><i class="bi bi-x-circle"></i> ${dexType.toUpperCase()} </a>`);

                callback({ 
                    statusCode: xhr.status, 
                    pesanDEX:`${dexType.toUpperCase()}: ${alertMessage}`,
                    color: warna, 
                    DEX: dexType.toUpperCase(),
                    dexURL: linkDEX 
                }, null);
            }, 
        });
    }
    
    // Fungsi untuk mengecek harga pada SWOOP
    function getPriceSWOOP(sc_input, des_input, sc_output, des_output, amount_in, PriceRate,  dexType, NameToken, NamePair, cex,action, callback) {
        // Mengambil data setting dari localStorage
        var SavedSettingData = getFromLocalStorage('DATA_SETTING', {});
        var dexId = `${cex}_${dexType.toUpperCase()}_${NameToken}_${NamePair}_${(DTChain.Nama_Chain).toUpperCase()}`;
       // var amount_in = Math.pow(10, des_input) * amount_in;
        var amount_in = BigInt(Math.round(Number(amount_in)));

        var dexURL = generateDexLink(dexType, NameToken, sc_input, NamePair, sc_output);
        
        var payload = {
            "chainId": DTChain.Kode_Chain,
            "aggregatorSlug": dexType.toLowerCase(),
            "sender": SavedSettingData.walletMeta,
            "inToken": {
                "chainId": DTChain.Kode_Chain,
                "type": "TOKEN",
                "address": sc_input.toLowerCase(),
                "decimals": parseFloat(des_input)
            },
            "outToken": {
                "chainId": DTChain.Kode_Chain,
                "type": "TOKEN",
                "address": sc_output.toLowerCase(),
                "decimals": parseFloat(des_output)
            },
            "amountInWei": String(amount_in),
            "slippageBps": "100",
            "gasPriceGwei": Number(getFromLocalStorage('gasGWEI', 0)),
        };
    
        $.ajax({
            url:'https://bzvwrjfhuefn.up.railway.app/swap',

            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (response) {
                    var amount_out = parseFloat(response.amountOutWei) / Math.pow(10, des_output);
                    var FeeSwap = ((parseFloat(getFromLocalStorage('gasGWEI')) * 250000) / Math.pow(10, 9))*parseFloat(getFromLocalStorage('PRICEGAS'));
                    const result = {
                            dexTitle: dexType+" via SWOOP",
                            sc_input: sc_input,
                            des_input: des_input,
                            sc_output: sc_output,
                            des_output: des_output,
                            FeeSwap: FeeSwap,
                            dex: dexType,
                            amount_out: amount_out,
                        };
                        callback(null, result);
                    },
            error: function (xhr) {
                var alertMessage = "Terjadi kesalahan";
                var warna = "#ffe0e6";
            
                switch (xhr.status) {
                    case 0:
                        alertMessage = "NO RESPONSE";
                        break;
                    case 400:
                        try {
                            var errorResponse = JSON.parse(xhr.responseText);
                            alertMessage = errorResponse.detail || errorResponse.description || "KONEKSI BURUK";
                        } catch (e) {
                            alertMessage = "KONEKSI LAMBAT"; // Jika parsing gagal
                        }
                        break;
                    case 403:
                        alertMessage = "AKSES DIBLOK";
                        break;
                    case 404:
                        alertMessage = "Permintaan tidak ditemukan";
                        break;
                    case 429:
                       alertMessage = "AKSES KENA LIMIT";
                        break;
                    case 500:
                        try {
                            var errorResponse = JSON.parse(xhr.responseText);
                            alertMessage = errorResponse.message || "GAGAL DAPATKAN DATA";
                        } catch (e) {
                            alertMessage = "GAGAL DAPATKAN DATA"; // Jika parsing gagal
                        }
                        break;
                    case 503:
                        alertMessage = "Layanan tidak tersedia";
                        break;
                    case 502:
                        alertMessage = "Respons tidak valid";
                        break;
                    default:
                        warna = "#ffe0e6";
                        alertMessage = "Status: " + xhr.status;
                }

//                $(`#SWAP_${dexId}`).html(`<a href="${dexURL}" title="${dexType.toUpperCase()}: ${alertMessage}" target="_blank" class="uk-text-danger"><i class="bi bi-x-circle"></i> ${dexType.toUpperCase()} </a>`);

                // Kirim callback untuk penanganan lebih lanjut
                callback({ 
                    statusCode: xhr.status, 
                    pesanDEX: "SWOOP: "+alertMessage, 
                    color: warna, 
                    DEX: dexType.toUpperCase(), 
                    dexURL: dexURL 
                }, null);
            }
            
        });
    }

    // Fungsi untuk mengecek harga pada RANGO
    function getPriceRANGO(sc_input, des_input, sc_output, des_output, amount_in, PriceRate,dexType, NameToken,  NamePair, cex,action, callback) {
        var dexId = `${cex}_${dexType.toUpperCase()}_${NameToken}_${NamePair}_${(DTChain.Nama_Chain).toUpperCase()}`;
      //  var amount_in = Number(amount_in) / Math.pow(10, 18);

        let transformedChain = 
            DTChain.Nama_Chain.toUpperCase() === "ETHEREUM" ? "ETH" : 
            DTChain.Nama_Chain.toUpperCase() === "AVAX" ? "AVAX_CCHAIN" : 
            DTChain.Nama_Chain.toUpperCase();
            
        var dexLinks = generateDexLink(dexType, NameToken, sc_input, NamePair, sc_output);

        const NetworkChain = (DTChain.Nama_Chain || "").toUpperCase() === "ETHEREUM"
            ? "ETH"
            : (DTChain.Nama_Chain || "").toUpperCase() === "AVAX"
                ? "AVAX_CCHAIN"
                : DTChain.Nama_Chain.toUpperCase();

        const swappersMap = {
          //  kyberswap: ["KyberSwapV3"],
          //  kana: ["kana"],
            odos: ["Odos"],
         //   okx: ["Okc Swap"],
         //   "1inch": ["1Inch"],
        };
        const swapperGroups = swappersMap[dexType] || [];
        const apiKeysRango = [
            "a24ca428-a18e-4e84-b57f-edb3e2a5bf13", // rubic
            "c6381a79-2817-4602-83bf-6a641a409e32", // umum
           // "4a624ab5-16ff-4f96-90b7-ab00ddfc342c" //baru
        ];

        // Fungsi untuk mendapatkan API Key secara acak
        function getRandomApiKeyRango() {
            const randomIndex = Math.floor(Math.random() * apiKeysRango.length);
            return apiKeysRango[randomIndex];
        }
//https://api-edge.rango.exchange/routing/bests?apiKey=4a624ab5-16ff-4f96-90b7-ab00ddfc342c

        // Variabel untuk API Key
        const apiRango = getRandomApiKeyRango();
        const apiUrl = `https://api.rango.exchange/routing/bests?apiKey=${apiRango}`;

        const requestData = {
            from: {
                blockchain: NetworkChain,
                symbol: NameToken.toUpperCase(),
                address: sc_input,
            },
            to: {
                blockchain: NetworkChain,
                symbol: NamePair.toUpperCase(),
                address: sc_output,
            },
            amount: amount_in.toString(),
            swappersExclude: false,
            swapperGroups: swapperGroups,
        };

        $.ajax({
            url: apiUrl,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            success: function (response, xhr) {
                if (response.results && Array.isArray(response.results) && response.results.length > 0) {
                const firstResult = response.results[0];
                const amount_out = parseFloat(firstResult.outputAmount); // Jumlah output
                let FeeSwap = 0;
            
                // Proses fee jika data swap tersedia
                if (firstResult.swaps && firstResult.swaps.length > 0) {
                    const swap = firstResult.swaps[0]; // Ambil swap pertama
                    swapperId = swap.swapperId;        // Ambil swapperId
                    toAmount = parseFloat(swap.toAmount); // Ambil toAmount
            
                    const feeArray = swap.fee; // Array fee
                    // Cari Network Fee
                    const networkFee = feeArray.find(fee => fee.name === "Network Fee");
                    if (networkFee) {
                        FeeSwap = parseFloat(networkFee.amount) * parseFloat(networkFee.price); // Hitung Fee Swap
                    }
                }              

                const result = {
                    sc_input:sc_input,
                    des_input:des_input,
                    sc_output:sc_output,
                    des_output:des_output,
                    FeeSwap: FeeSwap,
                    amount_out: amount_out,
                };
                callback(null, result);
            }

            },                
            
            error: function (xhr) {
                let alertMessage = "Kesalahan tidak diketahui";
                let warna = "#ffe0e6";
            
                // Jika ada responseJSON dan memiliki key description, gunakan pesan ini
                if (xhr.responseJSON && xhr.responseJSON.description) {
                    alertMessage = xhr.responseJSON.description;
                } else {
                    // Fallback ke switch berdasarkan status HTTP jika tidak ada description
                    switch (xhr.status) {
                        case 0: 
                            alertMessage = "SERING SCAN"; 
                            break;
                        case 400: 
                            alertMessage = "KONEKSI BURUK"; 
                            break;
                        case 403: 
                            alertMessage = "AKSES DIBLOK"; 
                            break;
                        case 404: 
                            alertMessage = "Permintaan tidak ditemukan"; 
                            break;
                        case 429:
                            alertMessage = "KENA LIMIT";
                            break;
                        case 500: 
                            alertMessage = xhr.responseJSONmessage || "GAGAL DAPATKAN DATA"; 
                            break;
                        case 503: 
                            alertMessage = "Layanan tidak tersedia"; 
                            break;
                        default: 
                           warna = "#ffe0e6";
                            alertMessage = `Status: ${xhr.status}`;
                    }
                }

                // Kirim callback untuk menangani error lebih lanjut
                callback({ 
                    statusCode: xhr.status, 
                    pesanDEX: "RANGO: "+alertMessage, 
                    color: warna, 
                    DEX: dexType.toUpperCase() 
                }, null);
            }
            
        });        
    }
    
    function getPriceRUBIC(sc_input, des_input, sc_output, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, action, callback) {
        const namaChain = (DTChain.Nama_Chain || "").toUpperCase();
        const NetworkChain = namaChain === "ETHEREUM" ? "ETH" :
                            namaChain === "AVAX" ? "AVAX_CCHAIN" :
                            namaChain || null;

        // Validasi input penting
        if (!NetworkChain || !sc_input || !sc_output || !amount_in || !des_input) {
            return callback({
                statusCode: 400,
                pesanDEX: "DATA INPUT TIDAK LENGKAP / SALAH",
                color: "#ffe0e6",
                DEX: dexType.toUpperCase()
            }, null);
        }

        // Konversi amount ke satuan desimal token (misal 18)
        const adjustedAmountIn = (parseFloat(amount_in) / Math.pow(10, des_input)).toString();

        const requestData = {
            dstTokenAddress: sc_output,
            dstTokenBlockchain: NetworkChain,
            srcTokenAddress: sc_input,
            srcTokenBlockchain: NetworkChain,
            srcTokenAmount: adjustedAmountIn,
            referrer: "rubic.exchange"
        };

        const rubicURL = "https://api-v2.rubic.exchange/api/routes/quoteBest";

        $.ajax({
            url: rubicURL,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            success: function (response) {
                if (response && response.estimate) {
                    const amount_out = parseFloat(response.estimate.destinationTokenAmount);
                    const FeeSwap = parseFloat(response.fees?.gasTokenFees?.protocol?.fixedUsdAmount || 0);

                    const result = {
                        sc_input: sc_input,
                        des_input: des_input,
                        sc_output: sc_output,
                        des_output: des_output,
                        FeeSwap: FeeSwap,
                        amount_out: amount_out,
                    };
                    callback(null, result);
                } else {
                    callback({
                        statusCode: 204,
                        pesanDEX: "RESPON RUBIC TIDAK VALID",
                        color: "#ba1313",
                        DEX: dexType.toUpperCase()
                    }, null);
                }
            },
            error: function (xhr) {
                let alertMessage = "Kesalahan tidak diketahui";
                let warna = "#ba1313";

                if (xhr.responseJSON && xhr.responseJSON.errors && xhr.responseJSON.errors.length > 0) {
                    alertMessage = xhr.responseJSON.errors.map(e => e.reason).join("; ");
                } else {
                    switch (xhr.status) {
                        case 0: alertMessage = "KONEKSI GAGAL"; break;
                        case 400: alertMessage = "BAD REQUEST"; break;
                        case 403: alertMessage = "DIBLOK RUBIC"; break;
                        case 404: alertMessage = "TIDAK DITEMUKAN"; break;
                        case 429: alertMessage = "RATE LIMIT"; break;
                        case 500: alertMessage = "SERVER RUBIC ERROR"; break;
                        default: alertMessage = `Status: ${xhr.status}`;
                    }
                }

                callback({
                    statusCode: xhr.status,
                    pesanDEX: "RUBIC: " + xhr.reason,
                    color: warna,
                    DEX: dexType.toUpperCase()
                }, null);
            }
        });
    }

    function ResultEksekusi(amount_out, FeeSwap, sc_input, sc_output, cex, Modal, amount_in, priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX, Name_in, Name_out, feeWD, dextype, trx, vol,DataDEX) {
        // console.log("DataDEX",DataDEX);    
        var NameX = Name_in + "_" + Name_out;
            var FeeWD = parseFloat(feeWD);
            var FeeTrade = parseFloat(0.0014 * Modal);
    
            FeeSwap = parseFloat(FeeSwap);    
            Modal = parseFloat(Modal);
            amount_in = parseFloat(amount_in);
            amount_out = parseFloat(amount_out);
            priceBuyToken_CEX = parseFloat(priceBuyToken_CEX);
            priceSellPair_CEX = parseFloat(priceSellPair_CEX);

            // Hitung harga rata-rata swap
            var rateSellTokenDEX = (amount_out * priceSellPair_CEX) / amount_in;
            var rateBuyPairDEX = (amount_in * priceBuyToken_CEX) / amount_out;
            var rateTokentoPair = amount_out / amount_in;

            // Hitung total nilai
            var totalModal = Modal + FeeSwap + FeeWD + FeeTrade;
            var totalFee = FeeSwap + FeeWD + FeeTrade;
            // Hitung nilai output dalam USDT
            var valueOutInUSDT = amount_out * priceSellPair_CEX; // Output DEX dalam USD via CEX
            var valueInInUSDT = amount_out * priceBuyToken_CEX; // Input DEX dalam USD via CEX
            
            // let totalValue = 0;
            // if (trx === "TokentoPair") {
            //     totalValue = valueOutInUSDT; // Untuk transaksi TokentoPair
            // } else if (trx === "PairtoToken") {
            //     totalValue = amount_out*priceSellToken_CEX; // Untuk transaksi PairtoToken
            // }
            var totalValue = amount_out * priceSellPair_CEX; // Nilai akhir (USDT)
//            console.warn("TOTAL VALUE",totalValue)
            // console.log("TOKEN BUY:",priceBuyToken_CEX);
            // console.log("TOKEN SELL:",priceSellToken_CEX);

            // console.log("PAIR BUY:",priceBuyPair_CEX);
            // console.log("PAIR SELL:",priceSellPair_CEX);
            
            var profitLoss = totalValue - totalModal;
            var profitLossPercent = totalModal !== 0 ? (profitLoss / totalModal) * 100 : 0;

            var filterPNLValue = parseFloat(SavedSettingData.filterPNL);
            var conlusion = "NO SELISIH";
            var selisih = false;

            if (filterPNLValue === 0) {
                if (totalValue > totalModal + totalFee) {
                    conlusion = "GET SIGNAL";
                    selisih = true;
                }
            } else {
                if ((totalValue - totalModal) > filterPNLValue) {
                    conlusion = "GET SIGNAL";
                    selisih = true;
                }
            }
         

            let IdCELL = `${cex.toUpperCase()}_${dextype.toUpperCase()}_${NameX}_${(DTChain.Nama_Chain).toUpperCase()}`;
            var linkDEX = generateDexLink(dextype.toLowerCase(), Name_in, sc_input, Name_out, sc_output);

            if (!linkDEX) {
                console.error(`DEX Type "${dexType}" tidak valid atau belum didukung.`);
                return;
            }

            // Ambil rate IDR dari localStorage
            const rateUSDTtoIDR = getFromLocalStorage("PriceRateUSDT", 0);
            const toIDR = usdt => rateUSDTtoIDR ? (usdt * rateUSDTtoIDR).toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR"
            }) : "N/A";

            let titleInfo = `${DataDEX.dexTitle.toUpperCase()}: `;
            let RateSwap = "";

            if (stablecoins.includes(Name_in)) {
                titleInfo += `(${Name_in}->${Name_out}) : ${formatPrice(rateBuyPairDEX)}`;
                titleInfo += ` | ${toIDR(rateBuyPairDEX)}`;
                RateSwap = `<label class="uk-text-success" title="${titleInfo}">${formatPrice(rateBuyPairDEX)}</label>`;
            } else if (stablecoins.includes(Name_out)) {
                titleInfo += ` (${Name_in}->${Name_out}) : ${formatPrice(rateTokentoPair)}`;
                titleInfo += ` | ${toIDR(rateSellTokenDEX)}`;
                RateSwap = `<label class="uk-text-danger" title="${titleInfo}">${formatPrice(rateTokentoPair)}</label>`;
            } else {

                 if (trx === "TokentoPair") {
                     // Selain itu, ambil rate dari TOKEN (symbol_in)
                    titleInfo += ` ${formatPrice(rateTokentoPair)} ${Name_in}/${Name_out}`;
                    titleInfo += ` | ${toIDR(rateSellTokenDEX)}`;
                    RateSwap = `<label class="uk-text-primary" title="${titleInfo}">${formatPrice(rateSellTokenDEX)}</label>`;                   
                } else {
                    // Khusus USDT saat PairtoToken → ambil rate dari PAIR (symbol_out)
                    titleInfo += ` ${formatPrice(rateBuyPairDEX/priceBuyToken_CEX)} ${Name_in}/${Name_out}`;
                    titleInfo += ` | ${toIDR(rateBuyPairDEX)}`;
                    RateSwap = `<label class="uk-text-primary" title="${titleInfo}">${formatPrice(rateBuyPairDEX)}</label>`;
                }
                

            }

        if ($(`#SWAP_${IdCELL}`).length > 0) {
            $(`#SWAP_${IdCELL}`).html(`<a href="${linkDEX}" target="_blank">${RateSwap}</a>`);
        }

        // Menampilkan PNL
        // Panggil fungsi tampilan hasil
       // console.log(profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype, priceBuyToken_CEX, rateSellTokenDEX, FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal, conlusion, selisih, trx, profitLossPercent); 
        DisplayPNL(profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype, priceBuyToken_CEX, rateSellTokenDEX, FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal, conlusion, selisih, trx, profitLossPercent,vol);
    }
