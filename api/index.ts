// Vercel Serverless API Handler
// Self-contained Express app for serverless deployment
// This avoids importing the original app.ts which has TS module resolution issues on Vercel

import express from "express";
import cors from "cors";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();
const app = express();

app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNSESymbol(symbol: string, exchange: string = "NSE"): string {
    if (symbol.startsWith("^")) return symbol;
    if (exchange === "INDEX") return symbol;
    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    if (symbol.endsWith(".NS") || symbol.endsWith(".BO")) return symbol;
    return `${symbol}${suffix}`;
}

function formatSymbol(symbol: string): string {
    return symbol.replace(/\.(NS|BO)$/, "");
}

// ─── Technical Calculators ────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number | null {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcSMA(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
    return ema;
}

function calcMACD(closes: number[]) {
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    if (ema12 == null || ema26 == null) return { macd: null, signal: null, histogram: null };
    const macd = ema12 - ema26;
    return { macd, signal: null, histogram: null };
}

function calcBollinger(closes: number[], period = 20) {
    const sma = calcSMA(closes, period);
    if (!sma || closes.length < period) return { upper: null, middle: null, lower: null };
    const slice = closes.slice(-period);
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period);
    return { upper: sma + 2 * std, middle: sma, lower: sma - 2 * std };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
});

// Search
app.get("/api/stocks/search", async (req, res) => {
    try {
        const q = String(req.query.q || "");
        if (!q) return res.json([]);
        const results = await yahooFinance.search(q, { quotesCount: 10 });
        const quotes = (results.quotes || [])
            .filter((r: any) => r.exchange === "NSI" || r.exchange === "NSE" || r.exchange === "BSE" || r.exchange === "BOM" || r.quoteType === "INDEX")
            .map((r: any) => {
                const isIndex = r.quoteType === "INDEX";
                return {
                    symbol: formatSymbol(r.symbol),
                    name: r.shortname || r.longname || r.symbol,
                    exchange: isIndex ? "INDEX" : (r.exchange === "BOM" || r.exchange === "BSE" ? "BSE" : "NSE"),
                    type: isIndex ? "INDEX" : (r.quoteType || "EQUITY"),
                    sector: isIndex ? "Index" : (r.sector || "N/A"),
                    marketCap: null,
                };
            });
        res.json(quotes);
    } catch (err: any) {
        console.error("Search error:", err.message);
        res.json([]);
    }
});

// Quote
app.get("/api/stocks/:symbol/quote", async (req, res) => {
    try {
        const exchange = String(req.query.exchange || "NSE");
        const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
        const quote = await yahooFinance.quote(yahooSymbol);
        res.json({
            symbol: formatSymbol(req.params.symbol),
            name: quote.shortName || quote.longName || req.params.symbol,
            exchange,
            price: quote.regularMarketPrice ?? 0,
            change: quote.regularMarketChange ?? 0,
            changePercent: quote.regularMarketChangePercent ?? 0,
            open: quote.regularMarketOpen ?? 0,
            high: quote.regularMarketDayHigh ?? 0,
            low: quote.regularMarketDayLow ?? 0,
            close: quote.regularMarketPreviousClose ?? 0,
            volume: quote.regularMarketVolume ?? 0,
            marketCap: quote.marketCap ?? 0,
            pe: quote.trailingPE ?? 0,
            eps: quote.epsTrailingTwelveMonths ?? 0,
            week52High: quote.fiftyTwoWeekHigh ?? 0,
            week52Low: quote.fiftyTwoWeekLow ?? 0,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Quote error:", err.message);
        res.status(500).json({ error: "Failed to fetch quote" });
    }
});

// Chart
app.get("/api/stocks/:symbol/chart", async (req, res) => {
    try {
        const exchange = String(req.query.exchange || "NSE");
        const interval = String(req.query.interval || "1d");
        const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
        const cfgMap: any = {
            "1m": { period1: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0], interval: "1m" },
            "5m": { period1: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0], interval: "5m" },
            "15m": { period1: new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0], interval: "15m" },
            "1d": { period1: new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0], interval: "1d" },
            "1wk": { period1: new Date(Date.now() - 3 * 365 * 86400000).toISOString().split("T")[0], interval: "1wk" },
            "1mo": { period1: new Date(Date.now() - 5 * 365 * 86400000).toISOString().split("T")[0], interval: "1mo" },
        };
        const cfg = cfgMap[interval] || cfgMap["1d"];
        const result = await yahooFinance.chart(yahooSymbol, { period1: cfg.period1, interval: cfg.interval });
        const quotes = result.quotes || [];
        const candles = quotes.filter((q: any) => q.close != null).map((q: any) => ({
            time: new Date(q.date).toISOString(),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume || 0,
        }));
        res.json({
            symbol: formatSymbol(req.params.symbol),
            interval,
            candles,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Chart error:", err.message);
        res.status(500).json({ error: "Failed to fetch chart data" });
    }
});

