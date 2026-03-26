import { useState } from "react";
import { useRoute, useLocation } from "wouter";
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
import { ArrowDownRight, ArrowUpRight, Clock, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart2, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function StockDetail() {
  const [, params] = useRoute("/stock/:symbol");
  const symbol = params?.symbol?.toUpperCase() || "";
  
  // Extract exchange from query params if exists, default to NSE
  const searchParams = new URLSearchParams(window.location.search);
  const exchange = (searchParams.get("exchange") || "NSE") as "NSE" | "BSE";

  const [interval, setInterval] = useState<GetStockChartInterval>("1d");
  const [activeTab, setActiveTab] = useState<"technical" | "fundamental" | "bias" | "events">("technical");

  // Fetch all data
  const { data: quote, isLoading: quoteLoading, refetch: refetchQuote, isFetching: isRefetching } = useGetStockQuote(symbol, { exchange }, {
    query: { refetchInterval: 30000 } // Auto-refresh every 30s
  });
  
  const { data: chartData, isLoading: chartLoading } = useGetStockChart(symbol, { interval, exchange });
  const { data: analysis, isLoading: analysisLoading } = useGetStockAnalysis(symbol, { exchange });
  const { data: fundamentals, isLoading: fundamentalsLoading } = useGetStockFundamentals(symbol, { exchange });
  const { data: events, isLoading: eventsLoading } = useGetStockEvents(symbol, { exchange });

  if (!symbol) return null;

  const isUp = quote && quote.change >= 0;
  const ColorIcon = isUp ? ArrowUpRight : ArrowDownRight;
  const colorClass = isUp ? "text-success" : "text-destructive";
  const bgClass = isUp ? "bg-success/10" : "bg-destructive/10";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{symbol}</h1>
              <Badge variant="outline" className="font-mono">{exchange}</Badge>
              {quoteLoading && <div className="h-6 w-24 bg-muted animate-pulse rounded" />}
              {quote && (
                <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px] md:max-w-md">
                  {quote.name}
                </span>
              )}
            </div>
            
            <div className="flex items-baseline gap-3">
              {quoteLoading ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded mt-2" />
              ) : quote ? (
                <>
                  <span className="text-4xl font-mono font-bold tracking-tighter">
                    {formatCurrency(quote.price)}
                  </span>
                  <div className={cn("flex items-center text-lg font-mono font-medium", colorClass, bgClass, "px-2 py-0.5 rounded-md")}>
                    <ColorIcon className="w-5 h-5 mr-1" />
                    {quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)} ({formatPercent(quote.changePercent)})
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4" />
              Vol: {quote ? formatLargeNumber(quote.volume) : "—"}
            </div>
            <button 
              onClick={() => refetchQuote()} 
              disabled={isRefetching}
              className="p-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
              title="Refresh Quote"
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin text-primary")} />
            </button>
          </div>
        </div>

        {/* CHART SECTION */}
        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Price Action
            </CardTitle>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {["5m", "15m", "1h", "1d", "1wk"].map((int) => (
                <button
                  key={int}
                  onClick={() => setInterval(int as GetStockChartInterval)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    interval === int 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  {int.toUpperCase()}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[400px]">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-card/50">
                <div className="animate-pulse flex flex-col items-center gap-2">
                  <BarChart2 className="w-8 h-8 text-muted-foreground opacity-50" />
                  <span className="text-xs text-muted-foreground">Loading chart data...</span>
                </div>
              </div>
            ) : chartData ? (
              <CandlestickChart data={chartData} height={400} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Failed to load chart
              </div>
            )}
          </CardContent>
        </Card>

        {/* TABS */}
        <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-[1px] scrollbar-hide">
          {[
            { id: "technical", label: "Technical Analysis" },
            { id: "bias", label: "Directional Bias" },
            { id: "fundamental", label: "Fundamentals" },
            { id: "events", label: "Events & News" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.id 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="min-h-[400px]">
          {activeTab === "technical" && (
            <TechnicalTab analysis={analysis} isLoading={analysisLoading} />
          )}
          {activeTab === "bias" && (
            <BiasTab analysis={analysis} isLoading={analysisLoading} />
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

// --- TAB COMPONENTS ---

function TechnicalTab({ analysis, isLoading }: { analysis: any, isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!analysis?.technicalIndicators) return <EmptyState />;

  const tech = analysis.technicalIndicators;

  const MetricCard = ({ label, value, isMonospace = true }: { label: string, value: any, isMonospace?: boolean }) => (
    <div className="p-4 rounded-xl bg-card border border-card-border flex justify-between items-center group hover:border-primary/50 transition-colors">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", isMonospace && "font-mono")}>
        {value !== null && value !== undefined ? (typeof value === 'number' ? value.toFixed(2) : value) : "—"}
      </span>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="RSI (14)" value={tech.rsi} />
        <MetricCard label="MACD" value={tech.macd} />
        <MetricCard label="ATR" value={tech.atr} />
        <MetricCard label="VWAP" value={tech.vwap} />
        <MetricCard label="SMA (20)" value={tech.sma20} />
        <MetricCard label="SMA (50)" value={tech.sma50} />
        <MetricCard label="SMA (200)" value={tech.sma200} />
        <MetricCard label="ADX" value={tech.adx} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support & Resistance Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-sm w-full max-w-3xl mx-auto">
            <div className="text-center w-full p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              <div className="text-xs opacity-70 mb-1">S2</div>
              <div className="font-bold">{tech.support2?.toFixed(2) || "—"}</div>
            </div>
            <div className="text-center w-full p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-destructive">
              <div className="text-xs opacity-70 mb-1">S1</div>
              <div className="font-bold">{tech.support1?.toFixed(2) || "—"}</div>
            </div>
            <div className="text-center w-full p-3 rounded-lg bg-muted border border-border text-foreground">
              <div className="text-xs text-muted-foreground mb-1">PIVOT</div>
              <div className="font-bold">{tech.pivotPoint?.toFixed(2) || "—"}</div>
            </div>
            <div className="text-center w-full p-3 rounded-lg bg-success/5 border border-success/10 text-success">
              <div className="text-xs opacity-70 mb-1">R1</div>
              <div className="font-bold">{tech.resistance1?.toFixed(2) || "—"}</div>
            </div>
            <div className="text-center w-full p-3 rounded-lg bg-success/10 border border-success/20 text-success">
              <div className="text-xs opacity-70 mb-1">R2</div>
              <div className="font-bold">{tech.resistance2?.toFixed(2) || "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function BiasTab({ analysis, isLoading }: { analysis: any, isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!analysis) return <EmptyState />;

  const getBiasConfig = (direction: string, strength: string) => {
    let icon = Minus;
    let colorClass = "text-muted-foreground border-border bg-muted/50";
    
    if (direction === "BULLISH") {
      icon = TrendingUp;
      colorClass = strength === "STRONG" 
        ? "text-success border-success/50 bg-success/10" 
        : "text-success/80 border-success/30 bg-success/5";
    } else if (direction === "BEARISH") {
      icon = TrendingDown;
      colorClass = strength === "STRONG" 
        ? "text-destructive border-destructive/50 bg-destructive/10" 
        : "text-destructive/80 border-destructive/30 bg-destructive/5";
    }

    return { Icon: icon, colorClass };
  };

  const BiasCard = ({ title, data }: { title: string, data: any }) => {
    if (!data) return null;
    const { Icon, colorClass } = getBiasConfig(data.direction, data.strength);
    
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className={cn("flex items-center gap-3 p-4 rounded-xl border mb-4", colorClass)}>
            <Icon className="w-8 h-8" />
            <div>
              <div className="font-bold text-lg">{data.direction}</div>
              <div className="text-xs opacity-80 font-mono">{data.strength} SIGNAL</div>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-4">
            {data.summary}
          </p>
          <ul className="space-y-2 mt-auto">
            {data.keyPoints?.map((point: string, i: number) => (
              <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* Overall Summary Banner */}
      <div className={cn(
        "p-6 rounded-2xl border", 
        analysis.overallBias.direction === "BULLISH" ? "bg-success/5 border-success/20" : 
        analysis.overallBias.direction === "BEARISH" ? "bg-destructive/5 border-destructive/20" : 
        "bg-muted border-border"
      )}>
        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Overall Consensus
        </h3>
        <p className="text-foreground/90">{analysis.overallBias.summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BiasCard title="Intraday (1D)" data={analysis.intraday} />
        <BiasCard title="Short Term (1-4W)" data={analysis.shortTerm} />
        <BiasCard title="Long Term (3-12M)" data={analysis.longTerm} />
      </div>
    </motion.div>
  );
}

function FundamentalTab({ fundamentals, isLoading }: { fundamentals: any, isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!fundamentals) return <EmptyState />;

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );

  const Metric = ({ label, value, isCurrency = false, isPercent = false }: { label: string, value: any, isCurrency?: boolean, isPercent?: boolean }) => {
    let formatted = value;
    if (value === null || value === undefined) formatted = "—";
    else if (isCurrency) formatted = formatCurrency(value);
    else if (isPercent) formatted = formatPercent(value);
    else if (typeof value === 'number') formatted = value.toFixed(2);

    return (
      <div className="p-4 rounded-xl bg-card border border-card-border hover:bg-accent/50 transition-colors">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="font-mono text-base font-semibold text-foreground">{formatted}</div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {fundamentals.description && (
        <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
          {fundamentals.description}
        </p>
      )}

      <Section title="Valuation">
        <Metric label="Market Cap" value={fundamentals.marketCap ? fundamentals.marketCap / 10000000 : null} isCurrency={true} />
        <Metric label="P/E Ratio" value={fundamentals.pe} />
        <Metric label="P/B Ratio" value={fundamentals.pb} />
        <Metric label="Dividend Yield" value={fundamentals.dividendYield} isPercent />
      </Section>

      <Section title="Return Ratios">
        <Metric label="ROE" value={fundamentals.roe} isPercent />
        <Metric label="ROCE" value={fundamentals.roce} isPercent />
        <Metric label="EPS" value={fundamentals.eps} isCurrency />
      </Section>

      <Section title="Financial Health">
        <Metric label="Debt to Equity" value={fundamentals.debtToEquity} />
        <Metric label="Current Ratio" value={fundamentals.currentRatio} />
        <Metric label="Book Value" value={fundamentals.bookValue} isCurrency />
        <Metric label="Face Value" value={fundamentals.faceValue} isCurrency />
      </Section>
    </motion.div>
  );
}

function EventsTab({ events, isLoading }: { events: any, isLoading: boolean }) {
  if (isLoading) return <TabSkeleton />;
  if (!events || (!events.majorEvents.length && !events.microEvents.length)) return <EmptyState message="No recent events found" />;

  const EventItem = ({ event }: { event: any }) => {
    const impactColor = {
      HIGH: "bg-destructive/10 text-destructive border-destructive/20",
      MEDIUM: "bg-warning/10 text-warning border-warning/20",
      LOW: "bg-primary/10 text-primary border-primary/20"
    }[event.impact as string] || "bg-muted text-muted-foreground border-border";

    const sentimentColor = {
      POSITIVE: "text-success",
      NEGATIVE: "text-destructive",
      NEUTRAL: "text-muted-foreground"
    }[event.sentiment as string] || "text-foreground";

    return (
      <div className="flex gap-4 p-4 rounded-xl border border-card-border bg-card/50 hover:bg-card transition-colors">
        <div className="flex flex-col items-center justify-start shrink-0 pt-1">
          <div className="text-xs font-mono text-muted-foreground">{event.date}</div>
          <div className="w-[1px] h-full bg-border mt-2" />
        </div>
        <div className="flex-1 pb-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h4 className={cn("font-semibold text-base", sentimentColor)}>{event.title}</h4>
            <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border", impactColor)}>
              {event.impact} IMPACT
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{event.description}</p>
          <div className="mt-3 flex gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">{event.type.replace('_', ' ')}</Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {events.majorEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> 
            Major Market Movers
          </h3>
          <div className="space-y-3">
            {events.majorEvents.map((e: any) => <EventItem key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {events.microEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-foreground mt-8">Recent News & Updates</h3>
          <div className="space-y-3">
            {events.microEvents.map((e: any) => <EventItem key={e.id} event={e} />)}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// --- UTILS ---

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-card rounded-xl border border-card-border" />
        ))}
      </div>
      <div className="h-64 bg-card rounded-xl border border-card-border" />
    </div>
  );
}

function EmptyState({ message = "Data currently unavailable" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card/20">
      <AlertTriangle className="w-8 h-8 mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );
}
