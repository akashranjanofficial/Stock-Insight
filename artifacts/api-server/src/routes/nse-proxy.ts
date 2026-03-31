/**
 * NSE India API Proxy
 *
 * NSE blocks direct calls with simple cookies.
 * This module manages a session with proper headers and cookie rotation.
 * Falls back to realistic mock data when NSE is unreachable.
 */

// ─── SESSION MANAGER ─────────────────────────────────────────────────────────

const NSE_BASE = "https://www.nseindia.com";
const NSE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    Referer: "https://www.nseindia.com/option-chain",
    "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
};

let cachedCookies: string = "";
let cookieTimestamp: number = 0;
const COOKIE_TTL = 90_000; // 90 seconds — NSE cookies expire fast

async function getNSECookies(): Promise<string> {
    if (cachedCookies && Date.now() - cookieTimestamp < COOKIE_TTL) {
        return cachedCookies;
    }

    try {
        // Hit the main page first to get JSESSIONID + other cookies
        const r1 = await fetch(NSE_BASE, {
            headers: NSE_HEADERS,
            redirect: "follow",
        });
        const rawCookies = r1.headers.getSetCookie?.() || [];
        cachedCookies = rawCookies.map((c) => c.split(";")[0]).join("; ");
        cookieTimestamp = Date.now();

        // Warm up: hit a simple endpoint to activate the session
        await fetch(`${NSE_BASE}/api/marketStatus`, {
            headers: { ...NSE_HEADERS, Cookie: cachedCookies },
        });

        return cachedCookies;
    } catch (e) {
        console.error("[NSE] Failed to get cookies:", (e as Error).message);
        return cachedCookies; // return stale cookies if available
    }
}

async function nseFetch<T = any>(path: string, retries = 2): Promise<T | null> {
    for (let i = 0; i <= retries; i++) {
        try {
            const cookies = await getNSECookies();
            const url = `${NSE_BASE}${path}`;
            const res = await fetch(url, {
                headers: { ...NSE_HEADERS, Cookie: cookies },
            });

            if (res.status === 401 || res.status === 403) {
                // Session expired — force refresh
                cachedCookies = "";
                cookieTimestamp = 0;
                continue;
            }

            if (!res.ok) continue;

            const text = await res.text();
            if (text.length <= 2) {
                // NSE returned `{}` — session not valid
                cachedCookies = "";
                cookieTimestamp = 0;
                continue;
            }

            return JSON.parse(text);
        } catch {
            if (i < retries) {
                cachedCookies = "";
                cookieTimestamp = 0;
                await new Promise((r) => setTimeout(r, 500 * (i + 1)));
            }
        }
    }
    return null;
}

// ─── OPTION CHAIN ────────────────────────────────────────────────────────────

export interface OptionContract {
    strike: number;
    type: "CE" | "PE";
    expiry: string;
    ltp: number;
    change: number;
    changePercent: number;
    oi: number;
    oiChange: number;
    volume: number;
    iv: number;
    bidPrice: number;
    askPrice: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
}

export interface OptionChainResponse {
    symbol: string;
    spotPrice: number;
    expiryDates: string[];
    selectedExpiry: string;
    strikes: number[];
    calls: OptionContract[];
    puts: OptionContract[];
    timestamp: string;
    dataSource: "nse" | "mock";
}

function parseNSEOptionChain(data: any, symbol: string, selectedExpiry?: string): OptionChainResponse {
    const records = data?.records || data?.filtered;
    const expiryDates: string[] = data?.records?.expiryDates || [];
    const spotPrice = data?.records?.underlyingValue || data?.underlyingValue || 0;
    const expiry = selectedExpiry || expiryDates[0] || "";

    const calls: OptionContract[] = [];
    const puts: OptionContract[] = [];
    const strikes = new Set<number>();

    const allData = data?.records?.data || data?.filtered?.data || [];

    for (const row of allData) {
        if (selectedExpiry && row.expiryDate !== selectedExpiry) continue;

        const strike = row.strikePrice;
        strikes.add(strike);

        if (row.CE) {
            calls.push({
                strike,
                type: "CE",
                expiry: row.expiryDate,
                ltp: row.CE.lastPrice || 0,
                change: row.CE.change || 0,
                changePercent: row.CE.pchangeinOpenInterest || 0,
                oi: row.CE.openInterest || 0,
                oiChange: row.CE.changeinOpenInterest || 0,
                volume: row.CE.totalTradedVolume || 0,
                iv: row.CE.impliedVolatility || 0,
                bidPrice: row.CE.bidprice || 0,
                askPrice: row.CE.askPrice || 0,
            });
        }

        if (row.PE) {
            puts.push({
                strike,
                type: "PE",
                expiry: row.expiryDate,
                ltp: row.PE.lastPrice || 0,
                change: row.PE.change || 0,
                changePercent: row.PE.pchangeinOpenInterest || 0,
                oi: row.PE.openInterest || 0,
                oiChange: row.PE.changeinOpenInterest || 0,
                volume: row.PE.totalTradedVolume || 0,
                iv: row.PE.impliedVolatility || 0,
                bidPrice: row.PE.bidprice || 0,
                askPrice: row.PE.askPrice || 0,
            });
        }
    }

    return {
        symbol,
        spotPrice,
        expiryDates,
        selectedExpiry: expiry,
        strikes: Array.from(strikes).sort((a, b) => a - b),
        calls: calls.sort((a, b) => a.strike - b.strike),
        puts: puts.sort((a, b) => a.strike - b.strike),
        timestamp: new Date().toISOString(),
        dataSource: "nse",
    };
}

