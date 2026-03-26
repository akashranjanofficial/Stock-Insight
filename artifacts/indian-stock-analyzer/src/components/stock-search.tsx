import { useState, useRef, useEffect } from "react";
import { Search, Command, ArrowRight, Loader2 } from "lucide-react";
import { useSearchStocks } from "@workspace/api-client-react";
import { useDebounceValue } from "usehooks-ts";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function StockSearch({ className, size = "default" }: { className?: string, size?: "default" | "large" }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounceValue(query, 300);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: results, isLoading } = useSearchStocks(
    { q: debouncedQuery[0] },
    { query: { enabled: debouncedQuery[0].length > 1 } }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-2xl mx-auto z-50", className)}>
      <div className={cn(
        "relative flex items-center w-full rounded-xl border border-card-border bg-card/80 backdrop-blur-sm shadow-lg transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10",
        size === "large" ? "h-16 px-6" : "h-12 px-4"
      )}>
        <Search className={cn("text-muted-foreground mr-3", size === "large" ? "h-6 w-6" : "h-5 w-5")} />
        <input
          type="text"
          className={cn(
            "w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/70 font-medium",
            size === "large" ? "text-xl" : "text-base"
          )}
          placeholder="Search NSE/BSE stocks by name or symbol..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {isLoading && <Loader2 className="h-5 w-5 text-muted-foreground animate-spin ml-3" />}
        <kbd className="ml-3 hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {isOpen && debouncedQuery[0].length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-card-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {results && results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Stocks
              </div>
              {results.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                    setLocation(`/stock/${stock.symbol}?exchange=${stock.exchange}`);
                  }}
                  className="px-4 py-3 flex items-center justify-between hover:bg-accent cursor-pointer transition-colors group"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{stock.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                        {stock.exchange}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                      {stock.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{stock.sector}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-primary group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No stocks found matching "{debouncedQuery[0]}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
