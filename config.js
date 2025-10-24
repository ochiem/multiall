
const CONFIG_APP = {
    APP: {
        NAME: "MULTICHECKER",
        VERSION: "1.7",        
        SCAN_LIMIT:false,
    }
};

try { if (typeof window !== 'undefined') { window.CONFIG_APP = window.CONFIG_APP || CONFIG_APP; } } catch(_){}

const CONFIG_DB = {
    NAME: CONFIG_APP.APP.NAME,
    STORES: {
        KV: "APP_KV_STORE",
        SNAPSHOT: "SNAPSHOT_STORE",
        LOCALSTORAGE: "LOCALSTORAGE_STORE"
    },
    BROADCAST_CHANNEL: `${CONFIG_APP.APP.NAME}_CHANNEL`
};

try { if (typeof window !== 'undefined') { window.CONFIG_DB = window.CONFIG_DB || CONFIG_DB; } } catch(_){}

const CONFIG_CEX = {
    GATE: {
        WARNA: "#D5006D",  // Pink tua
        LINKS: {
            tradeToken: ({ token }) => `https://www.gate.com/trade/${String(token||'').toUpperCase()}_USDT`,
            tradePair:  ({ pair })  => `https://www.gate.com/trade/${String(pair||'').toUpperCase()}_USDT`,
            withdraw:   ({ token }) => `https://www.gate.com/myaccount/withdraw/${String(token||'').toUpperCase()}`,
            deposit:    ({ pair })  => `https://www.gate.com/myaccount/deposit/${String(pair||'').toUpperCase()}`
        },
        ORDERBOOK: {
            urlTpl: ({ symbol }) => `https://api.gateio.ws/api/v4/spot/order_book?limit=5&currency_pair=${String(symbol||'')}_USDT`,
            parser: 'standard' // use standard orderbook parser
        }
    },
    BINANCE: {
        WARNA: "#e0a50c",  // Orange tua
        LINKS: {
            tradeToken: ({ token }) => `https://www.binance.com/en/trade/${String(token||'').toUpperCase()}_USDT`,
            tradePair:  ({ pair })  => `https://www.binance.com/en/trade/${String(pair||'').toUpperCase()}_USDT`,
            withdraw:   ({ token }) => `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${String(token||'').toUpperCase()}`,
            deposit:    ({ pair })  => `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${String(pair||'').toUpperCase()}`
        },
        ORDERBOOK: {
            urlTpl: ({ symbol }) => `https://api.binance.me/api/v3/depth?limit=5&symbol=${String(symbol||'')}USDT`,
            parser: 'standard'
        }
    },
    MEXC: {
        WARNA: "#1448ce",  // Biru muda
        LINKS: {
            tradeToken: ({ token }) => `https://www.mexc.com/exchange/${String(token||'').toUpperCase()}_USDT?_from=search`,
            tradePair:  ({ pair })  => `https://www.mexc.com/exchange/${String(pair||'').toUpperCase()}_USDT?_from=search`,
            withdraw:   ({ token }) => `https://www.mexc.com/assets/withdraw/${String(token||'').toUpperCase()}`,
            deposit:    ({ pair })  => `https://www.mexc.com/assets/deposit/${String(pair||'').toUpperCase()}`
        },
        ORDERBOOK: {
            urlTpl: ({ symbol }) => `https://api.mexc.com/api/v3/depth?symbol=${String(symbol||'')}USDT&limit=5`,
            parser: 'standard'
        }
    },
    KUCOIN: {
        WARNA: "#29b3af",
        LINKS: {
            tradeToken: ({ token }) => `https://www.kucoin.com/trade/${String(token||'').toUpperCase()}-USDT`,
            tradePair:  ({ pair })  => `https://www.kucoin.com/trade/${String(pair||'').toUpperCase()}-USDT`,
            withdraw:   ({ token }) => `https://www.kucoin.com/assets/withdraw/${String(token||'').toUpperCase()}?isDefault=true`,
            deposit:    ({ token }) => `https://www.kucoin.com/assets/coin/${String(token||'').toUpperCase()}`
        },
        ORDERBOOK: {
            // KuCoin returns { data: { bids:[[price, size]], asks:[[price, size]] } }
            urlTpl: ({ symbol }) => `https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${String(symbol||'').toUpperCase()}-USDT`,
            parser: 'kucoin'
        }
    },
    BITGET: {
        WARNA: "#1aaaba",
        LINKS: {
            tradeToken: ({ token }) => `https://www.bitget.com/spot/${String(token||'').toUpperCase()}USDT`,
            tradePair:  ({ pair })  => `https://www.bitget.com/spot/${String(pair||'').toUpperCase()}USDT`,
            withdraw:   ({ token }) => `https://www.bitget.com/asset/withdraw?coin=${String(token||'').toUpperCase()}`,
            deposit:    ({ token }) => `https://www.bitget.com/asset/deposit?coin=${String(token||'').toUpperCase()}`
        },
        ORDERBOOK: {
            // Bitget returns { data: { bids:[[price, size]], asks:[[price, size]] } }
            urlTpl: ({ symbol }) => `https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${String(symbol||'').toUpperCase()}USDT&limit=5`,
            parser: 'bitget'
        }
    },
    BYBIT: {
        WARNA: "#f29900",
        LINKS: {
            tradeToken: ({ token }) => `https://www.bybit.com/trade/spot/${String(token||'').toUpperCase()}/USDT`,
            tradePair:  ({ pair })  => `https://www.bybit.com/trade/spot/${String(pair||'').toUpperCase()}/USDT`,
            withdraw:   ({ token }) => `https://www.bybit.com/user/assets/withdraw?coin=${String(token||'').toUpperCase()}`,
            deposit:    ({ token }) => `https://www.bybit.com/user/assets/deposit?coin=${String(token||'').toUpperCase()}`
        },
        ORDERBOOK: {
            // Bybit returns { result: { a:[[price, size]], b:[[price, size]] } }
            urlTpl: ({ symbol }) => `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${String(symbol||'').toUpperCase()}USDT&limit=5`,
            parser: 'bybit'
        }
    },
    INDODAX: {
        WARNA: "#1285b5",  
        LINKS: {
            tradeToken: ({ token }) => `https://indodax.com/market/${String(token||'').toUpperCase()}IDR`,
            tradePair:  ({ pair })  => `https://indodax.com/market/${String(pair||'').toUpperCase()}IDR`,
            withdraw:   ({ token }) => `https://indodax.com/finance/${String(token||'').toUpperCase()}#kirim`,
            deposit:    ({ token }) => `https://indodax.com/finance/${String(token||'').toUpperCase()}`
        },
        ORDERBOOK: {
            urlTpl: ({ symbol }) => `https://indodax.com/api/depth/${String(symbol||'').toLowerCase()}idr`,
            parser: 'indodax'
        }
    },   
};