export async function fetchOptionChain(
    symbol: string,
    expiry?: string
): Promise<OptionChainResponse> {
    const cleanSymbol = symbol.toUpperCase().replace(/\.(NS|BO)$/, "");

    // Try NSE for equity options
    const isIndex = cleanSymbol.startsWith("^") || ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(cleanSymbol);
    const nseSymbol = cleanSymbol
        .replace("^NSEI", "NIFTY")
        .replace("^NSEBANK", "BANKNIFTY")
        .replace("^BSESN", "SENSEX");

    const endpoint = isIndex
        ? `/api/option-chain-indices?symbol=${encodeURIComponent(nseSymbol)}`
        : `/api/option-chain-equities?symbol=${encodeURIComponent(nseSymbol)}`;

    const data = await nseFetch(endpoint);

    if (data && data.records && data.records.data?.length > 0) {
        return parseNSEOptionChain(data, cleanSymbol, expiry);
    }

    // Fallback: generate realistic mock data
    return generateMockOptionChain(cleanSymbol, expiry);
}

// ─── FUTURES ─────────────────────────────────────────────────────────────────

export interface FuturesContract {
    symbol: string;
    expiry: string;
    ltp: number;
    change: number;
    changePercent: number;
    oi: number;
    oiChange: number;
    volume: number;
    lotSize: number;
    basis: number;
    prevClose: number;
}

export interface FuturesResponse {
    symbol: string;
    spotPrice: number;
    contracts: FuturesContract[];
    timestamp: string;
    dataSource: "nse" | "mock";
}

export async function fetchFutures(symbol: string): Promise<FuturesResponse> {
    const cleanSymbol = symbol.toUpperCase().replace(/\.(NS|BO)$/, "");
    const nseSymbol = cleanSymbol
        .replace("^NSEI", "NIFTY")
        .replace("^NSEBANK", "BANKNIFTY");

    // Try NSE equity derivatives
    const data = await nseFetch(`/api/quote-derivative?symbol=${encodeURIComponent(nseSymbol)}`);

    if (data && (data.stocks || data.info)) {
        const spotPrice = data.underlyingValue || data.info?.companyName ? 0 : 0;
        const contracts: FuturesContract[] = [];

        for (const stock of (data.stocks || [])) {
            const meta = stock.metadata || {};
            if (meta.instrumentType !== "Stock Futures" && meta.instrumentType !== "Index Futures") continue;

            contracts.push({
                symbol: cleanSymbol,
                expiry: meta.expiryDate || "",
                ltp: meta.lastPrice || 0,
                change: meta.change || 0,
                changePercent: meta.pChange || 0,
                oi: meta.openInterest || 0,
                oiChange: meta.changeinOpenInterest || 0,
                volume: meta.numberOfContractsTraded || 0,
                lotSize: data.info?.lotSize || getLotSize(cleanSymbol),
                basis: (meta.lastPrice || 0) - (data.info?.spotPrice || meta.lastPrice || 0),
                prevClose: meta.previousClose || 0,
            });
        }

        if (contracts.length > 0) {
            return {
                symbol: cleanSymbol,
                spotPrice: data.info?.spotPrice || contracts[0]?.ltp || 0,
                contracts: contracts.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()),
                timestamp: new Date().toISOString(),
                dataSource: "nse",
            };
        }
    }

    // Fallback: mock data
    return generateMockFutures(cleanSymbol);
}

// ─── MOCK DATA GENERATORS ────────────────────────────────────────────────────

function getLotSize(symbol: string): number {
    const lots: Record<string, number> = {
        NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
        RELIANCE: 250, TCS: 150, INFY: 300, HDFCBANK: 550,
        ICICIBANK: 700, SBIN: 1500, TATASTEEL: 1100, AXISBANK: 1200,
        ITC: 1600, WIPRO: 1500, HINDUNILVR: 300, BAJFINANCE: 125,
        LT: 150, KOTAKBANK: 400, MARUTI: 100, ADANIENT: 250,
        TATAMOTORS: 1125, SUNPHARMA: 700, BHARTIARTL: 475,
    };
    return lots[symbol] || 500;
}