// Analysis
app.get("/api/stocks/:symbol/analysis", async (req, res) => {
    try {
        const exchange = String(req.query.exchange || "NSE");
        const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
        const [quote, chartResult] = await Promise.all([
            yahooFinance.quote(yahooSymbol),
            yahooFinance.chart(yahooSymbol, { period1: new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0], interval: "1d" }),
        ]);
        const closes = (chartResult.quotes || []).filter((q: any) => q.close != null).map((q: any) => q.close);
        const price = quote.regularMarketPrice ?? 0;
        const rsi = calcRSI(closes);
        const { macd } = calcMACD(closes);
        const sma20 = calcSMA(closes, 20);
        const sma50 = calcSMA(closes, 50);
        const sma200 = calcSMA(closes, 200);
        const ema9 = calcEMA(closes, 9);
        const bb = calcBollinger(closes);

        let direction = "Neutral";
        if (rsi && rsi > 60 && price > (sma50 ?? 0)) direction = "Bullish";
        else if (rsi && rsi < 40 && price < (sma50 ?? Infinity)) direction = "Bearish";

        res.json({
            symbol: formatSymbol(req.params.symbol),
            exchange,
            price,
            technicals: { rsi, macd, sma20, sma50, sma200, ema9, bollingerBands: bb },
            bias: { direction, strength: "Moderate", summary: `${direction} bias based on technical indicators` },
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Analysis error:", err.message);
        res.status(500).json({ error: "Failed to fetch analysis" });
    }
});

// Fundamentals
app.get("/api/stocks/:symbol/fundamentals", async (req, res) => {
    try {
        const exchange = String(req.query.exchange || "NSE");
        const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
        const quote = await yahooFinance.quote(yahooSymbol);
        res.json({
            symbol: formatSymbol(req.params.symbol),
            name: quote.shortName || quote.longName || req.params.symbol,
            marketCap: quote.marketCap ?? 0,
            pe: quote.trailingPE ?? null,
            forwardPe: quote.forwardPE ?? null,
            eps: quote.epsTrailingTwelveMonths ?? null,
            pb: quote.priceToBook ?? null,
            dividendYield: quote.dividendYield ?? null,
            week52High: quote.fiftyTwoWeekHigh ?? 0,
            week52Low: quote.fiftyTwoWeekLow ?? 0,
            avgVolume: quote.averageDailyVolume3Month ?? 0,
            beta: quote.beta ?? null,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Fundamentals error:", err.message);
        res.status(500).json({ error: "Failed to fetch fundamentals" });
    }
});

// Events
app.get("/api/stocks/:symbol/events", async (req, res) => {
    try {
        res.json({
            symbol: formatSymbol(req.params.symbol),
            events: [],
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

// Options
app.get("/api/stocks/:symbol/options", async (req, res) => {
    try {
        const exchange = String(req.query.exchange || "NSE");
        const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
        const result = await yahooFinance.options(yahooSymbol);
        res.json({
            symbol: formatSymbol(req.params.symbol),
            expirationDates: result.expirationDates || [],
            calls: (result.options?.[0]?.calls || []).map((c: any) => ({
                strike: c.strike, ltp: c.lastPrice, change: c.change, volume: c.volume || 0,
                oi: c.openInterest || 0, iv: c.impliedVolatility || 0, type: "CE", expiry: "",
                changePercent: c.percentChange || 0, oiChange: 0, bidPrice: c.bid || 0, askPrice: c.ask || 0,
            })),
            puts: (result.options?.[0]?.puts || []).map((p: any) => ({
                strike: p.strike, ltp: p.lastPrice, change: p.change, volume: p.volume || 0,
                oi: p.openInterest || 0, iv: p.impliedVolatility || 0, type: "PE", expiry: "",
                changePercent: p.percentChange || 0, oiChange: 0, bidPrice: p.bid || 0, askPrice: p.ask || 0,
            })),
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("Options error:", err.message);
        res.status(500).json({ error: "Failed to fetch options" });
    }
});

// Futures (stub)
app.get("/api/stocks/:symbol/futures", async (req, res) => {
    res.json({
        symbol: formatSymbol(req.params.symbol),
        spotPrice: 0,
        contracts: [],
        timestamp: new Date().toISOString(),
        dataSource: "mock",
    });
});

// Catch-all for unknown API routes
app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
});

export default app;