// Merge secrets into CONFIG_CEX (legacy secrets.js)
if (typeof CEX_SECRETS !== 'undefined') {
    for (const cex in CONFIG_CEX) {
        if (CEX_SECRETS[cex]) {
            CONFIG_CEX[cex].ApiKey = CEX_SECRETS[cex].ApiKey;
            CONFIG_CEX[cex].ApiSecret = CEX_SECRETS[cex].ApiSecret;
        }
    }
}


// =================================================================================
// RPC CONFIGURATION - MOVED TO DATABASE
// =================================================================================
// NOTE: DEFAULT_RPC_SUGGESTIONS has been REMOVED and moved to rpc-database-migrator.js
// All RPC endpoints are now stored centrally in database (SETTING_SCANNER.userRPCs)
//
// To get RPC for a chain, use:
//   - RPCManager.getRPC(chainKey)           // From rpc-manager.js
//   - RPCDatabaseMigrator.getRPCFromDatabase(chainKey)  // From rpc-database-migrator.js
//
// Initial RPC values are set automatically on first app load by rpc-database-migrator.js
// Users can update RPC via Settings UI, and values are persisted in IndexedDB
// =================================================================================

// Legacy support: Expose empty object to prevent errors in old code
const DEFAULT_RPC_SUGGESTIONS = {};

