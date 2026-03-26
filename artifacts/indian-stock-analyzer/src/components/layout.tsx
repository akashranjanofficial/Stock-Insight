import { Link } from "wouter";
import { Activity, ShieldCheck, TrendingUp } from "lucide-react";
import { StockSearch } from "./stock-search";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:bg-primary/30 transition-colors">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">
              Nifty<span className="text-primary">Terminal</span>
            </span>
          </Link>
          
          <div className="flex-1 max-w-xl">
            <StockSearch size="default" />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-success">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                MARKET OPEN
              </div>
              <span className="text-muted-foreground border-l border-border pl-2 ml-2">
                NSE/BSE
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/50 bg-card/30 py-6 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Data provided for educational purposes. Not financial advice.</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>v1.0.0</span>
            <span>SYSTEM_READY</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
