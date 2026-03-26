import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const router: IRouter = Router();

function toNSESymbol(symbol: string, exchange: string = "NSE"): string {
  const sym = symbol.toUpperCase().replace(/\.(NS|BO)$/, "");
  if (exchange === "BSE") return `${sym}.BO`;
  return `${sym}.NS`;
}

function formatSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|BO)$/, "");
}

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

function calcBollinger(closes: number[], period = 20): { upper: number | null; middle: number | null; lower: number | null } {
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

function calcStochastic(candles: { high: number; low: number; close: number }[], period = 14): { k: number | null; d: number | null } {
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
  const r1 = 2 * pp - low;
  const r2 = pp + (high - low);
  const s1 = 2 * pp - high;
  const s2 = pp - (high - low);
  return {
    pivotPoint: parseFloat(pp.toFixed(2)),
    resistance1: parseFloat(r1.toFixed(2)),
    resistance2: parseFloat(r2.toFixed(2)),
    support1: parseFloat(s1.toFixed(2)),
    support2: parseFloat(s2.toFixed(2)),
  };
}

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Strength = "STRONG" | "MODERATE" | "WEAK";

function determineBias(
  rsi: number | null,
  macd: number | null,
  price: number,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null,
  timeframe: string
): { direction: Direction; strength: Strength; summary: string; keyPoints: string[] } {
  let bullScore = 0, bearScore = 0;
  const keyPoints: string[] = [];

  if (rsi !== null) {
    if (rsi > 60) { bullScore += 2; keyPoints.push(`RSI at ${rsi} - bullish momentum`); }
    else if (rsi < 40) { bearScore += 2; keyPoints.push(`RSI at ${rsi} - bearish momentum`); }
    else { keyPoints.push(`RSI at ${rsi} - neutral zone`); }
  }

  if (macd !== null) {
    if (macd > 0) { bullScore += 1; keyPoints.push("MACD above zero - upward trend"); }
    else { bearScore += 1; keyPoints.push("MACD below zero - downward pressure"); }
  }

  if (sma20 !== null) {
    if (price > sma20) { bullScore += 1; keyPoints.push(`Price above SMA20 (${sma20})`); }
    else { bearScore += 1; keyPoints.push(`Price below SMA20 (${sma20})`); }
  }

  if (sma50 !== null) {
    if (price > sma50) { bullScore += 1; keyPoints.push(`Price above SMA50 (${sma50})`); }
    else { bearScore += 1; keyPoints.push(`Price below SMA50 (${sma50})`); }
  }

  if (sma200 !== null) {
    if (price > sma200) { bullScore += 2; keyPoints.push(`Price above SMA200 (${sma200}) - long-term bullish`); }
    else { bearScore += 2; keyPoints.push(`Price below SMA200 (${sma200}) - long-term bearish`); }
  }

  const total = bullScore + bearScore;
  let direction: Direction = "NEUTRAL";
  let strength: Strength = "WEAK";

  if (bullScore > bearScore) {
    direction = "BULLISH";
    const ratio = bullScore / (total || 1);
    strength = ratio > 0.7 ? "STRONG" : ratio > 0.55 ? "MODERATE" : "WEAK";
  } else if (bearScore > bullScore) {
    direction = "BEARISH";
    const ratio = bearScore / (total || 1);
    strength = ratio > 0.7 ? "STRONG" : ratio > 0.55 ? "MODERATE" : "WEAK";
  }

  const dirText = direction === "BULLISH" ? "bullish" : direction === "BEARISH" ? "bearish" : "neutral";
  const summary = `${timeframe} outlook is ${strength.toLowerCase()} ${dirText} based on current technical indicators.`;

  return { direction, strength, summary, keyPoints: keyPoints.slice(0, 4) };
}

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.json([]);
      return;
    }

    const results = await yahooFinance.search(q, { newsCount: 0, quotesCount: 10 });
    const quotes = (results.quotes || [])
      .filter((r: any) => r.quoteType === "EQUITY" && (r.exchange === "NSI" || r.exchange === "BSE" || (r.symbol || "").endsWith(".NS") || (r.symbol || "").endsWith(".BO")))
      .slice(0, 8)
      .map((r: any) => ({
        symbol: formatSymbol(r.symbol),
        name: r.longname || r.shortname || r.symbol,
        exchange: (r.symbol || "").endsWith(".BO") ? "BSE" : "NSE",
        sector: r.sector || "N/A",
        marketCap: null,
      }));

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

    const data = {
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
    };

    res.json(data);
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

    const intervalMap: Record<string, { period1: string; interval: any }> = {
      "5m":  { period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "5m" },
      "15m": { period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "15m" },
      "30m": { period1: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "30m" },
      "1h":  { period1: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "1h" },
      "4h":  { period1: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "60m" },
      "1d":  { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "1d" },
      "1wk": { period1: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "1wk" },
      "1mo": { period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], interval: "1mo" },
    };

    const cfg = intervalMap[interval] || intervalMap["1d"];
    const historical = await yahooFinance.chart(yahooSymbol, {
      period1: cfg.period1,
      interval: cfg.interval,
    });

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

    const [dailyData, quote] = await Promise.all([
      yahooFinance.chart(yahooSymbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        interval: "1d",
      }),
      yahooFinance.quote(yahooSymbol),
    ]);

    const candles = (dailyData.quotes || []).filter((c: any) => c.open != null && c.close != null);
    const closes = candles.map((c: any) => c.close as number);
    const price = quote.regularMarketPrice ?? (closes[closes.length - 1] ?? 0);

    const rsi = calcRSI(closes);
    const { macd, macdSignal, macdHistogram } = calcMACD(closes);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const bb = calcBollinger(closes);
    const atr = calcATR(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const adx = calcADX(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const stoch = calcStochastic(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close })));
    const vwap = calcVWAP(candles.map((c: any) => ({ high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 })));

    const lastCandle = candles[candles.length - 1];
    const pivot = lastCandle ? calcPivot(lastCandle.high, lastCandle.low, lastCandle.close) : { pivotPoint: null, resistance1: null, resistance2: null, support1: null, support2: null };

    const intraday = determineBias(rsi, macd, price, sma20, ema9, ema21, "Intraday");
    const shortTerm = determineBias(rsi, macd, price, sma20, sma50, null, "Short-term (1-4 weeks)");
    const longTerm = determineBias(rsi, macd, price, sma50, sma200, null, "Long-term (3-12 months)");

    let bullCount = [intraday, shortTerm, longTerm].filter(b => b.direction === "BULLISH").length;
    let bearCount = [intraday, shortTerm, longTerm].filter(b => b.direction === "BEARISH").length;
    let overallDir: Direction = bullCount > bearCount ? "BULLISH" : bearCount > bullCount ? "BEARISH" : "NEUTRAL";
    let overallStrength: Strength = Math.abs(bullCount - bearCount) >= 2 ? "STRONG" : Math.abs(bullCount - bearCount) === 1 ? "MODERATE" : "WEAK";

    const overallBias = {
      direction: overallDir,
      strength: overallStrength,
      summary: `Overall technical picture is ${overallStrength.toLowerCase()} ${overallDir.toLowerCase()} across timeframes.`,
      keyPoints: [
        `Intraday: ${intraday.direction} (${intraday.strength})`,
        `Short-term: ${shortTerm.direction} (${shortTerm.strength})`,
        `Long-term: ${longTerm.direction} (${longTerm.strength})`,
        `RSI: ${rsi ?? "N/A"} | MACD: ${macd ?? "N/A"}`,
      ],
    };

    res.json({
      symbol: formatSymbol(yahooSymbol),
      technicalIndicators: {
        rsi,
        macd,
        macdSignal,
        macdHistogram,
        sma20,
        sma50,
        sma200,
        ema9,
        ema21,
        bollingerUpper: bb.upper,
        bollingerMiddle: bb.middle,
        bollingerLower: bb.lower,
        atr,
        adx,
        stochK: stoch.k,
        stochD: stoch.d,
        vwap,
        ...pivot,
      },
      intraday,
      shortTerm,
      longTerm,
      overallBias,
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
      pe: sd?.trailingPE ?? ks?.trailingEps ? (sd?.trailingPE ?? null) : null,
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
          title: `${symbol} Earnings Date`,
          description: `Quarterly earnings announcement expected. EPS estimate: ${earnings.earningsAverage ?? "N/A"}`,
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
        title: `${symbol} Dividend`,
        description: `Ex-dividend date: ${new Date(calendarEvents.calendarEvents.dividendDate).toLocaleDateString("en-IN")}`,
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
        title: `${u.firm} - ${u.action === "up" ? "Upgrade" : u.action === "down" ? "Downgrade" : "Rating"}`,
        description: `Analyst action: ${u.fromGrade ? `${u.fromGrade} → ` : ""}${u.toGrade}`,
        date: new Date(u.epochGradeDate * 1000).toISOString().split("T")[0],
        impact: "MEDIUM",
        sentiment: u.action === "up" ? "POSITIVE" : u.action === "down" ? "NEGATIVE" : "NEUTRAL",
        isMajor: false,
      });
    }

    majorEvents.push({
      id: "rbi-policy",
      type: "MACRO",
      title: "RBI Monetary Policy",
      description: "RBI MPC meeting outcome and interest rate decisions can affect equity markets and rate-sensitive sectors.",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      impact: "HIGH",
      sentiment: "NEUTRAL",
      isMajor: true,
    });

    majorEvents.push({
      id: "budget",
      type: "MACRO",
      title: "Union Budget Expectations",
      description: "Upcoming Union Budget may impact sector-specific allocations, tax structures, and capital markets.",
      date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      impact: "HIGH",
      sentiment: "NEUTRAL",
      isMajor: true,
    });

    microEvents.push({
      id: "fii-activity",
      type: "SECTOR",
      title: "FII/DII Activity",
      description: "Track Foreign Institutional and Domestic Institutional investor flows affecting broader market sentiment.",
      date: new Date().toISOString().split("T")[0],
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      isMajor: false,
    });

    microEvents.push({
      id: "us-fed",
      type: "MACRO",
      title: "US Federal Reserve Policy",
      description: "US Fed rate decisions and commentary impact global risk sentiment and FII flows into Indian markets.",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      isMajor: false,
    });

    res.json({
      symbol,
      majorEvents,
      microEvents,
    });
  } catch (err: any) {
    req.log.error({ err }, "Events error");
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