const CONFIG_CHAINS = {
     bsc: {
        Kode_Chain: 56, Nama_Chain: "bsc", Nama_Pendek: "bsc", URL_Chain: "https://bscscan.com", WARNA:"#f0af18", ICON:"https://images.seeklogo.com/logo-png/44/2/binance-smart-chain-bsc-logo-png_seeklogo-446621.png", DATAJSON: 'https://multiplus-scanner.vercel.app/JSON_KOIN/BSC.json', BaseFEEDEX : "BNBUSDT", GASLIMIT: 80000,
        LINKS: {
            explorer: {
                token: (address) => `https://bscscan.com/token/${address}`,
                address: (address) => `https://bscscan.com/address/${address}`,
                tx: (hash) => `https://bscscan.com/tx/${hash}`
            }
        },
        DEXS: [ "1inch", "paraswap", "odos", "kyber", "0x", "okx"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'BSC' },
            BINANCE: { address : '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3', address2 : '0xe2fc31F816A9b94326492132018C3aEcC4a93aE1', chainCEX : 'BSC' },
            MEXC: { address : '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB', chainCEX : 'BSC' }, 
            INDODAX: { address : '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2', address2 : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', chainCEX : 'BSC' },
            KUCOIN: { address : '0x58edF78281334335EfFa23101bBe3371b6a36A51', address2 : '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', chainCEX : 'BEP20' },
            BITGET: { address : '0x0639556F03714A74a5fEEaF5736a4A64fF70D206', address2 : '0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673', address3 : '0x51971c86b04516062c1e708CDC048CB04fbe959f', chainCEX : 'BEP20' },
            BYBIT: { address : '0xf89d7b9c864f589bbf53a82105107622b35eaa40', chainCEX : 'BSC' },
        },
        PAIRDEXS: {
            "BNB": { symbolPair: "BNB", scAddressPair: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", desPair: "18" },
            "USDT": { symbolPair: "USDT", scAddressPair: "0x55d398326f99059fF775485246999027B3197955", desPair: "18" },
            "ETH": { symbolPair: "ETH", scAddressPair: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", desPair: "18" },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }        
    },   
    polygon: {
        Kode_Chain: 137,
        Nama_Chain: "polygon",
        Nama_Pendek: "poly",
        URL_Chain: "https://polygonscan.com",
        ICON: "https://s2.coinmarketcap.com/static/img/coins/200x200/3890.png",
        WARNA:"#a05df6",
        DATAJSON: 'https://multiplus-scanner.vercel.app/JSON_KOIN/POLYGON.json',
        BaseFEEDEX : "MATICUSDT", // Corrected from POLUSDT
        GASLIMIT: 80000,
        DEXS: [ "1inch", "paraswap", "odos", "kyber", "0x", "okx"],
        LINKS: {
            explorer: {
                token: (address) => `https://polygonscan.com/token/${address}`,
                address: (address) => `https://polygonscan.com/address/${address}`,
                tx: (hash) => `https://polygonscan.com/tx/${hash}`
            }
        },
        WALLET_CEX: {
           GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'MATIC' },
           BINANCE: { address : '0x290275e3db66394C52272398959845170E4DCb88', address2 : '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245', chainCEX : 'MATIC' },          
           MEXC: { address : '0x51E3D44172868Acc60D68ca99591Ce4230bc75E0', chainCEX : 'MATIC' },
           KUCOIN: { address : '0x9AC5637d295FEA4f51E086C329d791cC157B1C84', address2 : '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', chainCEX : 'Polygon POS' },
           BITGET: { address : '0x0639556F03714A74a5fEEaF5736a4A64fF70D206', address2 : '0x51971c86b04516062c1e708CDC048CB04fbe959f', address3 : '0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673', chainCEX : 'Polygon' },
           BYBIT: { address : '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chainCEX : 'Polygon PoS' },
           INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'POLYGON' },   
        },
        PAIRDEXS: {
           "USDT": { symbolPair: 'USDT', scAddressPair: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', desPair: '6' },
           "USDC": { symbolPair: 'USDC', scAddressPair: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', desPair: '6' },
           "POL": { symbolPair: 'POL', scAddressPair: '0x0000000000000000000000000000000000001010', desPair: '18' },
           "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }
    },
    arbitrum: {
        Kode_Chain: 42161, Nama_Chain: "arbitrum", Nama_Pendek: "arb", URL_Chain: "https://arbiscan.io", WARNA:"#a6b0c3", ICON:"https://wiki.dextrac.com:3443/images/1/11/Arbitrum_Logo.png", DATAJSON: 'https://multiplus-scanner.vercel.app/JSON_KOIN/ARBITRUM.json', BaseFEEDEX : "ETHUSDT", GASLIMIT: 100000,
        LINKS: {
            explorer: {
                token: (address) => `https://arbiscan.io/token/${address}`,
                address: (address) => `https://arbiscan.io/address/${address}`,
                tx: (hash) => `https://arbiscan.io/tx/${hash}`
            }
        },
        DEXS: [ "1inch", "paraswap", "odos", "kyber", "0x", "okx"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'ARBITRUM' },
            BINANCE: { address : '0x290275e3db66394C52272398959845170E4DCb88', address2 : '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245', chainCEX : 'ARBITRUM' },
            MEXC: { address : '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB', chainCEX : 'ARB' },
            KUCOIN: { address : '0x03E6FA590CAdcf15A38e86158E9b3D06FF3399Ba', chainCEX : 'ARBITRUM' },
            BITGET: { address : '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef', chainCEX : 'ArbitrumOne' },
            BYBIT: { address : '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chainCEX : 'Arbitrum One' },
        },    
        PAIRDEXS: {  
            "ETH":{ symbolPair: 'ETH', scAddressPair: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', desPair: '18' },
            "USDT":{ symbolPair: 'USDT', scAddressPair: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', desPair: '6' },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        },           
    }, 
    ethereum: {
        Kode_Chain: 1, Nama_Chain: "ethereum", Nama_Pendek: "erc", URL_Chain: "https://etherscan.io", WARNA:"#8098ee", ICON:"https://icons.iconarchive.com/icons/cjdowner/cryptocurrency-flat/256/Ethereum-ETH-icon.png", DATAJSON: 'https://multiplus-scanner.vercel.app/JSON_KOIN/ETHEREUM.json', BaseFEEDEX : "ETHUSDT", GASLIMIT: 250000,
        LINKS: {
            explorer: {
                token: (address) => `https://etherscan.io/token/${address}`,
                address: (address) => `https://etherscan.io/address/${address}`,
                tx: (hash) => `https://etherscan.io/tx/${hash}`
            }
        },
        DEXS: [ "1inch", "paraswap", "odos", "kyber", "0x", "okx"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'ETH' },
            BINANCE: { address : '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2 : '0x28C6c06298d514Db089934071355E5743bf21d60', address3 : '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', chainCEX : 'ETH' },
            INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'ETH' }, 
            MEXC: { address : '0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88', address2 : '0x9642b23Ed1E01Df1092B92641051881a322F5D4E', chainCEX : 'ETH' },
            KUCOIN: { address : '0x58edF78281334335EfFa23101bBe3371b6a36A51', address2 : '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', chainCEX : 'ERC20' },
            BITGET: { address : '0x0639556F03714A74a5fEEaF5736a4A64fF70D206', address2 : '0x51971c86b04516062c1e708CDC048CB04fbe959f', address3 : '0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673', chainCEX : 'ERC20' },
            BYBIT: { address : '0xf89d7b9c864f589bbF53a82105107622B35EaA40', address2 : '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chainCEX : 'Ethereum' },
        },
        PAIRDEXS: {  
            "ETH":{ symbolPair: 'ETH', scAddressPair: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', desPair: '18' },
            "USDT":{ symbolPair: 'USDT', scAddressPair: '0xdAC17F958D2ee523a2206206994597C13D831ec7', desPair: '6' },
            "BNT":{ symbolPair: 'BNT', scAddressPair: '0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C', desPair: '18' },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        } 
    }, 
   
    base: {
        Kode_Chain: 8453, Nama_Chain: "base", Nama_Pendek: "base", URL_Chain: "https://basescan.org/", WARNA:"#1e46f9", ICON:"https://avatars.githubusercontent.com/u/108554348?v=4", DATAJSON: 'https://multiplus-scanner.vercel.app/JSON_KOIN/BASE.json', BaseFEEDEX : "ETHUSDT", GASLIMIT: 100000,
        LINKS: {
            explorer: {
                token: (address) => `https://basescan.org/token/${address}`,
                address: (address) => `https://basescan.org/address/${address}`,
                tx: (hash) => `https://basescan.org/tx/${hash}`
            }
        },
        DEXS: ["1inch", "paraswap", "odos", "kyber", "0x", "okx"],
        WALLET_CEX: {
            GATE: { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX: 'BASE' },
            BINANCE: { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2: '0x28C6c06298d514Db089934071355E5743bf21d60', chainCEX: 'BASE' },
            MEXC: { address : '0x4e3ae00E8323558fA5Cac04b152238924AA31B60', chainCEX : 'BASE' },
            INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'POLYGON' },   
            KUCOIN: { address: '0x58edF78281334335EfFa23101bBe3371b6a36A51', address2: '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', chainCEX: 'Base' },
            BITGET: { address: '0x0639556F03714A74a5fEEaF5736a4A64fF70D206', address2: '0x51971c86b04516062c1e708CDC048CB04fbe959f', address3 : '0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673', chainCEX: 'BASE' },
            BYBIT: { address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', address2: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chainCEX: 'Base Mainnet' },
        },        
        PAIRDEXS: {
           "ETH": { symbolPair: 'ETH', scAddressPair: '0x4200000000000000000000000000000000000006', desPair: '18' },
           "USDC":{ symbolPair: 'USDC', scAddressPair: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', desPair: '6' },
           "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }        
    }       
};

const CONFIG_UI = {
    CEXES: [
        { key: 'BINANCE', label: 'Binance', short: 'BINC', badgeClass: 'bg-binance' },
        { key: 'MEXC', label: 'MEXC', short: 'MEXC', badgeClass: 'bg-mexc' },
        { key: 'GATE', label: 'Gateio', short: 'GATE', badgeClass: 'bg-gateio' },
        { key: 'INDODAX', label: 'INDODAX', short: 'INDX', badgeClass: 'bg-indodax' }
    ],
    DEXES: [
        { key: '0x', label: 'Matcha', badgeClass: 'bg-matcha', fallbackSlug: '0x' },
        { key: 'kyber', label: 'KyberSwap', badgeClass: 'bg-kyberswap', fallbackSlug: 'kyberswap' },
        { key: '1inch', label: '1inch', badgeClass: 'bg-1inch', fallbackSlug: '1inch' },
        { key: 'paraswap', label: 'ParaSwap', badgeClass: 'bg-paraswap', fallbackSlug: 'paraswap' },
        { key: 'odos', label: 'ODOS', badgeClass: 'bg-odos', fallbackSlug: 'odos', skipDelay: true },
        { key: 'okx', label: 'OKXDEX', badgeClass: 'bg-okxdex', fallbackSlug: 'okx' }
    ],
    CHAINS: [
        { key: 'polygon', label: 'Polygon', short: 'POLY', badgeClass: 'bg-success text-light' },
        { key: 'arbitrum', label: 'Arbitrum', short: 'ARB', badgeClass: 'bg-info text-dark' },
        { key: 'ethereum', label: 'Ethereum', short: 'ETH', badgeClass: 'bg-primary text-light' },
        { key: 'bsc', label: 'BSC', short: 'BSC', badgeClass: 'bg-warning text-dark' },
        { key: 'base', label: 'Base', short: 'BASE', badgeClass: 'bg-dark text-light' }
    ]
};

function buildChainConfig(chainSource = {}, uiChains = []) {
    const uiByKey = {};
    (Array.isArray(uiChains) ? uiChains : []).forEach(item => {
        if (!item || !item.key) return;
        uiByKey[String(item.key).toLowerCase()] = {
            label: item.label,
            short: item.short,
            badgeClass: item.badgeClass
        };
    });

    const map = {};
    Object.entries(chainSource || {}).forEach(([key, data]) => {
        const lowerKey = String(key).toLowerCase();
        const ui = uiByKey[lowerKey] || {};
        const basePair = String(data?.BaseFEEDEX || '');
        const symbol = basePair.toUpperCase().endsWith('USDT')
            ? basePair.toUpperCase().slice(0, -4)
            : (ui.short || data?.Nama_Pendek || data?.Nama_Chain || key || '').toString().toUpperCase();

        map[lowerKey] = {
            key: lowerKey,
            name: ui.label || data?.Nama_Chain || key,
            short: ui.short || (data?.Nama_Pendek || data?.Nama_Chain || key || '').toString().toUpperCase(),
            symbol,
            badgeClass: ui.badgeClass || 'bg-dark text-light',
            // RPC removed - use RPCManager.getRPC(chainKey) instead
            explorer: data?.URL_Chain || '',
            code: data?.Kode_Chain,
            gasLimit: data?.GASLIMIT,
            color: data?.WARNA,
            baseFeePair: basePair,
            walletCex: data?.WALLET_CEX || {},
            pairs: data?.PAIRD || data?.PAIRDEXS || {},
            raw: data
        };
    });
    return map;
}

const CHAIN_CONFIG = buildChainConfig(CONFIG_CHAINS, CONFIG_UI.CHAINS);

// CONFIG_DEXS moved to dex-config.js to avoid duplication and keep this file data-centric
     
// Expose globals for runtime consumers (registry/services)
window.DEFAULT_RPC_SUGGESTIONS = window.DEFAULT_RPC_SUGGESTIONS || DEFAULT_RPC_SUGGESTIONS;
window.CONFIG_CEX = window.CONFIG_CEX || CONFIG_CEX;
window.CONFIG_CHAINS = window.CONFIG_CHAINS || CONFIG_CHAINS;
window.CONFIG_UI = window.CONFIG_UI || CONFIG_UI;
window.CHAIN_CONFIG = window.CHAIN_CONFIG || CHAIN_CONFIG;
window.CEXWallets = window.CEXWallets || CONFIG_CHAINS;

// Optional proxy settings for DEX/network calls
// Define a list of CORS proxy servers; one will be chosen at random per access
const serverCORS = [
    // Add or replace with your own proxies
     "https://server1.ciwayeh967.workers.dev/?",
        "https://yazid3.yazidcrypto7.workers.dev/?",
        "https://yazid5.bustomi.workers.dev/?",
        "https://yazid4.yazidcrypto3.workers.dev/?",
        "https://yoeazd2.yoeaz2324.workers.dev/?",
        "https://server6.hejij49077.workers.dev/?",
        "https://server7.gejac16482.workers.dev/?",
        "https://server8.xotolo5853.workers.dev/?",
        "https://server9.dopacer193.workers.dev/?",
        "https://server10.samoker104.workers.dev/?",
        "https://worker-bold-meadow-ab0a.xaraho1024.workers.dev/?",
        "https://worker-cool-truth-c06e.nomege1872.workers.dev/?",
        "https://worker-floral-river-e85c.tenimik318.workers.dev/?",
        "https://worker-royal-sound-0576.koban78574.workers.dev/?",
        "https://worker-curly-credit-2c73.viyeva7164.workers.dev/?",
        "https://worker-royal-haze-a135.lisolo3133.workers.dev/?",
        "https://worker-shy-cloud-27ca.vanogo6423.workers.dev/?",
        "https://worker-withered-sky-ed3e.vifeci7919.workers.dev/?",
        "https://worker-sweet-sound-e261.jaxet60213.workers.dev/?",
        "https://worker-shiny-sun-08f7.xabenic669.workers.dev/?",
        "https://worker-frosty-darkness-4f91.lobowev486.workers.dev/?",
        "https://worker-silent-boat-3c2e.celov42704.workers.dev/?",
        "https://worker-round-star-6bf9.yalayo9082.workers.dev/?",
        "https://worker-cool-dream-e973.gocon75635.workers.dev/?",
        "https://worker-winter-sound-52bd.pedig30998.workers.dev/?",
        "https://worker-super-lake-198e.kevaraj359.workers.dev/?",
        "https://worker-soft-dawn-b769.robiho8355.workers.dev/?",
        "https://worker-weathered-forest-2a2e.fiwala7986.workers.dev/?",
        "https://worker-still-tooth-553b.sewis68418.workers.dev/?",
        "https://worker-solitary-waterfall-f039.fomev71287.workers.dev/?",
        "https://server4.dajom23364.workers.dev/?",
        "https://server3.hopevap663.workers.dev/?",
        "https://worker-blue-mountain-bee9.hibes27870.workers.dev/?",
        "https://worker-still-morning-642c.kehoc99044.workers.dev/?",
        "https://myserver4.lamowa2709.workers.dev/?",
        "https://myserver5.mohafe9330.workers.dev/?",
        "https://worker-young-bush-ce2e.micejiy771.workers.dev/?",
        "https://worker-sparkling-silence-9d41.federi4672.workers.dev/?",
        "https://worker-polished-cloud-77bd.renel72768.workers.dev/?",
        "https://worker-sweet-darkness-d1c0.risiv74771.workers.dev/?",
        "https://worker-jolly-wildflower-c305.kacito9688.workers.dev/?",
        "https://worker-dawn-king-f162.kekam96808.workers.dev/?",
        "https://worker-shrill-bonus-9ca6.wipihoh336.workers.dev/?",
        "https://worker-tiny-bar-013f.gicot48223.workers.dev/?",
        "https://worker-tight-violet-dbda.xemojos811.workers.dev/?",
        "https://worker-tight-lab-9cc4.fetec22957.workers.dev/?",
        "https://server2.holabaj699.workers.dev/?",
        "https://myserver3.ceteg74201.workers.dev/?",
        "https://1.iiknrbtxoz.workers.dev/?",
        "https://2.5iz3h20guj.workers.dev/?",
        "https://3.g5l3krmasa-bda.workers.dev/?",
        "https://4.7gggrv7tyo.workers.dev/?",
        "https://5.1mynz671ti.workers.dev/?",
        "https://6.6dn6rtqjng.workers.dev/?",
        "https://7.zk3dvkv4pp.workers.dev/?",
        "https://8.c58qvb11ew.workers.dev/?",
        "https://9.n9zkqpbdpb.workers.dev/?",
        "https://10.tximoyq5se.workers.dev/?",
        "https://server11.jiser33752.workers.dev/?",
        "https://server12.yitijex843.workers.dev/?",
        "https://server13.lovah68689.workers.dev/?",
        "https://server14.setopit195.workers.dev/?",
        "https://server15.povaf41444.workers.dev/?",
        "https://server16.niromaf426.workers.dev/?",
        "https://server17.kasoda9624.workers.dev/?",
        "https://server18.befim19137.workers.dev/?",
        "https://server19.gafigaf751.workers.dev/?",
        "https://server20.gayomep515.workers.dev/?",
        "https://worker-plain-shape-e4c4.dilexid433.workers.dev/?",
        "https://worker-weathered-bar-d4fa.dadiyo8115.workers.dev/?",
        "https://myserver3.ceteg74201.workers.dev/?",
        "https://server21.becibov328.workers.dev/?",
        "https://server22.togid93865.workers.dev/?",
        "https://server24.yaleve6056.workers.dev/?",
        "https://server23.bagotof270.workers.dev/?",
        "https://new1.gisot33558.workers.dev/?",
        "https://new2.sober27867.workers.dev/?",
        "https://new3.micipiy438.workers.dev/?",
        "https://new3.rayepar467.workers.dev/?",
        "https://new4.xebidi4752.workers.dev/?",
        "https://new5.cibiyec145.workers.dev/?",
        "https://worker-frosty-star-71a8.cesaxem416.workers.dev/?",
        "https://worker-sweet-dust-96ef.payat56154.workers.dev/?",
        "https://new5.nafeyis928.workers.dev/?",
        "https://worker-broad-tree-49bb.cekah58754.workers.dev/?",
        "https://worker-ancient-hill-fad1.xejab72348.workers.dev/?",
        "https://cors.gemul-putra.workers.dev/?",
        "https://worker-damp-glitter-db50.gameco3780.workers.dev/?",
        "https://worker-blue-hall-1d14.xinevo2786.workers.dev/?",
        "https://worker-tiny-dust-22f2.capaji8287.workers.dev/?",
        "https://worker-old-disk-8a9a.kehaxa7686.workers.dev/?",
        "https://worker-yellow-wood-677d.lanafi2429.workers.dev/?",
        "https://worker-cool-tree-07c7.kifira7062.workers.dev/?",
        "https://myserver6.bafayi9378.workers.dev/?",
        "https://myserver7.yiwaj21571.workers.dev/?",
        "https://myserver7.yiwaj21571.workers.dev/?",
        "https://myserver5.mohafe9330.workers.dev/?",
        "https://worker-weathered-bar-d4fa.dadiyo8115.workers.dev/?"
];

const CONFIG_PROXY = {
    LIST: serverCORS
};

// Backward-compatible dynamic getter: each access returns a random prefix
try {
  Object.defineProperty(CONFIG_PROXY, 'PREFIX', {
    configurable: true,
    enumerable: true,
    get() {
      try {
        const list = Array.isArray(CONFIG_PROXY.LIST) ? CONFIG_PROXY.LIST : [];
        if (!list.length) return '';
        const idx = Math.floor(Math.random() * list.length);
        return String(list[idx] || '');
      } catch(_) { return ''; }
    }
  });
} catch(_) {}

try {
  if (typeof window !== 'undefined') {
    window.serverCORS = window.serverCORS || serverCORS;
    window.CONFIG_PROXY = window.CONFIG_PROXY || CONFIG_PROXY;
    // Convenience helper
    window.getRandomProxy = window.getRandomProxy || function(){ return CONFIG_PROXY.PREFIX; };
  }
} catch(_){}

// DEX builder config (moved from dex-config.js)
/**
 * PANDUAN KONFIGURASI fetchdex:
 *
 * - tokentopair: Strategi untuk CEX → DEX (Actionkiri: beli token di exchanger, swap token ke pair di DEX)
 * - pairtotoken: Strategi untuk DEX → CEX (ActionKanan: swap pair ke token di DEX, jual token ke exchanger)
 *
 * ========================================
 * 3 KATEGORI STRATEGI FALLBACK:
 * ========================================
 *
 * KATEGORI 1: SAME PRIMARY + INTERNAL ALTERNATIVE (Kyber, ODOS, 1inch)
 * - Primary: Sama untuk kedua arah (kyber/odos2/odos3/hinkal-1inch)
 * - Alternative: Provider internal untuk kedua arah (zero-kyber/hinkal-odos/zero-1inch)
 * - Mengurangi beban ke SWOOP/DZAP dengan menggunakan provider internal yang reliable
 * - Contoh: kyber (zero-kyber), odos (hinkal-odos), 1inch (hinkal ↔ zero)
 *
 * KATEGORI 2: SAME PRIMARY + SWOOP/DZAP ALTERNATIVE (0x, OKX)
 * - Primary: Sama untuk kedua arah (0x/okx API langsung)
 * - Alternative: SWOOP untuk CEX→DEX (entry), DZAP untuk DEX→CEX (exit)
 * - Contoh: 0x, okx
 *
 * KATEGORI 3: DIFFERENT PRIMARY + SWOOP/DZAP ALTERNATIVE (ParaSwap)
 * - Primary: Berbeda per arah (v6 vs v5)
 * - Alternative: SWOOP untuk CEX→DEX (entry), DZAP untuk DEX→CEX (exit)
 * - Contoh: paraswap (v6/v5)
 *
 * ========================================
 * FALLBACK POLICY:
 * ========================================
 * - primary: Strategi utama yang dipilih pertama kali
 * - alternative: Strategi cadangan saat primary gagal (error 429, 500+, atau timeout)
 * - allowFallback: true/false - izinkan fallback ke alternative
 */
const CONFIG_DEXS = {
    kyber: {
        label: 'KyberSwap',
        badgeClass: 'bg-kyberswap',

        warna: "#0b7e18ff", // hijau tosca KyberSwap
        builder: ({ chainName, tokenAddress, pairAddress }) =>
            `https://kyberswap.com/swap/${chainName}/${tokenAddress}-to-${pairAddress}`,
        // Strategi internal: Zero-Kyber sebagai alternative untuk mengurangi beban ke SWOOP/DZAP
        fetchdex: {
            primary: {
                tokentopair: 'kyber',       // CEX→DEX (Actionkiri): KyberSwap API langsung
                pairtotoken: 'kyber'        // DEX→CEX (ActionKanan): KyberSwap API langsung
            },
            alternative: {
                tokentopair: 'zero-kyber',  // Fallback CEX→DEX: ZeroSwap Kyber (internal provider)
                pairtotoken: 'zero-kyber'   // Fallback DEX→CEX: ZeroSwap Kyber (internal provider)
            }
        },
        allowFallback: true,
        // Note: Menggunakan Zero-Kyber untuk kedua arah agar tidak membebani SWOOP/DZAP
    },
    '0x': {
        label: 'Matcha',
        badgeClass: 'bg-matcha',

        warna: "#61ee73ff", // hitam abu-abu (Matcha/0x)
        builder: ({ chainName, tokenAddress, pairAddress, chainCode }) =>
            `https://matcha.xyz/tokens/${chainName}/${String(tokenAddress||'').toLowerCase()}?buyChain=${chainCode}&buyAddress=${String(pairAddress||'').toLowerCase()}`,
        fetchdex: {
            primary: {
                tokentopair: '0x',      // CEX→DEX (Actionkiri): Matcha (0x) API langsung
                pairtotoken: '0x'       // DEX→CEX (ActionKanan): Matcha (0x) API langsung
            },
            alternative: {
                tokentopair: 'swoop',   // Fallback CEX→DEX: SWOOP aggregator
                pairtotoken: 'dzap'     // Fallback DEX→CEX: DZAP (multi-provider, exit focused)
            }
        },
        allowFallback: true,
    },
    odos: {
        label: 'ODOS',
        badgeClass: 'bg-odos',

        warna: "#6e2006ff", // ungu-biru Odos
        builder: () => `https://app.odos.xyz`,
        // Strategi internal: Hinkal-ODOS sebagai alternative untuk mengurangi beban ke SWOOP/DZAP
        fetchdex: {
            primary: {
                tokentopair: 'odos2',       // CEX→DEX (Actionkiri): ODOS API v2
                pairtotoken: 'odos3'        // DEX→CEX (ActionKanan): ODOS API v3 (lebih stabil)
            },
            alternative: {
                tokentopair: 'hinkal-odos',  // Fallback CEX→DEX: Hinkal ODOS proxy (internal provider)
                pairtotoken: 'hinkal-odos'   // Fallback DEX→CEX: Hinkal ODOS proxy (internal provider)
            }
        },
        allowFallback: true,
        // Note: Menggunakan Hinkal-ODOS untuk kedua arah agar tidak membebani SWOOP/DZAP
    },
    okx: {
        label: 'OKXDEX',
        badgeClass: 'bg-okxdex',

        warna: "#000000", // hitam (brand OKX)
        builder: ({ chainCode, tokenAddress, pairAddress }) =>
            `https://www.okx.com/web3/dex-swap?inputChain=${chainCode}&inputCurrency=${tokenAddress}&outputChain=501&outputCurrency=${pairAddress}`,
        fetchdex: {
            primary: {
                tokentopair: 'okx',     // CEX→DEX (Actionkiri): OKX DEX API langsung
                pairtotoken: 'okx'      // DEX→CEX (ActionKanan): OKX DEX API langsung
            },
            alternative: {
                tokentopair: 'swoop',   // Fallback CEX→DEX: SWOOP aggregator
                pairtotoken: 'dzap'     // Fallback DEX→CEX: DZAP (multi-provider, exit focused)
            }
        },
        allowFallback: true,
    },
    '1inch': {
        label: '1inch',
        badgeClass: 'bg-1inch',

        warna: "#06109bff", // red 1inch branding
        builder: ({ chainCode, tokenAddress, pairAddress }) => `https://app.1inch.io/advanced/swap?network=${chainCode}&src=${tokenAddress}&dst=${pairAddress}`,

        // Strategi khusus: Primary SELALU Hinkal, Alternative SELALU ZeroSwap (tidak bergantung arah)
        fetchdex: {
            primary: {
                tokentopair: 'hinkal-1inch',   // CEX→DEX: Hinkal proxy (privacy, 0.1 Gwei)
                pairtotoken: 'hinkal-1inch'    // DEX→CEX: Hinkal proxy (privacy, 0.1 Gwei)
            },
            alternative: {
                tokentopair: 'zero-1inch',     // Fallback CEX→DEX: ZeroSwap (jika Hinkal gagal)
                pairtotoken: 'zero-1inch'      // Fallback DEX→CEX: ZeroSwap (jika Hinkal gagal)
            }
        },
        allowFallback: true,
        // Note: Hinkal diutamakan untuk privacy & gas rendah (0.1 Gwei) di semua arah
        // ZeroSwap sebagai fallback yang lebih cepat jika Hinkal error/timeout
    },
    paraswap: {
        label: 'ParaSwap',
        badgeClass: 'bg-paraswap',

        warna: "#1c64f2ff",
        builder: ({ chainCode, tokenAddress, pairAddress }) => {
            const network = chainCode || '';
            const from = String(tokenAddress || '').toLowerCase();
            const to = String(pairAddress || '').toLowerCase();
            return `https://app.paraswap.io/#/?network=${network}&from=${from}&to=${to}`;
        },
        fetchdex: {
            primary: {
                tokentopair: 'paraswap6',   // CEX→DEX (Actionkiri): ParaSwap API v6 (terbaru)
                pairtotoken: 'paraswap5'    // DEX→CEX (ActionKanan): ParaSwap API v5 (lebih stabil)
            },
            alternative: {
                tokentopair: 'swoop',   // Fallback CEX→DEX: SWOOP aggregator (entry focused)
                pairtotoken: 'dzap'     // Fallback DEX→CEX: DZAP aggregator (exit focused)
            }
        },
        allowFallback: true,
    }

    // fly: {
    //     label: 'FLY',
    //     badgeClass: 'bg-fly',
    //     proxy: true,
    //     warna: "#ba28f9ff", // fly teal
    //     builder: ({ chainName, tokenAddress, pairAddress }) => {
    //         const net = String(chainName || '').toLowerCase() || 'ethereum';
    //         return `https://app.fly.trade/swap/${net}/${String(tokenAddress).toLowerCase()}/${net}/${String(pairAddress).toLowerCase()}`;
    //     },
    //     fetchdex: {
    //         primary: {
    //             tokentopair: 'fly',
    //             pairtotoken: 'fly'
    //         }
    //     },
    //     allowFallback: false,
    // },
    
     
};

try { if (typeof window !== 'undefined') { window.CONFIG_DEXS = window.CONFIG_DEXS || CONFIG_DEXS; } } catch(_){}

// Centralized chain synonyms mapping used to normalize CEX network labels
const CHAIN_SYNONYMS = {
    ethereum: ['ETH','ERC20','ETHEREUM'],
    bsc: ['BSC','BEP20','BINANCE SMART CHAIN','BNB SMART CHAIN','BEP-20'],
    polygon: ['POLYGON','MATIC','POLYGON POS','POLYGON (MATIC)','POL'],
    arbitrum: ['ARBITRUM','ARB','ARBITRUM ONE','ARBEVM','ARBITRUMONE','ARB-ETH'],
    base: ['BASE','BASE MAINNET','BASEEVM']
};

try { if (typeof window !== 'undefined') { window.CHAIN_SYNONYMS = window.CHAIN_SYNONYMS || CHAIN_SYNONYMS; } } catch(_){}
