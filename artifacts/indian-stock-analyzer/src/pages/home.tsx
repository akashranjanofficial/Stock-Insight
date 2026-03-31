import { Layout } from "@/components/layout";
import { StockSearch } from "@/components/stock-search";
import { motion } from "framer-motion";
import { Activity, BarChart3, Globe, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { useGetStockQuote } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const INDICES = [
  { symbol: "^NSEI", name: "Nifty 50" },
  { symbol: "^NSEBANK", name: "Bank Nifty" },
  { symbol: "^BSESN", name: "Sensex" },
  { symbol: "^CNXIT", name: "Nifty IT" },
  { symbol: "^NSEMDCP50", name: "Nifty Midcap 50" },
];

function IndexCard({ symbol, name }: { symbol: string; name: string }) {
  const [, setLocation] = useLocation();
  const { data: quote, isLoading } = useGetStockQuote(
    symbol,
    { exchange: "NSE" },
    { query: { refetchInterval: 30000 } as any }
  );

  const isUp = quote ? quote.changePercent >= 0 : null;

  return (
    <button
      onClick={() => setLocation(`/stock/${encodeURIComponent(symbol)}?exchange=INDEX`)}
      style={{ minWidth: 160 }}
      className={cn(
        "flex flex-col items-start p-3.5 rounded-2xl border bg-card/60 hover:bg-card transition-all duration-200 cursor-pointer text-left shrink-0",
        isUp === true && "border-green-500/30 hover:border-green-500/50",
        isUp === false && "border-red-500/30 hover:border-red-500/50",
        isUp === null && "border-border"
      )}
    >
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 whitespace-nowrap">
        {name}
      </div>
      {isLoading ? (
        <div className="space-y-1.5 w-full">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          <div className="h-3.5 w-16 bg-muted animate-pulse rounded" />
        </div>
      ) : quote ? (
        <>
          <div className="text-lg font-bold font-mono tracking-tight whitespace-nowrap">
            {quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs font-mono font-semibold mt-1 whitespace-nowrap",
            isUp ? "text-green-400" : "text-red-400"
          )}>
            {isUp ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
            <span>{quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)}</span>
            <span className="opacity-80">({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)</span>
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">Unavailable</div>
      )}
    </button>
  );
}

export default function Home() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl flex flex-col items-center text-center z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 text-xs font-mono text-muted-foreground mb-8">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            REAL-TIME NSE/BSE DATA FEED ACTIVE
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground">
            Institutional Grade <br />
            <span className="text-gradient">Stock Intelligence</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-2xl">
            Advanced technical indicators, fundamental deep-dives, and AI-driven bias analysis for Indian equities. Search any stock to begin.
          </p>

          {/* Scrollable Market Indices Strip */}
          <div className="w-full mb-10 -mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
              {INDICES.map((idx) => (
                <div key={idx.symbol} className="snap-start">
                  <IndexCard symbol={idx.symbol} name={idx.name} />
                </div>
              ))}
            </div>
          </div>

          <StockSearch size="large" className="shadow-2xl shadow-primary/5" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-4xl">
            {[
              { icon: Activity, title: "Live Quotes", desc: "Real-time market data" },
              { icon: BarChart3, title: "Technicals", desc: "15+ Indicators & VWAP" },
              { icon: Globe, title: "Fundamentals", desc: "Deep financial metrics" },
              { icon: Zap, title: "Events", desc: "Earnings & Macro impacts" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
                className="flex flex-col items-center text-center p-4 rounded-2xl bg-card/50 border border-border/50 hover:bg-card/80 transition-colors"
              >
                <feature.icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold text-sm text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
