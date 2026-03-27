import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const router: IRouter = Router();

function toNSESymbol(symbol: string, exchange: string = "NSE"): string {
  const upper = symbol.toUpperCase();
  if (upper.startsWith("^")) return upper;
  const sym = upper.replace(/\.(NS|BO)$/, "");
  if (exchange === "BSE") return `${sym}.BO`;
  return `${sym}.NS`;
}

function formatSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|BO)$/, "");
}

// ─── Technical Calculators ────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

function calcEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(2));
}

function calcMACD(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (!ema12 || !ema26) return { macd: null, signal: null, histogram: null };
  const macd = parseFloat((ema12 - ema26).toFixed(2));
  const signal = parseFloat((macd * 0.15 + ema26 * 0.85).toFixed(2));
  const histogram = parseFloat((macd - signal).toFixed(2));
  return { macd, signal, histogram };
}

function calcBollinger(closes: number[], period = 20) {
  if (closes.length < period) return { upper: null, middle: null, lower: null };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: parseFloat((mean + 2 * std).toFixed(2)),
    middle: parseFloat(mean.toFixed(2)),
    lower: parseFloat((mean - 2 * std).toFixed(2)),
  };
}

function calcATR(candles: { high: number; low: number; close: number }[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return parseFloat((recent.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

function calcStochastic(candles: { high: number; low: number; close: number }[], period = 14) {
  if (candles.length < period) return { k: null, d: null };
  const recent = candles.slice(-period);
  const highest = Math.max(...recent.map((c) => c.high));
  const lowest = Math.min(...recent.map((c) => c.low));
  if (highest === lowest) return { k: 50, d: 50 };
  const k = parseFloat(((candles[candles.length - 1].close - lowest) / (highest - lowest) * 100).toFixed(2));
  const d = parseFloat((k * 0.33 + 50 * 0.67).toFixed(2));
  return { k, d };
}

function calcVWAP(candles: { high: number; low: number; close: number; volume: number }[]): number | null {
  if (candles.length === 0) return null;
  const recent = candles.slice(-30);
  let cumPV = 0, cumVol = 0;
  for (const c of recent) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
  }
  return cumVol === 0 ? null : parseFloat((cumPV / cumVol).toFixed(2));
}

function calcADX(candles: { high: number; low: number; close: number }[], period = 14): number | null {
  if (candles.length < period * 2) return null;
  const recent = candles.slice(-period * 2);
  let dmPlusSum = 0, dmMinusSum = 0, trSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const dHigh = recent[i].high - recent[i - 1].high;
    const dLow = recent[i - 1].low - recent[i].low;
    const plusDM = dHigh > dLow && dHigh > 0 ? dHigh : 0;
    const minusDM = dLow > dHigh && dLow > 0 ? dLow : 0;
    const tr = Math.max(recent[i].high - recent[i].low, Math.abs(recent[i].high - recent[i - 1].close), Math.abs(recent[i].low - recent[i - 1].close));
    dmPlusSum += plusDM;
    dmMinusSum += minusDM;
    trSum += tr;
  }
  if (trSum === 0) return null;
  const diPlus = (dmPlusSum / trSum) * 100;
  const diMinus = (dmMinusSum / trSum) * 100;
  const dx = diPlus + diMinus === 0 ? 0 : (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
  return parseFloat(dx.toFixed(2));
}

function calcPivot(high: number, low: number, close: number) {
  const pp = (high + low + close) / 3;
  return {
    pivotPoint: parseFloat(pp.toFixed(2)),
    resistance1: parseFloat((2 * pp - low).toFixed(2)),
    resistance2: parseFloat((pp + (high - low)).toFixed(2)),
    support1: parseFloat((2 * pp - high).toFixed(2)),
    support2: parseFloat((pp - (high - low)).toFixed(2)),
  };
}

// ─── Volume Analysis ──────────────────────────────────────────────────────────

function calcVolumeAnalysis(candles: { close: number; open: number; volume: number }[], currentVol: number) {
  const vols = candles.map((c) => c.volume).filter((v) => v > 0);
  const recent20 = vols.slice(-20);
  const avgVolume20d = recent20.length > 0 ? recent20.reduce((a, b) => a + b, 0) / recent20.length : null;
  const volumeRatio = avgVolume20d && avgVolume20d > 0 ? parseFloat((currentVol / avgVolume20d).toFixed(2)) : null;

  // Volume trend over last 10 days
  const last10 = vols.slice(-10);
  const first5avg = last10.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const last5avg = last10.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const volTrend: "INCREASING" | "DECREASING" | "NEUTRAL" =
    last5avg > first5avg * 1.1 ? "INCREASING" : last5avg < first5avg * 0.9 ? "DECREASING" : "NEUTRAL";

  // Is this climax volume? (current > 2x avg)
  const climaxVolume = volumeRatio !== null && volumeRatio > 2.0;
  // Is volume drying up? (current < 0.5x avg)
  const dryUpVolume = volumeRatio !== null && volumeRatio < 0.5;

  // Determine signal based on price action + volume
  const lastCandle = candles[candles.length - 1];
  const priceUp = lastCandle ? lastCandle.close > lastCandle.open : false;

  let signal: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let interpretation = "";

  if (climaxVolume && priceUp) {
    signal = "BULLISH";
    interpretation = "Climax buying volume with price rising — strong demand confirmed by institutional participation.";
  } else if (climaxVolume && !priceUp) {
    signal = "BEARISH";
    interpretation = "Climax selling volume with price falling — strong supply pressure, potential capitulation or distribution.";
  } else if (dryUpVolume && priceUp) {
    signal = "BEARISH";
    interpretation = "Price rising on low volume — weak rally, lack of conviction. Potential false breakout.";
  } else if (dryUpVolume && !priceUp) {
    signal = "BULLISH";
    interpretation = "Price falling on low volume — selling pressure drying up. Potential exhaustion of selling.";
  } else if (volTrend === "INCREASING" && priceUp) {
    signal = "BULLISH";
    interpretation = "Rising volume accompanying price gains — healthy uptrend with increasing participation.";
  } else if (volTrend === "INCREASING" && !priceUp) {
    signal = "BEARISH";
    interpretation = "Rising volume on price decline — bearish distribution pattern with increasing selling pressure.";
  } else if (volTrend === "DECREASING" && priceUp) {
    signal = "NEUTRAL";
    interpretation = "Price rising but volume declining — momentum may be weakening. Watch for reversal.";
  } else {
    signal = "NEUTRAL";
    interpretation = `Volume is ${volTrend.toLowerCase()} at ${volumeRatio !== null ? volumeRatio.toFixed(2) + "x average" : "normal levels"}.`;
  }

  return {
    currentVolume: currentVol,
    avgVolume20d: avgVolume20d ? parseFloat(avgVolume20d.toFixed(0)) : null,
    volumeRatio,
    trend: volTrend,
    signal,
    interpretation,
    climaxVolume,
    dryUpVolume,
    recentVolumes: vols.slice(-20).map((v) => parseFloat(v.toFixed(0))),
  };
}

// ─── Combined Bias Builder ────────────────────────────────────────────────────

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Strength  = "STRONG" | "MODERATE" | "WEAK";
type Signal    = "BULLISH" | "BEARISH" | "NEUTRAL";

interface SignalPoint { label: string; signal: Signal; detail: string }

function buildBias(
  timeframeLabel: string,
  technicalSignals: SignalPoint[],
  fundamentalSignals: SignalPoint[]
) {
  const allSignals = [...technicalSignals, ...fundamentalSignals];
  let bull = allSignals.filter((s) => s.signal === "BULLISH").length;
  let bear = allSignals.filter((s) => s.signal === "BEARISH").length;
  const total = bull + bear + allSignals.filter((s) => s.signal === "NEUTRAL").length;

  let direction: Direction = bull > bear ? "BULLISH" : bear > bull ? "BEARISH" : "NEUTRAL";
  const diff = Math.abs(bull - bear);
  let strength: Strength = diff >= 4 ? "STRONG" : diff >= 2 ? "MODERATE" : "WEAK";
  if (direction === "NEUTRAL") strength = "WEAK";

  const dirText = direction === "BULLISH" ? "bullish" : direction === "BEARISH" ? "bearish" : "neutral";
  const summary = `${timeframeLabel} outlook is ${strength.toLowerCase()} ${dirText}. Technicals: ${bull + bear > 0 ? `${bull} bull / ${bear} bear` : "mixed"}. Fundamentals ${fundamentalSignals.filter(s => s.signal === "BULLISH").length > fundamentalSignals.filter(s => s.signal === "BEARISH").length ? "support the thesis" : fundamentalSignals.filter(s => s.signal === "BEARISH").length > 0 ? "raise concerns" : "are neutral"}.`;

  const keyPoints = [
    ...technicalSignals.filter((s) => s.signal !== "NEUTRAL").slice(0, 3).map((s) => `[Tech] ${s.detail}`),
    ...fundamentalSignals.filter((s) => s.signal !== "NEUTRAL").slice(0, 2).map((s) => `[Fund] ${s.detail}`),
  ];

  return { direction, strength, summary, keyPoints, technicalSignals, fundamentalSignals };
}

function getTechnicalSignals(
  price: number,
  rsi: number | null,
  macd: number | null,
  macdHistogram: number | null,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null,
  ema9: number | null,
  ema21: number | null,
  stochK: number | null,
  adx: number | null,
  bb: { upper: number | null; middle: number | null; lower: number | null },
  vwap: number | null,
  timeframe: "intraday" | "shortTerm" | "longTerm"
): SignalPoint[] {
  const signals: SignalPoint[] = [];

  if (rsi !== null) {
    if (rsi > 70) signals.push({ label: "RSI", signal: "BEARISH", detail: `RSI ${rsi} — overbought, potential reversal risk` });
    else if (rsi < 30) signals.push({ label: "RSI", signal: "BULLISH", detail: `RSI ${rsi} — oversold, potential bounce zone` });
    else if (rsi > 55) signals.push({ label: "RSI", signal: "BULLISH", detail: `RSI ${rsi} — bullish momentum zone` });
    else if (rsi < 45) signals.push({ label: "RSI", signal: "BEARISH", detail: `RSI ${rsi} — bearish momentum zone` });
    else signals.push({ label: "RSI", signal: "NEUTRAL", detail: `RSI ${rsi} — neutral zone (45-55)` });
  }

  if (macd !== null) {
    const h = macdHistogram ?? 0;
    if (macd > 0 && h > 0) signals.push({ label: "MACD", signal: "BULLISH", detail: `MACD ${macd.toFixed(2)} above zero, histogram expanding bullish` });
    else if (macd > 0 && h < 0) signals.push({ label: "MACD", signal: "NEUTRAL", detail: `MACD positive but histogram contracting — momentum fading` });
    else if (macd < 0 && h < 0) signals.push({ label: "MACD", signal: "BEARISH", detail: `MACD ${macd.toFixed(2)} below zero, histogram expanding bearish` });
    else signals.push({ label: "MACD", signal: "NEUTRAL", detail: `MACD below zero but recovering — early sign of reversal` });
  }

  if (timeframe === "intraday" || timeframe === "shortTerm") {
    if (sma20 !== null) {
      if (price > sma20) signals.push({ label: "SMA20", signal: "BULLISH", detail: `Price ${price.toFixed(2)} above SMA20 ${sma20} — short-term uptrend intact` });
      else signals.push({ label: "SMA20", signal: "BEARISH", detail: `Price ${price.toFixed(2)} below SMA20 ${sma20} — short-term downtrend` });
    }
    if (vwap !== null && timeframe === "intraday") {
      if (price > vwap) signals.push({ label: "VWAP", signal: "BULLISH", detail: `Price above VWAP ${vwap.toFixed(2)} — intraday buyers in control` });
      else signals.push({ label: "VWAP", signal: "BEARISH", detail: `Price below VWAP ${vwap.toFixed(2)} — intraday sellers dominant` });
    }
  }

  if (timeframe === "shortTerm" || timeframe === "longTerm") {
    if (sma50 !== null) {
      if (price > sma50) signals.push({ label: "SMA50", signal: "BULLISH", detail: `Price above SMA50 ${sma50} — intermediate uptrend` });
      else signals.push({ label: "SMA50", signal: "BEARISH", detail: `Price below SMA50 ${sma50} — intermediate downtrend` });
    }
  }

  if (timeframe === "longTerm" && sma200 !== null) {
    if (price > sma200) signals.push({ label: "SMA200", signal: "BULLISH", detail: `Price above SMA200 ${sma200} — secular bullish trend` });
    else signals.push({ label: "SMA200", signal: "BEARISH", detail: `Price below SMA200 ${sma200} — secular bearish trend` });
  }

  if (stochK !== null) {
    if (stochK > 80) signals.push({ label: "Stochastic", signal: "BEARISH", detail: `Stoch %K ${stochK} — overbought territory` });
    else if (stochK < 20) signals.push({ label: "Stochastic", signal: "BULLISH", detail: `Stoch %K ${stochK} — oversold territory, reversal likely` });
    else signals.push({ label: "Stochastic", signal: "NEUTRAL", detail: `Stoch %K ${stochK} — neutral range` });
  }

  if (adx !== null) {
    if (adx > 25) signals.push({ label: "ADX", signal: "NEUTRAL", detail: `ADX ${adx.toFixed(1)} — strong trend detected (price confirms direction)` });
    else signals.push({ label: "ADX", signal: "NEUTRAL", detail: `ADX ${adx.toFixed(1)} — weak/ranging market, trend signals less reliable` });
  }

  if (bb.upper !== null && bb.lower !== null) {
    if (price >= bb.upper) signals.push({ label: "Bollinger", signal: "BEARISH", detail: `Price at upper Bollinger Band ${bb.upper.toFixed(2)} — overbought / mean-reversion risk` });
    else if (price <= bb.lower) signals.push({ label: "Bollinger", signal: "BULLISH", detail: `Price at lower Bollinger Band ${bb.lower.toFixed(2)} — oversold / bounce potential` });
    else signals.push({ label: "Bollinger", signal: "NEUTRAL", detail: `Price inside Bollinger Bands — consolidation phase` });
  }

  return signals;
}

function getFundamentalSignals(fundData: any, volAnalysis: any): SignalPoint[] {
  const signals: SignalPoint[] = [];

  if (fundData?.pe !== null && fundData?.pe !== undefined) {
    const pe = fundData.pe;
    if (pe > 0 && pe < 15) signals.push({ label: "P/E Ratio", signal: "BULLISH", detail: `P/E ${pe.toFixed(1)}x — undervalued relative to market norms` });
    else if (pe > 50) signals.push({ label: "P/E Ratio", signal: "BEARISH", detail: `P/E ${pe.toFixed(1)}x — richly valued, growth must justify premium` });
    else if (pe > 25) signals.push({ label: "P/E Ratio", signal: "NEUTRAL", detail: `P/E ${pe.toFixed(1)}x — fairly valued for quality business` });
    else if (pe > 0) signals.push({ label: "P/E Ratio", signal: "BULLISH", detail: `P/E ${pe.toFixed(1)}x — reasonable valuation` });
    else signals.push({ label: "P/E Ratio", signal: "BEARISH", detail: `Negative earnings — company is loss-making` });
  }

  if (fundData?.roe !== null && fundData?.roe !== undefined) {
    const roe = fundData.roe;
    if (roe > 20) signals.push({ label: "ROE", signal: "BULLISH", detail: `ROE ${roe.toFixed(1)}% — excellent capital efficiency (>20%)` });
    else if (roe > 12) signals.push({ label: "ROE", signal: "NEUTRAL", detail: `ROE ${roe.toFixed(1)}% — decent capital returns` });
    else signals.push({ label: "ROE", signal: "BEARISH", detail: `ROE ${roe.toFixed(1)}% — poor capital efficiency` });
  }

  if (fundData?.debtToEquity !== null && fundData?.debtToEquity !== undefined) {
    const de = fundData.debtToEquity;
    if (de < 0.3) signals.push({ label: "Debt/Equity", signal: "BULLISH", detail: `D/E ${de.toFixed(2)} — minimal leverage, strong balance sheet` });
    else if (de < 1.0) signals.push({ label: "Debt/Equity", signal: "NEUTRAL", detail: `D/E ${de.toFixed(2)} — moderate leverage, manageable debt` });
    else signals.push({ label: "Debt/Equity", signal: "BEARISH", detail: `D/E ${de.toFixed(2)} — high leverage, increased financial risk` });
  }

  if (fundData?.revenueGrowthYoy !== null && fundData?.revenueGrowthYoy !== undefined) {
    const rg = fundData.revenueGrowthYoy;
    if (rg > 15) signals.push({ label: "Revenue Growth", signal: "BULLISH", detail: `Revenue grew ${rg.toFixed(1)}% YoY — strong top-line momentum` });
    else if (rg > 5) signals.push({ label: "Revenue Growth", signal: "NEUTRAL", detail: `Revenue grew ${rg.toFixed(1)}% YoY — moderate growth` });
    else if (rg < 0) signals.push({ label: "Revenue Growth", signal: "BEARISH", detail: `Revenue declined ${Math.abs(rg).toFixed(1)}% YoY — business headwinds` });
    else signals.push({ label: "Revenue Growth", signal: "NEUTRAL", detail: `Revenue grew ${rg.toFixed(1)}% YoY — slow growth` });
  }

  if (fundData?.profitGrowthYoy !== null && fundData?.profitGrowthYoy !== undefined) {
    const pg = fundData.profitGrowthYoy;
    if (pg > 20) signals.push({ label: "Profit Growth", signal: "BULLISH", detail: `Profit grew ${pg.toFixed(1)}% YoY — strong earnings expansion` });
    else if (pg < 0) signals.push({ label: "Profit Growth", signal: "BEARISH", detail: `Profit declined ${Math.abs(pg).toFixed(1)}% YoY — earnings contraction` });
    else signals.push({ label: "Profit Growth", signal: "NEUTRAL", detail: `Profit grew ${pg.toFixed(1)}% YoY` });
  }

  if (fundData?.currentRatio !== null && fundData?.currentRatio !== undefined) {
    const cr = fundData.currentRatio;
    if (cr > 2) signals.push({ label: "Current Ratio", signal: "BULLISH", detail: `Current ratio ${cr.toFixed(2)} — strong short-term liquidity` });
    else if (cr > 1) signals.push({ label: "Current Ratio", signal: "NEUTRAL", detail: `Current ratio ${cr.toFixed(2)} — adequate liquidity` });
    else signals.push({ label: "Current Ratio", signal: "BEARISH", detail: `Current ratio ${cr.toFixed(2)} — potential liquidity risk` });
  }

  // Volume as a fundamental confirmation
  if (volAnalysis) {
    if (volAnalysis.signal === "BULLISH") {
      signals.push({ label: "Volume Trend", signal: "BULLISH", detail: volAnalysis.interpretation });
    } else if (volAnalysis.signal === "BEARISH") {
      signals.push({ label: "Volume Trend", signal: "BEARISH", detail: volAnalysis.interpretation });
    } else {
      signals.push({ label: "Volume Trend", signal: "NEUTRAL", detail: volAnalysis.interpretation });
    }
  }

  return signals;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) { res.json([]); return; }
    const results = await yahooFinance.search(q, { newsCount: 0, quotesCount: 10 });
    const quotes = (results.quotes || [])
      .filter((r: any) =>
        (r.quoteType === "EQUITY" && ((r.symbol || "").endsWith(".NS") || (r.symbol || "").endsWith(".BO"))) ||
        (r.quoteType === "INDEX" && (r.symbol || "").startsWith("^"))
      )
      .slice(0, 8)
      .map((r: any) => {
        const isIndex = r.quoteType === "INDEX";
        return {
          symbol: isIndex ? r.symbol : formatSymbol(r.symbol),
          name: r.longname || r.shortname || r.symbol,
          exchange: isIndex ? "INDEX" : ((r.symbol || "").endsWith(".BO") ? "BSE" : "NSE"),
          sector: isIndex ? "Index" : (r.sector || "N/A"),
          marketCap: null,
        };
      });
    res.json(quotes);
  } catch (err: any) {
    req.log.error({ err }, "Search error");
    res.json([]);
  }
});

