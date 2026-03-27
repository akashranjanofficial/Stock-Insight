import { useState } from "react";
import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { CandlestickChart } from "@/components/candlestick-chart";
import {
  useGetStockQuote,
  useGetStockChart,
  useGetStockAnalysis,
  useGetStockFundamentals,
  useGetStockEvents,
  GetStockChartInterval
} from "@workspace/api-client-react";
import { formatCurrency, formatLargeNumber, formatPercent, cn } from "@/lib/utils";
import {
  ArrowDownRight, ArrowUpRight, Clock, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, Minus, BarChart2, Activity,
  ChevronUp, ChevronDown, Minus as MinusIcon, Volume2, Zap, BookOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip as RechartTooltip, YAxis } from "recharts";

export default function StockDetail() {
  const [, params] = useRoute("/stock/:symbol");
  const symbol = decodeURIComponent(params?.symbol || "").toUpperCase();
  const searchParams = new URLSearchParams(window.location.search);
  const exchangeParam = searchParams.get("exchange") || "NSE";
  const isIndex = symbol.startsWith("^");
  const exchange = (isIndex ? "NSE" : exchangeParam) as "NSE" | "BSE";

  const [interval, setInterval] = useState<GetStockChartInterval>("1d");
  const [activeTab, setActiveTab] = useState<"technical" | "fundamental" | "bias" | "events">("bias");

  const { data: quote, isLoading: quoteLoading, refetch: refetchQuote, isFetching: isRefetching } = useGetStockQuote(symbol, { exchange }, {
    query: { refetchInterval: 30000 }
  });
  const { data: chartData, isLoading: chartLoading } = useGetStockChart(symbol, { interval, exchange }, {
    query: { refetchInterval: 60000 }
  });
  const { data: analysis, isLoading: analysisLoading } = useGetStockAnalysis(symbol, { exchange }, {
    query: { refetchInterval: 120000 }
  });
  const { data: fundamentals, isLoading: fundamentalsLoading } = useGetStockFundamentals(symbol, { exchange }, {
    query: { refetchInterval: 300000 }
  });
  const { data: events, isLoading: eventsLoading } = useGetStockEvents(symbol, { exchange }, {
    query: { refetchInterval: 300000 }
  });

  if (!symbol) return null;

  const isUp = quote && quote.change >= 0;
  const ColorIcon = isUp ? ArrowUpRight : ArrowDownRight;
  const colorClass = isUp ? "text-green-400" : "text-red-400";
  const bgClass = isUp ? "bg-green-500/10" : "bg-red-500/10";

  const intervals: GetStockChartInterval[] = ["5m", "15m", "30m", "1h", "1d", "1wk", "1mo"];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-5 space-y-5">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-mono">{symbol}</h1>
              <Badge variant="outline" className="font-mono text-xs">{isIndex ? "INDEX" : exchange}</Badge>
              {quote && (
                <span className="text-sm text-muted-foreground truncate max-w-xs">{quote.name}</span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              {quoteLoading ? (
                <div className="h-10 w-36 bg-muted animate-pulse rounded" />
              ) : quote ? (
                <>
                  <span className="text-4xl font-mono font-bold tracking-tighter">
                    {formatCurrency(quote.price)}
                  </span>
                  <div className={cn("flex items-center text-lg font-mono font-semibold px-2 py-0.5 rounded-md", colorClass, bgClass)}>
                    <ColorIcon className="w-5 h-5 mr-1" />
                    {quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)} ({formatPercent(quote.changePercent)})
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground flex-wrap">
            {quote && (
              <div className="flex gap-3">
                <span className="bg-card border border-border px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Vol: {formatLargeNumber(quote.volume)}
                </span>
                <span className="bg-card border border-border px-3 py-1.5 rounded-lg">H: {formatCurrency(quote.high)}</span>
                <span className="bg-card border border-border px-3 py-1.5 rounded-lg">L: {formatCurrency(quote.low)}</span>
              </div>
            )}
            <button
              onClick={() => refetchQuote()}
              disabled={isRefetching}
              className="p-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin text-primary")} />
            </button>
          </div>
        </div>

        {/* CHART */}
        <Card className="border-border">
          {/* Chart header — always two rows so timeframes get full width to scroll */}
          <div className="p-3 border-b border-border/50 space-y-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> Candlestick Chart
            </CardTitle>
            {/* Timeframe scroller — uses negative margin trick to bleed to card edges */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3">
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-max">
                {intervals.map((int) => (
                  <button
                    key={int}
                    onClick={() => setInterval(int)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0",
                      interval === int
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {int.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <CardContent className="p-0" style={{ height: 420 }}>
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-card/50">
                <div className="animate-pulse flex flex-col items-center gap-2">
                  <BarChart2 className="w-8 h-8 text-muted-foreground opacity-40" />
                  <span className="text-xs text-muted-foreground">Loading chart...</span>
                </div>
              </div>
            ) : chartData ? (
              <CandlestickChart data={chartData} height={420} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Failed to load chart
              </div>
            )}
          </CardContent>
        </Card>

        {/* TABS */}
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {[
            { id: "bias",        label: "Directional Bias",    icon: Activity },
            { id: "technical",   label: "Technical Analysis",  icon: BarChart2 },
            { id: "fundamental", label: "Fundamentals",        icon: BookOpen },
            { id: "events",      label: "Events & News",       icon: Zap },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors",
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="min-h-[400px]">
          {activeTab === "bias" && (
            <BiasTab analysis={analysis} isLoading={analysisLoading} />
          )}
          {activeTab === "technical" && (
            <TechnicalTab analysis={analysis} isLoading={analysisLoading} />
          )}
          {activeTab === "fundamental" && (
            <FundamentalTab fundamentals={fundamentals} isLoading={fundamentalsLoading} />
          )}
          {activeTab === "events" && (
            <EventsTab events={events} isLoading={eventsLoading} />
          )}
        </div>

      </div>
    </Layout>
  );
}

// ─── BIAS TAB ─────────────────────────────────────────────────────────────────

function SignalIcon({ signal }: { signal: string }) {
  if (signal === "BULLISH") return <ChevronUp className="w-4 h-4 text-green-400" />;
  if (signal === "BEARISH") return <ChevronDown className="w-4 h-4 text-red-400" />;
  return <MinusIcon className="w-4 h-4 text-muted-foreground" />;
}

function SignalBadge({ signal }: { signal: string }) {
  const cls =
    signal === "BULLISH" ? "bg-green-500/15 text-green-400 border-green-500/30" :
    signal === "BEARISH" ? "bg-red-500/15 text-red-400 border-red-500/30" :
    "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider", cls)}>
      {signal}
    </span>
  );
}

function SignalRow({ point }: { point: any }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/40 last:border-0">
      <SignalIcon signal={point.signal} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-foreground">{point.label}</span>
          <SignalBadge signal={point.signal} />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{point.detail}</p>
      </div>
    </div>
  );
}

function BiasCard({ title, data, icon: Icon }: { title: string; data: any; icon: any }) {
  if (!data) return null;
  const isUp = data.direction === "BULLISH";
  const isDown = data.direction === "BEARISH";
  const dirColor = isUp ? "text-green-400" : isDown ? "text-red-400" : "text-muted-foreground";
  const dirBg   = isUp ? "bg-green-500/10 border-green-500/30" : isDown ? "bg-red-500/10 border-red-500/30" : "bg-muted border-border";
  const DirIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  const techSignals: any[] = data.technicalSignals || [];
  const fundSignals: any[] = data.fundamentalSignals || [];

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" /> {title}
          </CardTitle>
        </div>
        <div className={cn("flex items-center gap-3 p-3 rounded-xl border mt-2", dirBg)}>
          <DirIcon className={cn("w-7 h-7 shrink-0", dirColor)} />
          <div>
            <div className={cn("font-bold text-base", dirColor)}>{data.direction}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{data.strength} SIGNAL</div>
          </div>
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed mt-2">{data.summary}</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 pt-0">
        {techSignals.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> Technical Signals
            </div>
            <div className="rounded-lg border border-border bg-card/50 px-3">
              {techSignals.slice(0, 6).map((s: any, i: number) => <SignalRow key={i} point={s} />)}
            </div>
          </div>
        )}
        {fundSignals.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Fundamental Signals
            </div>
            <div className="rounded-lg border border-border bg-card/50 px-3">
              {fundSignals.slice(0, 5).map((s: any, i: number) => <SignalRow key={i} point={s} />)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VolumeAnalysisCard({ vol }: { vol: any }) {
  if (!vol) return null;
  const isUp = vol.signal === "BULLISH";
  const isDown = vol.signal === "BEARISH";
  const sigColor = isUp ? "text-green-400" : isDown ? "text-red-400" : "text-muted-foreground";

  const maxVol = Math.max(...(vol.recentVolumes || [1]));
  const volData = (vol.recentVolumes || []).slice(-20).map((v: number, i: number) => ({ v, i }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" /> Volume Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Current Vol</div>
            <div className="font-mono font-bold text-sm">{(vol.currentVolume / 1e6).toFixed(2)}M</div>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">20D Avg Vol</div>
            <div className="font-mono font-bold text-sm">{vol.avgVolume20d ? (vol.avgVolume20d / 1e6).toFixed(2) + "M" : "—"}</div>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Vol Ratio</div>
            <div className={cn("font-mono font-bold text-sm", vol.volumeRatio > 2 ? "text-yellow-400" : vol.volumeRatio > 1.2 ? "text-green-400" : "text-foreground")}>
              {vol.volumeRatio ? vol.volumeRatio + "x" : "—"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Signal</div>
            <div className={cn("font-mono font-bold text-sm", sigColor)}>{vol.signal}</div>
          </div>
        </div>

        {vol.recentVolumes?.length > 0 && (
          <div>
            <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">20-Day Volume Profile</div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <YAxis hide domain={[0, maxVol * 1.1]} />
                  <RechartTooltip
                    formatter={(v: any) => [`${(v / 1e6).toFixed(2)}M`, "Volume"]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="v" maxBarSize={14} radius={[2, 2, 0, 0]}>
                    {volData.map(({ v }: any, i: number) => (
                      <Cell
                        key={i}
                        fill={v > (vol.avgVolume20d ?? 0) * 1.5 ? "#f59e0b" : v > (vol.avgVolume20d ?? 0) ? "#22c55e" : "#6b7280"}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block" />Climax (&gt;1.5x avg)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Above avg</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted-foreground inline-block" />Below avg</span>
            </div>
          </div>
        )}

        <div className={cn("p-3 rounded-xl border text-sm leading-relaxed",
          isUp ? "bg-green-500/5 border-green-500/20 text-green-300" :
          isDown ? "bg-red-500/5 border-red-500/20 text-red-300" :
          "bg-muted/30 border-border text-muted-foreground"
        )}>
          {vol.interpretation}
        </div>

        <div className="flex gap-2">
          {vol.climaxVolume && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">⚡ CLIMAX VOLUME</Badge>
          )}
          {vol.dryUpVolume && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">🌧 DRY UP VOLUME</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            Trend: {vol.trend}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function BiasTab({ analysis, isLoading }: { analysis: any; isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!analysis) return <EmptyState />;

  const isUp = analysis.overallBias.direction === "BULLISH";
  const isDown = analysis.overallBias.direction === "BEARISH";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Overall banner */}
      <div className={cn(
        "p-5 rounded-2xl border",
        isUp ? "bg-green-500/5 border-green-500/20" :
        isDown ? "bg-red-500/5 border-red-500/20" :
        "bg-muted border-border"
      )}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Overall Consensus</div>
            <div className={cn("text-2xl font-bold", isUp ? "text-green-400" : isDown ? "text-red-400" : "text-foreground")}>
              {analysis.overallBias.strength} {analysis.overallBias.direction}
            </div>
            <p className="text-sm text-foreground/80 mt-1">{analysis.overallBias.summary}</p>
          </div>
          <div className="flex flex-col gap-1 text-xs font-mono shrink-0">
            {analysis.overallBias.keyPoints?.map((pt: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-primary" />
                {pt}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Volume Analysis */}
      <VolumeAnalysisCard vol={analysis.volumeAnalysis} />

      {/* 3 timeframe bias cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <BiasCard title="Intraday (Today)" data={analysis.intraday} icon={Activity} />
        <BiasCard title="Short Term (1-4W)" data={analysis.shortTerm} icon={TrendingUp} />
        <BiasCard title="Long Term (3-12M)" data={analysis.longTerm} icon={BarChart2} />
      </div>
    </motion.div>
  );
}

// ─── TECHNICAL TAB ────────────────────────────────────────────────────────────

function TechnicalTab({ analysis, isLoading }: { analysis: any; isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!analysis?.technicalIndicators) return <EmptyState />;

  const tech = analysis.technicalIndicators;

  const MetricCard = ({ label, value, highlight }: { label: string; value: any; highlight?: "bull" | "bear" | null }) => {
    const cls = highlight === "bull" ? "border-green-500/30 bg-green-500/5 text-green-400" :
                highlight === "bear" ? "border-red-500/30 bg-red-500/5 text-red-400" : "";
    return (
      <div className={cn("p-4 rounded-xl bg-card border border-card-border hover:border-primary/40 transition-colors", cls)}>
        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
        <div className="font-mono font-semibold text-base">
          {value !== null && value !== undefined ? (typeof value === "number" ? value.toFixed(2) : value) : "—"}
        </div>
      </div>
    );
  };

  const rsiHL = tech.rsi ? (tech.rsi > 60 ? "bull" : tech.rsi < 40 ? "bear" : null) : null;
  const macdHL = tech.macd ? (tech.macd > 0 ? "bull" : "bear") : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="RSI (14)" value={tech.rsi} highlight={rsiHL} />
        <MetricCard label="MACD" value={tech.macd} highlight={macdHL} />
        <MetricCard label="MACD Signal" value={tech.macdSignal} />
        <MetricCard label="MACD Histogram" value={tech.macdHistogram} highlight={tech.macdHistogram > 0 ? "bull" : "bear"} />
        <MetricCard label="SMA (20)" value={tech.sma20} />
        <MetricCard label="SMA (50)" value={tech.sma50} />
        <MetricCard label="SMA (200)" value={tech.sma200} />
        <MetricCard label="EMA (9)" value={tech.ema9} />
        <MetricCard label="EMA (21)" value={tech.ema21} />
        <MetricCard label="Bollinger Upper" value={tech.bollingerUpper} />
        <MetricCard label="Bollinger Mid" value={tech.bollingerMiddle} />
        <MetricCard label="Bollinger Lower" value={tech.bollingerLower} />
        <MetricCard label="ATR (14)" value={tech.atr} />
        <MetricCard label="ADX" value={tech.adx} />
        <MetricCard label="Stoch %K" value={tech.stochK} highlight={tech.stochK > 80 ? "bear" : tech.stochK < 20 ? "bull" : null} />
        <MetricCard label="VWAP" value={tech.vwap} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Support & Resistance Levels (Pivot)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-stretch gap-2 font-mono text-sm max-w-2xl mx-auto">
            {[
              { label: "S2", val: tech.support2, cls: "bg-red-500/15 border-red-500/30 text-red-400" },
              { label: "S1", val: tech.support1, cls: "bg-red-500/8 border-red-500/20 text-red-400/80" },
              { label: "PP", val: tech.pivotPoint, cls: "bg-muted border-border text-foreground" },
              { label: "R1", val: tech.resistance1, cls: "bg-green-500/8 border-green-500/20 text-green-400/80" },
              { label: "R2", val: tech.resistance2, cls: "bg-green-500/15 border-green-500/30 text-green-400" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={cn("flex-1 text-center p-3 rounded-lg border", cls)}>
                <div className="text-[10px] opacity-70 mb-1">{label}</div>
                <div className="font-bold">{val?.toFixed(2) || "—"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── FUNDAMENTAL TAB ─────────────────────────────────────────────────────────

function FundamentalTab({ fundamentals, isLoading }: { fundamentals: any; isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!fundamentals) return <EmptyState />;

  const Metric = ({ label, value, isCurrency = false, isPercent = false, suffix = "" }: any) => {
    let formatted: string;
    if (value === null || value === undefined) formatted = "—";
    else if (isCurrency) formatted = formatCurrency(value);
    else if (isPercent) formatted = `${value?.toFixed(2)}%`;
    else if (typeof value === "number") formatted = value.toFixed(2) + suffix;
    else formatted = String(value);

    return (
      <div className="p-4 rounded-xl bg-card border border-card-border hover:bg-accent/40 transition-colors">
        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</div>
        <div className="font-mono font-semibold text-base text-foreground">{formatted}</div>
      </div>
    );
  };

  const Section = ({ title, children }: any) => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-7">
      {fundamentals.description && (
        <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl line-clamp-4">
          {fundamentals.description}
        </p>
      )}
      <Section title="Valuation">
        <Metric label="Market Cap (Cr)" value={fundamentals.marketCap ? fundamentals.marketCap / 10000000 : null} suffix=" Cr" />
        <Metric label="P/E Ratio" value={fundamentals.pe} suffix="x" />
        <Metric label="P/B Ratio" value={fundamentals.pb} suffix="x" />
        <Metric label="EV" value={fundamentals.enterpriseValue ? fundamentals.enterpriseValue / 10000000 : null} suffix=" Cr" />
      </Section>
      <Section title="Per Share Metrics">
        <Metric label="EPS" value={fundamentals.eps} isCurrency />
        <Metric label="Book Value" value={fundamentals.bookValue} isCurrency />
        <Metric label="Dividend Yield" value={fundamentals.dividendYield} isPercent />
      </Section>
      <Section title="Return Ratios">
        <Metric label="ROE" value={fundamentals.roe} isPercent />
        <Metric label="ROCE" value={fundamentals.roce} isPercent />
      </Section>
      <Section title="Financial Health">
        <Metric label="Debt / Equity" value={fundamentals.debtToEquity} suffix="x" />
        <Metric label="Current Ratio" value={fundamentals.currentRatio} suffix="x" />
        <Metric label="Revenue Growth" value={fundamentals.revenueGrowthYoy} isPercent />
        <Metric label="Profit Growth" value={fundamentals.profitGrowthYoy} isPercent />
      </Section>
    </motion.div>
  );
}

// ─── EVENTS TAB ───────────────────────────────────────────────────────────────

function EventsTab({ events, isLoading }: { events: any; isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!events || (!events.majorEvents.length && !events.microEvents.length)) return <EmptyState message="No events found" />;

  const EventItem = ({ event }: { event: any }) => {
    const impactCls = {
      HIGH: "bg-red-500/10 text-red-400 border-red-500/20",
      MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      LOW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    }[event.impact as string] || "bg-muted text-muted-foreground border-border";

    const sentimentCls = {
      POSITIVE: "text-green-400",
      NEGATIVE: "text-red-400",
      NEUTRAL: "text-muted-foreground",
    }[event.sentiment as string] || "text-foreground";

    return (
      <div className="flex gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors">
        <div className="shrink-0 pt-0.5">
          <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{event.date}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h4 className={cn("font-semibold text-sm leading-snug", sentimentCls)}>{event.title}</h4>
            <div className={cn("shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border", impactCls)}>
              {event.impact}
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
          <div className="mt-2">
            <Badge variant="outline" className="text-[10px] uppercase">{event.type.replace("_", " ")}</Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {events.majorEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Major Market Movers
          </h3>
          <div className="space-y-3">
            {events.majorEvents.map((e: any) => <EventItem key={e.id} event={e} />)}
          </div>
        </div>
      )}
      {events.microEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
            <Zap className="w-4 h-4 text-blue-400" /> Recent Updates & Micro Events
          </h3>
          <div className="space-y-3">
            {events.microEvents.map((e: any) => <EventItem key={e.id} event={e} />)}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 bg-card rounded-2xl border border-border" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-card rounded-xl border border-border" />)}
      </div>
    </div>
  );
}

function EmptyState({ message = "Data currently unavailable" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card/20">
      <AlertTriangle className="w-8 h-8 mb-4 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
