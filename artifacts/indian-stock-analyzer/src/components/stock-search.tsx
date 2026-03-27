import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ArrowRight, Loader2 } from "lucide-react";
import { useSearchStocks } from "@workspace/api-client-react";
import { useDebounceValue } from "usehooks-ts";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface DropdownPos { top: number; left: number; width: number }

export function StockSearch({ className, size = "default" }: { className?: string; size?: "default" | "large" }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounceValue(query, 300);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 });
  const [, setLocation] = useLocation();

  const { data: results, isLoading } = useSearchStocks(
    { q: debouncedQuery[0] },
    { query: { enabled: debouncedQuery[0].length > 1 } }
  );

  // Recalculate dropdown position from the input box (viewport-relative for position:fixed)
  const updatePos = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (isOpen) updatePos();
  }, [isOpen, updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => updatePos();
    const handleResize = () => updatePos();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, updatePos]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check the portal dropdown
        const portal = document.getElementById("stock-search-portal");
        if (portal && portal.contains(target)) return;
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleSelect = (symbol: string, exchange: string) => {
    setIsOpen(false);
    setQuery("");
    setLocation(`/stock/${symbol}?exchange=${exchange}`);
  };

  const showDropdown = isOpen && debouncedQuery[0].length > 1;

  return (
    <>
      <div ref={containerRef} className={cn("relative w-full max-w-2xl mx-auto", className)}>
        <div className={cn(
          "relative flex items-center w-full rounded-xl border border-card-border bg-card shadow-lg transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10",
          size === "large" ? "h-16 px-6" : "h-12 px-4"
        )}>
          <Search className={cn("text-muted-foreground mr-3 shrink-0", size === "large" ? "h-6 w-6" : "h-5 w-5")} />
          <input
            type="text"
            className={cn(
              "w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/70 font-medium",
              size === "large" ? "text-xl" : "text-base"
            )}
            placeholder="Search NSE/BSE stocks by name or symbol..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => { setIsOpen(true); updatePos(); }}
          />
          {isLoading
            ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin ml-3 shrink-0" />
            : <kbd className="ml-3 hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
                <span className="text-xs">⌘</span>K
              </kbd>
          }
        </div>
      </div>

      {/* Portal dropdown — renders outside any stacking context */}
      {showDropdown && createPortal(
        <div
          id="stock-search-portal"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 99999,
          }}
          className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden max-h-[min(400px,50vh)] overflow-y-auto"
        >
          {results && results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                Stocks
              </div>
              {results.map((stock) => (
                <div
                  key={stock.symbol + stock.exchange}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(stock.symbol, stock.exchange)}
                  className="px-4 py-3 flex items-center justify-between hover:bg-accent cursor-pointer transition-colors group"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{stock.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono shrink-0">
                        {stock.exchange}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">{stock.sector}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No stocks found for &ldquo;{debouncedQuery[0]}&rdquo;
            </div>
          ) : (
            <div className="px-4 py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
