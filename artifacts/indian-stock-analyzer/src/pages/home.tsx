import { Layout } from "@/components/layout";
import { StockSearch } from "@/components/stock-search";
import { motion } from "framer-motion";
import { Activity, BarChart3, Globe, LineChart, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { useGetStockQuote } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const INDICES = [
  { symbol: "^NSEI",    name: "Nifty 50",   exchange: "NSE" },
  { symbol: "^NSEBANK", name: "Bank Nifty",  exchange: "NSE" },
  { symbol: "^BSESN",   name: "Sensex",      exchange: "BSE" },
];

function IndexCard({ symbol, name }: { symbol: string; name: string }) {
  const [, setLocation] = useLocation();
  const { data: quote, isLoading } = useGetStockQuote(
    symbol,
    { exchange: "NSE" },
    { query: { refetchInterval: 30000 } }
  );

  const isUp = quote ? quote.changePercent >= 0 : null;

  return (
    <button
      onClick={() => setLocation(`/stock/${encodeURIComponent(symbol)}?exchange=INDEX`)}
      className={cn(
        "flex flex-col items-start p-4 rounded-2xl border bg-card/60 hover:bg-card transition-all duration-200 cursor-pointer text-left w-full",
        isUp === true  && "border-green-500/30 hover:border-green-500/50",
        isUp === false && "border-red-500/30 hover:border-red-500/50",
        isUp === null  && "border-border"
      )}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{name}</div>
      {isLoading ? (
        <div className="space-y-1 w-full">
          <div className="h-6 w-28 bg-muted animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>
      ) : quote ? (
        <>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-mono font-semibold mt-1",
            isUp ? "text-green-400" : "text-red-400"
          )}>
            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)}{" "}
            ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">Unavailable</div>
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
            Institutional Grade <br/>
            <span className="text-gradient">Stock Intelligence</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-2xl">
            Advanced technical indicators, fundamental deep-dives, and AI-driven bias analysis for Indian equities. Search any stock to begin.
          </p>

          {/* Market Indices Strip */}
          <div className="w-full grid grid-cols-3 gap-3 mb-10">
            {INDICES.map((idx) => (
              <IndexCard key={idx.symbol} symbol={idx.symbol} name={idx.name} />
            ))}
          </div>

          <StockSearch size="large" className="shadow-2xl shadow-primary/5" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-4xl">
            {[
              { icon: Activity,  title: "Live Quotes",  desc: "Real-time market data" },
              { icon: BarChart3, title: "Technicals",   desc: "15+ Indicators & VWAP" },
              { icon: Globe,     title: "Fundamentals", desc: "Deep financial metrics" },
              { icon: Zap,       title: "Events",       desc: "Earnings & Macro impacts" },
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