function generateMockOptionChain(symbol: string, selectedExpiry?: string): OptionChainResponse {
    // Generate realistic-looking option data based on common Indian stock price ranges
    const spotPrices: Record<string, number> = {
        NIFTY: 22331, BANKNIFTY: 50276, RELIANCE: 1344, TCS: 3450,
        INFY: 1450, HDFCBANK: 1550, ICICIBANK: 1162, SBIN: 731,
        ITC: 420, TATAMOTORS: 640, WIPRO: 280, ADANIENT: 2345,
        SENSEX: 71948, FINNIFTY: 22100,
    };
    const spot = spotPrices[symbol] || 1000;

    // Generate 3 monthly expiry dates
    const now = new Date();
    const expiryDates: string[] = [];
    for (let m = 0; m < 3; m++) {
        const d = new Date(now.getFullYear(), now.getMonth() + m, 0);
        // Find last Thursday
        while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
        expiryDates.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-"));
    }

    const expiry = selectedExpiry || expiryDates[0];

    // Generate strikes around ATM (±10 strikes)
    const step = spot > 10000 ? 100 : spot > 5000 ? 50 : spot > 1000 ? 20 : 10;
    const atmStrike = Math.round(spot / step) * step;
    const strikes: number[] = [];
    for (let i = -12; i <= 12; i++) {
        strikes.push(atmStrike + i * step);
    }

    const calls: OptionContract[] = [];
    const puts: OptionContract[] = [];

    for (const strike of strikes) {
        const moneyness = (spot - strike) / spot;
        const itm = strike < spot; // For calls

        // Black-Scholes-ish approximation for IV and premium
        const baseIV = 15 + Math.abs(moneyness) * 100 + Math.random() * 5;
        const timeValue = Math.max(0, spot * 0.02 * (1 - Math.abs(moneyness) * 10));

        const callIntrinsic = Math.max(0, spot - strike);
        const callPremium = callIntrinsic + timeValue + Math.random() * step * 0.1;
        const callOI = Math.floor((12 - Math.abs(moneyness) * 20) * 100000 * Math.max(0.1, 1 - Math.abs(moneyness) * 3));

        calls.push({
            strike, type: "CE", expiry,
            ltp: Math.round(callPremium * 100) / 100,
            change: Math.round((Math.random() - 0.45) * callPremium * 0.1 * 100) / 100,
            changePercent: Math.round((Math.random() - 0.45) * 10 * 100) / 100,
            oi: Math.max(0, callOI),
            oiChange: Math.floor((Math.random() - 0.4) * callOI * 0.1),
            volume: Math.floor(Math.random() * callOI * 0.3),
            iv: Math.round(baseIV * 100) / 100,
            bidPrice: Math.round((callPremium - step * 0.005) * 100) / 100,
            askPrice: Math.round((callPremium + step * 0.005) * 100) / 100,
        });

        const putIntrinsic = Math.max(0, strike - spot);
        const putPremium = putIntrinsic + timeValue + Math.random() * step * 0.1;
        const putOI = Math.floor((12 - Math.abs(moneyness) * 20) * 100000 * Math.max(0.1, 1 - Math.abs(moneyness) * 3));

        puts.push({
            strike, type: "PE", expiry,
            ltp: Math.round(putPremium * 100) / 100,
            change: Math.round((Math.random() - 0.55) * putPremium * 0.1 * 100) / 100,
            changePercent: Math.round((Math.random() - 0.55) * 10 * 100) / 100,
            oi: Math.max(0, putOI),
            oiChange: Math.floor((Math.random() - 0.4) * putOI * 0.1),
            volume: Math.floor(Math.random() * putOI * 0.3),
            iv: Math.round((baseIV + 2) * 100) / 100,
            bidPrice: Math.round((putPremium - step * 0.005) * 100) / 100,
            askPrice: Math.round((putPremium + step * 0.005) * 100) / 100,
        });
    }

    return {
        symbol, spotPrice: spot, expiryDates, selectedExpiry: expiry,
        strikes, calls, puts,
        timestamp: new Date().toISOString(),
        dataSource: "mock",
    };
}

function generateMockFutures(symbol: string): FuturesResponse {
    const spotPrices: Record<string, number> = {
        NIFTY: 22331, BANKNIFTY: 50276, RELIANCE: 1344, TCS: 3450,
        INFY: 1450, HDFCBANK: 1550, ICICIBANK: 1162, SBIN: 731,
    };
    const spot = spotPrices[symbol] || 1000;
    const lotSize = getLotSize(symbol);

    const now = new Date();
    const contracts: FuturesContract[] = [];

    for (let m = 0; m < 3; m++) {
        const d = new Date(now.getFullYear(), now.getMonth() + m, 0);
        while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
        const expiry = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");

        const premium = spot * (0.002 + m * 0.003) + (Math.random() - 0.5) * spot * 0.002;
        const futPrice = spot + premium;
        const change = (Math.random() - 0.45) * spot * 0.015;

        contracts.push({
            symbol, expiry,
            ltp: Math.round(futPrice * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round((change / spot) * 10000) / 100,
            oi: Math.floor(Math.random() * 50000000 + 5000000),
            oiChange: Math.floor((Math.random() - 0.4) * 2000000),
            volume: Math.floor(Math.random() * 30000000 + 1000000),
            lotSize,
            basis: Math.round(premium * 100) / 100,
            prevClose: Math.round((futPrice - change) * 100) / 100,
        });
    }

    return {
        symbol, spotPrice: spot, contracts,
        timestamp: new Date().toISOString(),
        dataSource: "mock",
    };
}
