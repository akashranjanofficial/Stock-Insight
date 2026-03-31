import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetStockQuote } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { Plus, X, TrendingUp, TrendingDown, Star, Search } from 'lucide-react';
import { useSearchStocks } from '@workspace/api-client-react';

// ─── STORAGE ─────────────────────────────────────────────────────────────────

interface WatchlistItem {
    symbol: string;
    exchange: string;
}

function getWatchlist(): WatchlistItem[] {
    try {
        const raw = localStorage.getItem('nifty_watchlist');
        return raw ? JSON.parse(raw) : defaultWatchlist;
    } catch {
        return defaultWatchlist;
    }
}

function saveWatchlist(items: WatchlistItem[]) {
    localStorage.setItem('nifty_watchlist', JSON.stringify(items));
}

const defaultWatchlist: WatchlistItem[] = [
    { symbol: '^NSEI', exchange: 'NSE' },
    { symbol: '^NSEBANK', exchange: 'NSE' },
    { symbol: '^BSESN', exchange: 'BSE' },
    { symbol: 'RELIANCE', exchange: 'NSE' },
    { symbol: 'HDFCBANK', exchange: 'NSE' },
    { symbol: 'INFY', exchange: 'NSE' },
    { symbol: 'TCS', exchange: 'NSE' },
];

// ─── WATCHLIST ROW ───────────────────────────────────────────────────────────

function WatchlistRow({ item, isActive, onRemove }: {
    item: WatchlistItem;
    isActive: boolean;
    onRemove: () => void;
}) {
    const [, setLocation] = useLocation();
    const { data: quote } = useGetStockQuote(item.symbol, { exchange: item.exchange as any }, {
        query: { refetchInterval: 30000 } as any,
    });

    const isUp = quote && quote.change >= 0;
    const displaySymbol = item.symbol.startsWith('^')
        ? item.symbol.replace('^NSEI', 'NIFTY 50').replace('^NSEBANK', 'BANK NIFTY').replace('^BSESN', 'SENSEX')
        : item.symbol;

    return (
        <div
            className={cn(
                "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-l-2",
                isActive
                    ? "bg-primary/5 border-primary"
                    : "border-transparent hover:bg-white/[0.03]"
            )}
            onClick={() => setLocation(`/stock/${encodeURIComponent(item.symbol)}?exchange=${item.exchange}`)}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    {isActive && <Star className="w-3 h-3 text-primary fill-primary shrink-0" />}
                    <span className={cn("text-xs font-bold truncate", isActive ? "text-primary" : "text-gray-200")}>
                        {displaySymbol}
                    </span>
                    {item.symbol.startsWith('^') && (
                        <span className="text-[9px] text-gray-500 bg-white/5 px-1 rounded">IDX</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-right">
                {quote ? (
                    <>
                        <span className="text-xs font-mono font-semibold text-gray-200 w-20 text-right">
                            {quote.price >= 10000 ? Math.round(quote.price).toLocaleString('en-IN') : quote.price.toFixed(2)}
                        </span>
                        <div className={cn("flex items-center gap-0.5 min-w-[70px] justify-end", isUp ? "text-green-400" : "text-red-400")}>
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span className="text-[10px] font-mono font-bold">
                                {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
                )}
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all"
                title="Remove"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

// ─── ADD SYMBOL SEARCH ───────────────────────────────────────────────────────

function AddSymbolSearch({ onAdd }: { onAdd: (item: WatchlistItem) => void }) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const { data: results } = useSearchStocks({ q: query }, {
        query: { enabled: query.length >= 1 } as any,
    });

    return (
        <div className="px-3 pb-3">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors border border-dashed border-white/10 hover:border-white/20"
                >
                    <Plus className="w-3 h-3" />
                    Add symbol
                </button>
            ) : (
                <div className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] rounded-lg border border-white/10">
                        <Search className="w-3 h-3 text-gray-500 shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search symbol..."
                            className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-500"
                            autoFocus
                        />
                        <button onClick={() => { setIsOpen(false); setQuery(''); }}>
                            <X className="w-3 h-3 text-gray-500 hover:text-white" />
                        </button>
                    </div>
                    {results && (results as any[]).length > 0 && (
                        <div className="bg-[#1a1a2e] border border-white/10 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                            {(results as any[]).slice(0, 6).map((s: any) => (
                                <button
                                    key={`${s.symbol}-${s.exchange}`}
                                    onClick={() => {
                                        onAdd({ symbol: s.symbol, exchange: s.exchange });
                                        setQuery('');
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-200">{s.symbol}</span>
                                        <span className="text-[10px] text-gray-500 bg-white/5 px-1 rounded">{s.exchange}</span>
                                    </div>
                                    <Plus className="w-3 h-3 text-gray-500" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function Watchlist({ currentSymbol }: { currentSymbol?: string }) {
    const [items, setItems] = useState<WatchlistItem[]>(() => getWatchlist());

    // Sync to localStorage
    useEffect(() => {
        saveWatchlist(items);
    }, [items]);

    const addItem = useCallback((item: WatchlistItem) => {
        setItems(prev => {
            if (prev.some(i => i.symbol === item.symbol && i.exchange === item.exchange)) return prev;
            return [...prev, item];
        });
    }, []);

    const removeItem = useCallback((symbol: string, exchange: string) => {
        setItems(prev => prev.filter(i => !(i.symbol === symbol && i.exchange === exchange)));
    }, []);

    // Split into indices and stocks
    const indices = items.filter(i => i.symbol.startsWith('^'));
    const stocks = items.filter(i => !i.symbol.startsWith('^'));

    return (
        <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-1 pb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Watchlist</span>
                    <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
            </div>

            {/* Table header */}
            <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/5">
                <span className="flex-1">Symbol</span>
                <span className="w-20 text-right">Last</span>
                <span className="w-[70px] text-right">Chg%</span>
                <span className="w-4" />
            </div>

            {/* Indices section */}
            {indices.length > 0 && (
                <div>
                    <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-600">
                        Indices
                    </div>
                    {indices.map(item => (
                        <WatchlistRow
                            key={`${item.symbol}-${item.exchange}`}
                            item={item}
                            isActive={currentSymbol === item.symbol}
                            onRemove={() => removeItem(item.symbol, item.exchange)}
                        />
                    ))}
                </div>
            )}

            {/* Stocks section */}
            {stocks.length > 0 && (
                <div>
                    <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-600">
                        Stocks
                    </div>
                    {stocks.map(item => (
                        <WatchlistRow
                            key={`${item.symbol}-${item.exchange}`}
                            item={item}
                            isActive={currentSymbol === item.symbol}
                            onRemove={() => removeItem(item.symbol, item.exchange)}
                        />
                    ))}
                </div>
            )}

            {/* Add symbol */}
            <AddSymbolSearch onAdd={addItem} />
        </div>
    );
}
