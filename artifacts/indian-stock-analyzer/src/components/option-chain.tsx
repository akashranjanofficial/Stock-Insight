import { useState, useMemo } from 'react';
import { useGetStockOptions, useGetStockFutures } from '@workspace/api-client-react';
import type { OptionContract, FuturesContract } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpDown } from 'lucide-react';

// ─── SHARED FORMATTERS ──────────────────────────────────────────────────────

const fmtPrice = (v: number) =>
    v >= 1000 ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toFixed(2);

const fmtOI = (v: number) =>
    v >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' :
        v >= 1e5 ? (v / 1e5).toFixed(1) + ' L' :
            v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' :
                v.toString();

const fmtVol = fmtOI;

// ─── OPTION CHAIN TABLE ─────────────────────────────────────────────────────

function OptionChainTable({
    calls,
    puts,
    strikes,
    spotPrice,
}: {
    calls: OptionContract[];
    puts: OptionContract[];
    strikes: number[];
    spotPrice: number;
}) {
    const callMap = useMemo(() => new Map(calls.map(c => [c.strike, c])), [calls]);
    const putMap = useMemo(() => new Map(puts.map(p => [p.strike, p])), [puts]);
    const atmStrike = useMemo(() => {
        let closest = strikes[0];
        let minDiff = Infinity;
        for (const s of strikes) {
            const diff = Math.abs(s - spotPrice);
            if (diff < minDiff) { minDiff = diff; closest = s; }
        }
        return closest;
    }, [strikes, spotPrice]);

    const maxOI = useMemo(() => {
        let max = 0;
        for (const c of calls) max = Math.max(max, c.oi);
        for (const p of puts) max = Math.max(max, p.oi);
        return max || 1;
    }, [calls, puts]);

    return (
        <div className="overflow-auto max-h-[calc(100vh-14rem)]">
            <table className="w-full text-[11px] font-mono border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-[#12121a]">
                        {/* Call headers */}
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">OI</th>
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">Chg OI</th>
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">Vol</th>
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">IV</th>
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">LTP</th>
                        <th className="px-2 py-2 text-right text-green-500/70 font-bold">Chg</th>
                        {/* Strike */}
                        <th className="px-3 py-2 text-center font-bold text-gray-300 bg-white/[0.03] border-x border-white/5">Strike</th>
                        {/* Put headers */}
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">Chg</th>
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">LTP</th>
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">IV</th>
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">Vol</th>
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">Chg OI</th>
                        <th className="px-2 py-2 text-left text-red-500/70 font-bold">OI</th>
                    </tr>
                </thead>
                <tbody>
                    {strikes.map((strike) => {
                        const call = callMap.get(strike);
                        const put = putMap.get(strike);
                        const isATM = strike === atmStrike;
                        const callITM = strike < spotPrice;
                        const putITM = strike > spotPrice;

                        return (
                            <tr
                                key={strike}
                                className={cn(
                                    "border-b border-white/[0.02] transition-colors hover:bg-white/[0.03]",
                                    isATM && "bg-yellow-500/[0.06] border-y border-yellow-500/20"
                                )}
                            >
                                {/* Call side */}
                                <td className={cn("px-2 py-1.5 text-right relative", callITM && "bg-green-500/[0.04]")}>
                                    <div className="absolute inset-0 right-0" style={{ width: `${(call?.oi || 0) / maxOI * 100}%` }}>
                                        <div className="h-full bg-green-500/[0.08] rounded-r-sm" />
                                    </div>
                                    <span className="relative text-gray-400">{call ? fmtOI(call.oi) : '—'}</span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-right", callITM && "bg-green-500/[0.04]")}>
                                    <span className={call?.oiChange && call.oiChange > 0 ? 'text-green-400' : call?.oiChange && call.oiChange < 0 ? 'text-red-400' : 'text-gray-500'}>
                                        {call?.oiChange ? (call.oiChange > 0 ? '+' : '') + fmtOI(call.oiChange) : '—'}
                                    </span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-right text-gray-500", callITM && "bg-green-500/[0.04]")}>
                                    {call ? fmtVol(call.volume) : '—'}
                                </td>
                                <td className={cn("px-2 py-1.5 text-right text-gray-500", callITM && "bg-green-500/[0.04]")}>
                                    {call ? call.iv.toFixed(1) : '—'}
                                </td>
                                <td className={cn("px-2 py-1.5 text-right font-semibold", callITM && "bg-green-500/[0.04]")}>
                                    <span className={call?.change && call.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {call ? fmtPrice(call.ltp) : '—'}
                                    </span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-right", callITM && "bg-green-500/[0.04]")}>
                                    <span className={call?.change && call.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {call?.change ? (call.change >= 0 ? '+' : '') + call.change.toFixed(2) : '—'}
                                    </span>
                                </td>

                                {/* Strike */}
                                <td className={cn(
                                    "px-3 py-1.5 text-center font-bold border-x border-white/5",
                                    isATM ? "text-yellow-400 bg-yellow-500/[0.08]" : "text-gray-300 bg-white/[0.02]"
                                )}>
                                    {strike}
                                    {isATM && <span className="ml-1 text-[9px] text-yellow-500/60 font-normal">ATM</span>}
                                </td>

                                {/* Put side */}
                                <td className={cn("px-2 py-1.5 text-left", putITM && "bg-red-500/[0.04]")}>
                                    <span className={put?.change && put.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {put?.change ? (put.change >= 0 ? '+' : '') + put.change.toFixed(2) : '—'}
                                    </span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-left font-semibold", putITM && "bg-red-500/[0.04]")}>
                                    <span className={put?.change && put.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {put ? fmtPrice(put.ltp) : '—'}
                                    </span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-left text-gray-500", putITM && "bg-red-500/[0.04]")}>
                                    {put ? put.iv.toFixed(1) : '—'}
                                </td>
                                <td className={cn("px-2 py-1.5 text-left text-gray-500", putITM && "bg-red-500/[0.04]")}>
                                    {put ? fmtVol(put.volume) : '—'}
                                </td>
                                <td className={cn("px-2 py-1.5 text-left", putITM && "bg-red-500/[0.04]")}>
                                    <span className={put?.oiChange && put.oiChange > 0 ? 'text-green-400' : put?.oiChange && put.oiChange < 0 ? 'text-red-400' : 'text-gray-500'}>
                                        {put?.oiChange ? (put.oiChange > 0 ? '+' : '') + fmtOI(put.oiChange) : '—'}
                                    </span>
                                </td>
                                <td className={cn("px-2 py-1.5 text-left relative", putITM && "bg-red-500/[0.04]")}>
                                    <div className="absolute inset-0 left-0" style={{ width: `${(put?.oi || 0) / maxOI * 100}%` }}>
                                        <div className="h-full bg-red-500/[0.08] rounded-l-sm" />
                                    </div>
                                    <span className="relative text-gray-400">{put ? fmtOI(put.oi) : '—'}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── FUTURES TABLE ───────────────────────────────────────────────────────────

function FuturesTable({ contracts, spotPrice }: { contracts: FuturesContract[]; spotPrice: number }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[11px] font-mono border-collapse">
                <thead>
                    <tr className="bg-[#12121a]">
                        <th className="px-3 py-2 text-left font-bold text-gray-400">Contract</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">LTP</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Chg</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Chg%</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Basis</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">OI</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Chg OI</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Volume</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-400">Lot Size</th>
                    </tr>
                </thead>
                <tbody>
                    {contracts.map((c, i) => {
                        const isUp = c.change >= 0;
                        const labels = ['Current', 'Next', 'Far'];
                        return (
                            <tr key={c.expiry} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                                <td className="px-3 py-3 text-left">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-200">{labels[i] || c.expiry}</span>
                                        <span className="text-[10px] text-gray-500">{c.expiry}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-gray-200">{fmtPrice(c.ltp)}</td>
                                <td className={cn("px-3 py-3 text-right font-semibold", isUp ? 'text-green-400' : 'text-red-400')}>
                                    {isUp ? '+' : ''}{c.change.toFixed(2)}
                                </td>
                                <td className={cn("px-3 py-3 text-right font-semibold", isUp ? 'text-green-400' : 'text-red-400')}>
                                    {isUp ? '+' : ''}{c.changePercent.toFixed(2)}%
                                </td>
                                <td className={cn("px-3 py-3 text-right", c.basis >= 0 ? 'text-blue-400' : 'text-orange-400')}>
                                    {c.basis >= 0 ? '+' : ''}{c.basis.toFixed(2)}
                                </td>
                                <td className="px-3 py-3 text-right text-gray-400">{fmtOI(c.oi)}</td>
                                <td className={cn("px-3 py-3 text-right", c.oiChange >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {c.oiChange >= 0 ? '+' : ''}{fmtOI(c.oiChange)}
                                </td>
                                <td className="px-3 py-3 text-right text-gray-400">{fmtVol(c.volume)}</td>
                                <td className="px-3 py-3 text-right text-gray-500">{c.lotSize}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Spot reference */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 text-[10px] text-gray-500">
                <span>Spot Price:</span>
                <span className="font-bold text-gray-300">{fmtPrice(spotPrice)}</span>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function OptionChain({ symbol }: { symbol: string }) {
    const [activeTab, setActiveTab] = useState<'options' | 'futures'>('options');
    const [selectedExpiry, setSelectedExpiry] = useState<string | undefined>(undefined);

    const { data: optionData, isLoading: optionsLoading } = useGetStockOptions(symbol, {
        expiry: selectedExpiry,
    });

    const { data: futuresData, isLoading: futuresLoading } = useGetStockFutures(symbol);

    const isLoading = activeTab === 'options' ? optionsLoading : futuresLoading;

    // PCR calculation
    const pcr = useMemo(() => {
        if (!optionData) return null;
        const totalPutOI = optionData.puts.reduce((sum: number, p: OptionContract) => sum + p.oi, 0);
        const totalCallOI = optionData.calls.reduce((sum: number, c: OptionContract) => sum + c.oi, 0);
        return totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : null;
    }, [optionData]);

    // Max Pain calculation
    const maxPain = useMemo(() => {
        if (!optionData || !optionData.strikes.length) return null;
        let minPain = Infinity;
        let mpStrike = optionData.strikes[0];

        for (const strike of optionData.strikes) {
            let pain = 0;
            for (const c of optionData.calls) {
                if (strike > c.strike) pain += (strike - c.strike) * c.oi;
            }
            for (const p of optionData.puts) {
                if (strike < p.strike) pain += (p.strike - strike) * p.oi;
            }
            if (pain < minPain) { minPain = pain; mpStrike = strike; }
        }
        return mpStrike;
    }, [optionData]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
                {/* Tab switcher */}
                <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
                    {[
                        { id: 'options' as const, label: 'Options', icon: Activity },
                        { id: 'futures' as const, label: 'Futures', icon: BarChart3 },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                                activeTab === id
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <Icon className="w-3 h-3" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* PCR + Max Pain badges */}
                {activeTab === 'options' && optionData && (
                    <div className="flex items-center gap-2">
                        {pcr && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded bg-white/5 border border-white/5">
                                <ArrowUpDown className="w-3 h-3 text-gray-500" />
                                <span className="text-gray-500">PCR</span>
                                <span className={cn("font-bold", Number(pcr) > 1 ? 'text-green-400' : 'text-red-400')}>{pcr}</span>
                            </span>
                        )}
                        {maxPain && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded bg-white/5 border border-white/5">
                                <span className="text-gray-500">Max Pain</span>
                                <span className="font-bold text-yellow-400">{maxPain}</span>
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded bg-white/5 border border-white/5">
                            <span className="text-gray-500">Spot</span>
                            <span className="font-bold text-gray-200">{fmtPrice(optionData.spotPrice)}</span>
                        </span>
                        {optionData.dataSource === 'mock' && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                DEMO
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Expiry selector (options only) */}
            {activeTab === 'options' && optionData && (
                <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto shrink-0">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-2">Expiry</span>
                    {optionData.expiryDates.map((exp: string) => (
                        <button
                            key={exp}
                            onClick={() => setSelectedExpiry(exp)}
                            className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap",
                                (selectedExpiry || optionData.expiryDates[0]) === exp
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                            )}
                        >
                            {exp}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center gap-2">
                        <Activity className="w-6 h-6 text-gray-600" />
                        <span className="text-xs text-gray-500">Loading {activeTab}...</span>
                    </div>
                </div>
            )}

            {/* Option Chain Table */}
            {activeTab === 'options' && optionData && !isLoading && (
                <OptionChainTable
                    calls={optionData.calls}
                    puts={optionData.puts}
                    strikes={optionData.strikes}
                    spotPrice={optionData.spotPrice}
                />
            )}

            {/* Futures Table */}
            {activeTab === 'futures' && futuresData && !isLoading && (
                <FuturesTable
                    contracts={futuresData.contracts}
                    spotPrice={futuresData.spotPrice}
                />
            )}
        </div>
    );
}