router.get("/:symbol/quote", async (req, res) => {
  try {
    const exchange = String(req.query.exchange || "NSE");
    const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
    const quote = await yahooFinance.quote(yahooSymbol);
    res.json({
      symbol: formatSymbol(yahooSymbol),
      name: quote.longName || quote.shortName || req.params.symbol,
      exchange,
      price: quote.regularMarketPrice ?? 0,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      open: quote.regularMarketOpen ?? 0,
      high: quote.regularMarketDayHigh ?? 0,
      low: quote.regularMarketDayLow ?? 0,
      previousClose: quote.regularMarketPreviousClose ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume: quote.averageDailyVolume10Day ?? 0,
      marketCap: quote.marketCap ?? null,
      week52High: quote.fiftyTwoWeekHigh ?? 0,
      week52Low: quote.fiftyTwoWeekLow ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Quote error");
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

router.get("/:symbol/chart", async (req, res) => {
  try {
    const exchange = String(req.query.exchange || "NSE");
    const interval = String(req.query.interval || "1d");
    const yahooSymbol = toNSESymbol(req.params.symbol, exchange);

    const cfgMap: Record<string, { period1: string; interval: any }> = {
      "5m":  { period1: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0], interval: "5m" },
      "15m": { period1: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0], interval: "15m" },
      "30m": { period1: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0], interval: "30m" },
      "1h":  { period1: new Date(Date.now() - 20 * 86400000).toISOString().split("T")[0], interval: "1h" },
      "4h":  { period1: new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0], interval: "60m" },
      "1d":  { period1: new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0], interval: "1d" },
      "1wk": { period1: new Date(Date.now() - 3 * 365 * 86400000).toISOString().split("T")[0], interval: "1wk" },
      "1mo": { period1: new Date(Date.now() - 5 * 365 * 86400000).toISOString().split("T")[0], interval: "1mo" },
    };
    const cfg = cfgMap[interval] || cfgMap["1d"];
    const historical = await yahooFinance.chart(yahooSymbol, { period1: cfg.period1, interval: cfg.interval });

    const candles = (historical.quotes || [])
      .filter((c: any) => c.open != null && c.close != null)
      .map((c: any) => ({
        time: Math.floor(new Date(c.date).getTime() / 1000),
        open: parseFloat((c.open ?? 0).toFixed(2)),
        high: parseFloat((c.high ?? 0).toFixed(2)),
        low: parseFloat((c.low ?? 0).toFixed(2)),
        close: parseFloat((c.close ?? 0).toFixed(2)),
        volume: c.volume ?? 0,
      }));
    res.json(candles);
  } catch (err: any) {
    req.log.error({ err }, "Chart error");
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

router.get("/:symbol/analysis", async (req, res) => {
  try {
    const exchange = String(req.query.exchange || "NSE");
    const yahooSymbol = toNSESymbol(req.params.symbol, exchange);

    // Fetch daily price history + live quote + fundamentals in parallel
    const [dailyData, quote, fundSummary] = await Promise.all([
      yahooFinance.chart(yahooSymbol, {
        period1: new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0],
        interval: "1d",
      }),
      yahooFinance.quote(yahooSymbol),
      yahooFinance.quoteSummary(yahooSymbol, {
        modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
      }).catch(() => null),
    ]);

    const candles = (dailyData.quotes || []).filter((c: any) => c.open != null && c.close != null);
    const closes  = candles.map((c: any) => c.close as number);
    const price   = quote.regularMarketPrice ?? (closes[closes.length - 1] ?? 0);
    const currentVol = quote.regularMarketVolume ?? 0;

    // Build fundamentals snapshot for signal generation
    const fd  = fundSummary?.financialData;
    const ks  = fundSummary?.defaultKeyStatistics;
    const sd  = fundSummary?.summaryDetail;
    const fundData = {
      pe:                sd?.trailingPE ?? null,
      pb:                ks?.priceToBook ?? null,
      roe:               fd?.returnOnEquity ? fd.returnOnEquity * 100 : null,
      debtToEquity:      fd?.debtToEquity ?? null,
      currentRatio:      fd?.currentRatio ?? null,
      revenueGrowthYoy:  fd?.revenueGrowth ? fd.revenueGrowth * 100 : null,
      profitGrowthYoy:   fd?.earningsGrowth ? fd.earningsGrowth * 100 : null,
    };

    // Technical indicators
    const rsi           = calcRSI(closes);
    const { macd, macdSignal, macdHistogram } = calcMACD(closes);
    const sma20         = calcSMA(closes, 20);
    const sma50         = calcSMA(closes, 50);
    const sma200        = calcSMA(closes, 200);
    const ema9          = calcEMA(closes, 9);
    const ema21         = calcEMA(closes, 21);
    const bb            = calcBollinger(closes);
    const atr           = calcATR(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const adx           = calcADX(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const stoch         = calcStochastic(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const vwap          = calcVWAP(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 })));
    const lastCandle    = candles[candles.length - 1];
    const pivot         = lastCandle ? calcPivot(lastCandle.high, lastCandle.low, lastCandle.close) : { pivotPoint: null, resistance1: null, resistance2: null, support1: null, support2: null };

    // Volume analysis
    const volumeAnalysis = calcVolumeAnalysis(
      candles.map((c: any) => ({ close: c.close, open: c.open, volume: c.volume ?? 0 })),
      currentVol
    );

    // Build signals per timeframe
    const techIntraday   = getTechnicalSignals(price, rsi, macd, macdHistogram, sma20, sma50, sma200, ema9, ema21, stoch.k, adx, bb, vwap, "intraday");
    const techShortTerm  = getTechnicalSignals(price, rsi, macd, macdHistogram, sma20, sma50, sma200, ema9, ema21, stoch.k, adx, bb, vwap, "shortTerm");
    const techLongTerm   = getTechnicalSignals(price, rsi, macd, macdHistogram, sma20, sma50, sma200, ema9, ema21, stoch.k, adx, bb, vwap, "longTerm");
    const fundSignals    = getFundamentalSignals(fundData, volumeAnalysis);

    const intraday  = buildBias("Intraday",         techIntraday,  fundSignals);
    const shortTerm = buildBias("Short-term",       techShortTerm, fundSignals);
    const longTerm  = buildBias("Long-term",        techLongTerm,  fundSignals);

    // Overall
    const allBull = [intraday, shortTerm, longTerm].filter((b) => b.direction === "BULLISH").length;
    const allBear = [intraday, shortTerm, longTerm].filter((b) => b.direction === "BEARISH").length;
    const overallDir: Direction = allBull > allBear ? "BULLISH" : allBear > allBull ? "BEARISH" : "NEUTRAL";
    const overallStr: Strength  = Math.abs(allBull - allBear) >= 2 ? "STRONG" : Math.abs(allBull - allBear) === 1 ? "MODERATE" : "WEAK";
    const overallBias = buildBias("Overall", techShortTerm, fundSignals);
    overallBias.direction = overallDir;
    overallBias.strength = overallStr;
    overallBias.summary = `Overall consensus is ${overallStr.toLowerCase()} ${overallDir.toLowerCase()}: ${allBull}/3 timeframes bullish, ${allBear}/3 bearish.`;
    overallBias.keyPoints = [
      `Intraday: ${intraday.direction} (${intraday.strength})`,
      `Short-term: ${shortTerm.direction} (${shortTerm.strength})`,
      `Long-term: ${longTerm.direction} (${longTerm.strength})`,
      `Volume: ${volumeAnalysis.signal} — ratio ${volumeAnalysis.volumeRatio?.toFixed(2) ?? "N/A"}x avg`,
    ];

    res.json({
      symbol: formatSymbol(yahooSymbol),
      technicalIndicators: {
        rsi, macd, macdSignal, macdHistogram,
        sma20, sma50, sma200, ema9, ema21,
        bollingerUpper: bb.upper, bollingerMiddle: bb.middle, bollingerLower: bb.lower,
        atr, adx, stochK: stoch.k, stochD: stoch.d, vwap,
        ...pivot,
      },
      intraday,
      shortTerm,
      longTerm,
      overallBias,
      volumeAnalysis,
    });
  } catch (err: any) {
    req.log.error({ err }, "Analysis error");
    res.status(500).json({ error: "Failed to compute analysis" });
  }
});

router.get("/:symbol/fundamentals", async (req, res) => {
  try {
    const exchange = String(req.query.exchange || "NSE");
    const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
    const summary = await yahooFinance.quoteSummary(yahooSymbol, {
      modules: ["financialData", "defaultKeyStatistics", "summaryProfile", "summaryDetail"],
    });
    const fd = summary.financialData;
    const ks = summary.defaultKeyStatistics;
    const sp = summary.summaryProfile;
    const sd = summary.summaryDetail;
    res.json({
      symbol: formatSymbol(yahooSymbol),
      pe: sd?.trailingPE ?? null,
      pb: ks?.priceToBook ?? null,
      eps: ks?.trailingEps ?? null,
      roe: fd?.returnOnEquity ? parseFloat((fd.returnOnEquity * 100).toFixed(2)) : null,
      roce: null,
      debtToEquity: fd?.debtToEquity ?? null,
      currentRatio: fd?.currentRatio ?? null,
      revenueGrowthYoy: fd?.revenueGrowth ? parseFloat((fd.revenueGrowth * 100).toFixed(2)) : null,
      profitGrowthYoy: fd?.earningsGrowth ? parseFloat((fd.earningsGrowth * 100).toFixed(2)) : null,
      dividendYield: sd?.dividendYield ? parseFloat((sd.dividendYield * 100).toFixed(2)) : null,
      bookValue: ks?.bookValue ?? null,
      faceValue: null,
      promoterHolding: null,
      fiisHolding: null,
      diisHolding: null,
      publicHolding: null,
      sector: sp?.sector ?? null,
      industry: sp?.industry ?? null,
      description: sp?.longBusinessSummary ?? null,
      marketCap: sd?.marketCap ?? null,
      enterpriseValue: ks?.enterpriseValue ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "Fundamentals error");
    res.status(500).json({ error: "Failed to fetch fundamentals" });
  }
});

router.get("/:symbol/events", async (req, res) => {
  try {
    const exchange = String(req.query.exchange || "NSE");
    const yahooSymbol = toNSESymbol(req.params.symbol, exchange);
    const symbol = formatSymbol(req.params.symbol);

    let calendarEvents: any = null;
    try {
      calendarEvents = await yahooFinance.quoteSummary(yahooSymbol, {
        modules: ["calendarEvents", "upgradeDowngradeHistory"],
      });
    } catch (_) {}

    const majorEvents: any[] = [];
    const microEvents: any[] = [];

    const earnings = calendarEvents?.calendarEvents?.earnings;
    if (earnings?.earningsDate) {
      const dates = Array.isArray(earnings.earningsDate) ? earnings.earningsDate : [earnings.earningsDate];
      for (const d of dates) {
        majorEvents.push({
          id: `earnings-${d}`,
          type: "EARNINGS",
          title: `${symbol} Quarterly Earnings`,
          description: `Results announcement expected. EPS estimate: ${earnings.earningsAverage ?? "N/A"}. Beat/miss could cause 5-10% move.`,
          date: new Date(d).toISOString().split("T")[0],
          impact: "HIGH",
          sentiment: "NEUTRAL",
          isMajor: true,
        });
      }
    }

    if (calendarEvents?.calendarEvents?.dividendDate) {
      majorEvents.push({
        id: "dividend",
        type: "DIVIDEND",
        title: `${symbol} Ex-Dividend Date`,
        description: `Stock typically drops by dividend amount on ex-date. Dividend investors should act before this date.`,
        date: new Date(calendarEvents.calendarEvents.dividendDate).toISOString().split("T")[0],
        impact: "MEDIUM",
        sentiment: "POSITIVE",
        isMajor: true,
      });
    }

    const upgrades = calendarEvents?.upgradeDowngradeHistory?.history ?? [];
    for (const u of upgrades.slice(0, 5)) {
      microEvents.push({
        id: `analyst-${u.epochGradeDate}`,
        type: "OTHER",
        title: `${u.firm}: ${u.action === "up" ? "Upgrade" : u.action === "down" ? "Downgrade" : "Rating Change"}`,
        description: `Analyst action: ${u.fromGrade ? `${u.fromGrade} → ` : ""}${u.toGrade}. Analyst upgrades/downgrades often trigger institutional flows.`,
        date: new Date(u.epochGradeDate * 1000).toISOString().split("T")[0],
        impact: "MEDIUM",
        sentiment: u.action === "up" ? "POSITIVE" : u.action === "down" ? "NEGATIVE" : "NEUTRAL",
        isMajor: false,
      });
    }

    majorEvents.push({
      id: "rbi-policy",
      type: "MACRO",
      title: "RBI Monetary Policy Decision",
      description: "RBI MPC meeting: Interest rate decisions directly affect borrowing costs, bank margins, and equity valuations. Rate cuts are bullish; hikes compress P/E multiples.",
      date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      impact: "HIGH",
      sentiment: "NEUTRAL",
      isMajor: true,
    });

    majorEvents.push({
      id: "budget",
      type: "MACRO",
      title: "Union Budget 2025-26",
      description: "Sector-specific allocations, LTCG/STCG tax rates, capital expenditure targets. Markets typically see elevated volatility around budget day.",
      date: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
      impact: "HIGH",
      sentiment: "NEUTRAL",
      isMajor: true,
    });

    microEvents.push({
      id: "fii-activity",
      type: "SECTOR",
      title: "FII/DII Institutional Flows",
      description: "Net FII selling creates selling pressure especially in large-cap stocks. Track daily FII data — sustained selling triggers margin calls and further downside.",
      date: new Date().toISOString().split("T")[0],
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      isMajor: false,
    });

    microEvents.push({
      id: "us-fed",
      type: "MACRO",
      title: "US Federal Reserve FOMC",
      description: "Fed rate decisions drive global risk appetite. Dovish Fed → EM capital inflows, stronger rupee. Hawkish Fed → FII outflows from India.",
      date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      isMajor: false,
    });

    microEvents.push({
      id: "crude-oil",
      type: "MACRO",
      title: "Crude Oil Price Movement",
      description: "India imports ~85% of its crude. Rising crude widens CAD, weakens rupee, raises input costs for many sectors. Watch Brent crude levels.",
      date: new Date().toISOString().split("T")[0],
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      isMajor: false,
    });

    res.json({ symbol, majorEvents, microEvents });
  } catch (err: any) {
    req.log.error({ err }, "Events error");
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
