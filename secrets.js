// Centralized API keys and secrets
// - CEX API keys
// - OKX DEX key pool
// - Telegram bot credentials

const CEX_SECRETS = {
    GATE: {
        ApiKey: "1dbe3d4c92a42de270692e65952574d0",
        ApiSecret: "9436bfec02a8ed462bda4bd1a516ba82b4f322dd09e120a2bf7ea6b5f0930ef8",
    },
    BINANCE: {
        ApiKey: "PoMTZjrgq2rUNQHpqvoOW0Ajq1iKytG3OZueMyvYwJmMaH175kuVi2QyB98Zocnb",
        ApiSecret: "bBq5FCpuCghA0hJuil7gCObTqDzYaLaVdsZVsdfSzv4MZ2rDBK6cpN590eXAwfod",
    },
    MEXC: {
        ApiKey: "mx0vgl6hr4AgqcFAd8", // Ganti dengan ApiKey asli
        ApiSecret: "61426ded5d804f97a828eb35ff3c26f6", // Ganti dengan ApiSecret asli
    },
    INDODAX: {
        ApiKey: "HRKOX8GL-KD9ANNF5-T7OKENAH-LHL5PBYQ-NW8GQICL", // Ganti dengan ApiKey asli
        ApiSecret: "2ff67f7546f9b1af3344f4012fbb5561969de9440f1d1432c89473d1fe007deb3f3d0bac7400622b", // Ganti dengan ApiSecret asli
    },
    BYBIT: {
        ApiKey: "H2e7P3xu7zzjmRllrl",
        ApiSecret: "4xBB4NchMTxPBT68Ej86Y2UtC1sFfrcBZG1d",
    },
};

// Telegram bot credentials (moved from config.js)
const CONFIG_TELEGRAM = {
    BOT_TOKEN: "7853809693:AAHl8e_hjRyLgbKQw3zoUSR_aqCbGDg6nHo",
    CHAT_ID: "-1002079288809"
};

// Ensure globals are available for code paths that expect window.*
try {
    if (typeof window !== 'undefined') {
        window.CONFIG_TELEGRAM = window.CONFIG_TELEGRAM || CONFIG_TELEGRAM;
        window.CEX_SECRETS = window.CEX_SECRETS || CEX_SECRETS;
    }
} catch(_) {}

const apiKeysOKXDEX = [
    {
        ApiKeyOKX: "28bc65f0-8cd1-4ecb-9b53-14d84a75814b",
        secretKeyOKX: "E8C92510E44400D8A709FBF140AABEC1",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "04f923ec-98f2-4e60-bed3-b8f2d419c773",
        secretKeyOKX: "3D7D0BD3D985C8147F70592DF6BE3C48",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "cf214e57-8af2-42bf-8afa-3b7880c5a152",
        secretKeyOKX: "26AA1E415682BD8BBDF44A9B1CFF4759",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "a77871bd-7855-484c-a675-e429bad3490e",
        secretKeyOKX: "830C9BB8D963F293857DB0CCA5459089",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "87db4731-fbe3-416f-8bb4-a4f5e5cb64f7",
        secretKeyOKX: "B773838680FF09F2069AEE28337BBCD0",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "aec98aef-e2b6-4fb2-b63b-89e358ba1fe1",
        secretKeyOKX: "DB683C83FF6FB460227ACB57503F9233",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "6636873a-e8ab-4063-a602-7fbeb8d85835",
        secretKeyOKX: "B83EF91AFB861BA3E208F2680FAEDDC3",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "989d75b7-49ff-40a1-9c8a-ba94a5e76793",
        secretKeyOKX: "C30FCABB0B95BE4529D5BA1097954D34",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "43c169db-db8c-4aeb-9c25-a2761fdcae49",
        secretKeyOKX: "7F812C175823BBD9BD5461B0E3A106F5",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "904cefba-08ce-48e9-9e8b-33411bf44a0f",
        secretKeyOKX: "91F2761A0B77B1DEED87A54E75BE1CCE",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "bfbd60b5-9aee-461d-9c17-3b401f9671d1",
        secretKeyOKX: "D621020540042C41D984E2FB78BED5E4",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "86f40277-661c-4290-929b-29a25b851a87",
        secretKeyOKX: "9274F990B5BEDAB5EB0C035188880081",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "32503ada-3d34-411a-b50b-b3e0f36f3b47",
        secretKeyOKX: "196658185E65F93963323870B521A6F6",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "80932e81-45b1-497e-bc14-81bdb6ed38d5",
        secretKeyOKX: "4CA9689FA4DE86F4E4CBF2B777CBAA91",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "a81d5a32-569a-401c-b207-3f0dd8f949c7",
        secretKeyOKX: "307D988DA44D37C911AA8A171B0975DB",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "ca59e403-4bcb-410a-88bb-3e931a2829d5",
        secretKeyOKX: "AC7C6D593C29F3378BF93E7EDF74CB6D",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "97439591-ea8e-4d78-86bb-bdac8e43e835",
        secretKeyOKX: "54970C78369CE892E2D1B8B296B4E572",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "f7a23981-af15-47f4-8775-8200f9fdfe5d",
        secretKeyOKX: "4F61764255CEDE6D5E151714B3E1E93B",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "4f708f99-2e06-4c81-88cb-3c8323fa42c5",
        secretKeyOKX: "A5B7DCA10A874922F54DC2204D6A0435",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "61061ef4-6d0a-412a-92a9-bdc29c6161a7",
        secretKeyOKX: "4DDF73FD7C38EB50CD09BF84CDB418ED",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "b63f3f68-2008-4df5-9d2e-ae888435332b",
        secretKeyOKX: "1427387D7B1A67018AA26D364700527B",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "ecc51700-e7a2-4c93-9c8d-dbc43bda74c1",
        secretKeyOKX: "6A897CF4D6B56AF6B4E39942C8811871",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "dd3f982e-0e20-4ecd-8a03-12d7b0f54586",
        secretKeyOKX: "9F69EEB1A17CCCE9862B797428D56C00",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "a6fd566b-90ed-42c1-8575-1e15c05e395c",
        secretKeyOKX: "77FA24FA1DBFFBA5C9C83367D0EAE676",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "a499fca1-14cd-41c3-a5bc-0eb37581eff9",
        secretKeyOKX: "B8101413760E26278FFAF6F0A2BCEA73",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "c3c7e029-64b7-4704-8fdc-6d1861ad876a",
        secretKeyOKX: "B13A8CFA344038FAACB44A3E92C9C057",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "1974cbac-2a05-4892-88e0-eb262d5d2798",
        secretKeyOKX: "6A24A249F758047057A993D9A460DA7F",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "41826044-b7bb-4465-a903-3da61e336747",
        secretKeyOKX: "F42BD9E95F01BCD248C94EE2EECDE19A",
        PassphraseOKX: "Regi!#007"
    },
    {
        ApiKeyOKX: "08af14cb-2f97-472c-90cd-fefd2103f253",
        secretKeyOKX: "FFC78575E3961D11BF134C8DE9CBE7F8",
        PassphraseOKX: "Regi!#007"
    },
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
    },
    {
    ApiKeyOKX : "45e4e1f1-1229-456f-ad23-8e1341e76683",
    secretKeyOKX : "1BD8AC02C9461A6D1BEBDFE31B3BFF9F",
    PassphraseOKX : "Regi!#007",
    },
];
