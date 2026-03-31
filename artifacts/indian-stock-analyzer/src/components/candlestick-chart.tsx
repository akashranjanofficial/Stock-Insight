import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import {
  formatChartData, extractPriceData, extractVolumeData,
  calcSMA, calcEMA, calcBollingerBands, calcVWAP,
  AVAILABLE_INDICATORS, type Candle, type IndicatorId
} from '../lib/chart-utils';
import { Maximize2, Minimize2, ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { useSearchStocks } from '@workspace/api-client-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface OHLCData {
  open: number; high: number; low: number; close: number; volume: number; time: number;
}

type TimeframeRange = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'All';

interface CandlestickChartProps {
  data: Candle[];
  symbol?: string;
  interval?: string;
  onIntervalChange?: (interval: string) => void;
}

// ─── SYMBOL SEARCH MINI ──────────────────────────────────────────────────────

function ChartSymbolSearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = useSearchStocks({ q: query }, {
    query: { enabled: query.length >= 1 } as any,
  });

  const handleSelect = (sym: string, exchange: string) => {
    setLocation(`/stock/${encodeURIComponent(sym)}?exchange=${exchange}`);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" data-symbol-search>
      <button
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/5"
      >
        <Search className="w-3 h-3" />
        <span className="hidden sm:inline">Symbol</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              ref={inputRef}
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
            <div className="max-h-60 overflow-y-auto">
              {(results as any[]).slice(0, 6).map((s: any) => (
                <button
                  key={`${s.symbol}-${s.exchange}`}
                  onClick={() => handleSelect(s.symbol, s.exchange)}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-200">{s.symbol}</span>
                    <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{s.exchange}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {results && (results as any[]).length === 0 && query.length >= 1 && (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN CHART COMPONENT ────────────────────────────────────────────────────

export function CandlestickChart({ data, symbol, interval, onIntervalChange }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Stable series refs — persist across renders
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const formattedDataRef = useRef<Candle[]>([]);
  const indicatorMenuRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorId>>(new Set(['sma20']));
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [ohlc, setOhlc] = useState<OHLCData | null>(null);
  const [activeRange, setActiveRange] = useState<TimeframeRange | null>(null);

  // Normalize data
  const formattedData = useMemo(() => formatChartData(data), [data]);
  const priceData = useMemo(() => extractPriceData(formattedData), [formattedData]);
  const volumeData = useMemo(() => extractVolumeData(formattedData), [formattedData]);

  // Keep ref in sync
  useEffect(() => { formattedDataRef.current = formattedData; }, [formattedData]);

  // Last candle for default OHLC
  const lastCandle = useMemo(() => {
    if (formattedData.length === 0) return null;
    const c = formattedData[formattedData.length - 1];
    return { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, time: c.time };
  }, [formattedData]);

  const displayOhlc = ohlc || lastCandle;

  // Compute indicators
  const indicatorData = useMemo(() => {
    const result: Record<string, any> = {};
    if (activeIndicators.has('sma20')) result.sma20 = calcSMA(formattedData, 20);
    if (activeIndicators.has('sma50')) result.sma50 = calcSMA(formattedData, 50);
    if (activeIndicators.has('sma200')) result.sma200 = calcSMA(formattedData, 200);
    if (activeIndicators.has('ema9')) result.ema9 = calcEMA(formattedData, 9);
    if (activeIndicators.has('ema21')) result.ema21 = calcEMA(formattedData, 21);
    if (activeIndicators.has('bollinger')) result.bollinger = calcBollingerBands(formattedData);
    if (activeIndicators.has('vwap')) result.vwap = calcVWAP(formattedData);
    return result;
  }, [formattedData, activeIndicators]);

  const toggleIndicator = useCallback((id: IndicatorId) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ═══ CREATE CHART ONCE (stable, no data dependencies) ═══
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });
    chartRef.current = chart;

    // Create the main candlestick + volume series ONCE
    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = cs;

    const vs = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = vs;

    // Crosshair handler — uses ref so it always reads fresh data
    chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      if (!param.time || !param.seriesData) {
        setOhlc(null);
        return;
      }
      const candle = formattedDataRef.current.find(d => d.time === param.time);
      if (candle) {
        setOhlc({ open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume, time: candle.time });
      }
    });

    return () => {
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
      chart.remove();
      chartRef.current = null;
    };
  }, []); // ← NO DATA DEPENDENCIES — chart is created once and persists

  // ═══ UPDATE CANDLE + VOLUME DATA (in-place, no series recreation) ═══
  useEffect(() => {
    if (candleSeriesRef.current) candleSeriesRef.current.setData(priceData);
    if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [priceData, volumeData]);

  // ═══ UPDATE INDICATOR OVERLAYS (only indicator series change) ═══
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old indicator series
    indicatorSeriesRef.current.forEach((series) => {
      try { chart.removeSeries(series); } catch { /* ignore */ }
    });
    indicatorSeriesRef.current.clear();

    // Add new indicator series
    const addLine = (lineData: { time: any; value: number }[], color: string, lineWidth: 1 | 2 | 3 | 4 = 1, id: string) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(lineData);
      indicatorSeriesRef.current.set(id, series);
    };

    if (indicatorData.sma20) addLine(indicatorData.sma20, '#f59e0b', 1, 'sma20');
    if (indicatorData.sma50) addLine(indicatorData.sma50, '#3b82f6', 1, 'sma50');
    if (indicatorData.sma200) addLine(indicatorData.sma200, '#a855f7', 1, 'sma200');
    if (indicatorData.ema9) addLine(indicatorData.ema9, '#ec4899', 1, 'ema9');
    if (indicatorData.ema21) addLine(indicatorData.ema21, '#14b8a6', 1, 'ema21');
    if (indicatorData.vwap) addLine(indicatorData.vwap, '#f97316', 2, 'vwap');

    if (indicatorData.bollinger) {
      addLine(indicatorData.bollinger.upper, 'rgba(99,102,241,0.5)', 1, 'bb_upper');
      addLine(indicatorData.bollinger.lower, 'rgba(99,102,241,0.5)', 1, 'bb_lower');
    }
  }, [indicatorData]); // ← Only re-runs when indicators change, NOT on data change

  // Fullscreen handler
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Resize chart to fill fullscreen container
      setTimeout(() => chartRef.current?.applyOptions({ autoSize: true }), 100);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Close indicator menu on outside click — use ref.contains() for reliability
  useEffect(() => {
    if (!showIndicatorMenu) return;
    const handler = (e: MouseEvent) => {
      if (indicatorMenuRef.current && !indicatorMenuRef.current.contains(e.target as Node)) {
        setShowIndicatorMenu(false);
      }
    };
    // Delay adding listener so the opening click doesn't immediately close the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler, true);
    };
  }, [showIndicatorMenu]);

  // Timeframe range handler
  const handleRangeClick = useCallback((range: TimeframeRange) => {
    setActiveRange(range);
    const chart = chartRef.current;
    const fd = formattedDataRef.current;
    if (!chart || fd.length === 0) return;

    const now = fd[fd.length - 1].time;
    const DAY = 86400;
    let fromTime: number;

    switch (range) {
      case '1D': fromTime = now - DAY; break;
      case '5D': fromTime = now - 5 * DAY; break;
      case '1M': fromTime = now - 30 * DAY; break;
      case '3M': fromTime = now - 90 * DAY; break;
      case '6M': fromTime = now - 180 * DAY; break;
      case 'YTD': {
        const d = new Date(now * 1000);
        fromTime = Math.floor(new Date(d.getFullYear(), 0, 1).getTime() / 1000);
        break;
      }
      case '1Y': fromTime = now - 365 * DAY; break;
      case '5Y': fromTime = now - 5 * 365 * DAY; break;
      case 'All':
      default:
        chart.timeScale().fitContent();
        return;
    }

    chart.timeScale().setVisibleRange({ from: fromTime as any, to: now as any });
  }, []);

  const fmtPrice = (v: number) => v >= 1000 ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toFixed(2);
  const fmtVol = (v: number) => v >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' : v >= 1e5 ? (v / 1e5).toFixed(2) + ' L' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toString();

  const timeframeRanges: TimeframeRange[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];
  const chartIntervals = ['1m', '2m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo'];

  return (
    <div
      ref={wrapperRef}
      className={cn("flex flex-col w-full h-full", isFullscreen && "bg-[#0f0f14]")}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-white/5 shrink-0 bg-black/20 backdrop-blur-sm gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChartSymbolSearch />

          {onIntervalChange && (
            <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/5">
              {chartIntervals.map((int) => (
                <button
                  key={int}
                  onClick={() => { onIntervalChange(int); setActiveRange(null); }}
                  className={cn(
                    "px-2 py-1 text-[11px] font-semibold rounded-md transition-colors",
                    interval === int
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                  )}
                >
                  {int.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div className="relative" ref={indicatorMenuRef}>
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors border border-white/5"
            >
              <span>Indicators</span>
              {activeIndicators.size > 0 && (
                <span className="px-1 py-0.5 text-[9px] rounded-full bg-blue-500/20 text-blue-400 font-bold min-w-[16px] text-center">
                  {activeIndicators.size}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {showIndicatorMenu && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">
                  Overlay Indicators
                </div>
                {AVAILABLE_INDICATORS.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center"
                      style={{
                        backgroundColor: activeIndicators.has(ind.id) ? ind.color : 'transparent',
                        borderColor: ind.color,
                      }}
                    >
                      {activeIndicators.has(ind.id) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-gray-300">{ind.label}</span>
                    <div className="ml-auto w-5 h-0.5 rounded-full" style={{ backgroundColor: ind.color }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden lg:flex items-center gap-1">
            {AVAILABLE_INDICATORS.filter(i => activeIndicators.has(i.id)).map(ind => (
              <span
                key={ind.id}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/5 text-gray-500 border border-white/5"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
                {ind.label}
              </span>
            ))}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* OHLC Legend */}
      {displayOhlc && (
        <div className="flex items-center gap-3 px-3 py-1 shrink-0 text-[11px] font-mono bg-black/10 border-b border-white/[0.03] flex-wrap">
          {symbol && <span className="font-bold text-gray-200 text-xs mr-1">{symbol}</span>}
          <span className="text-gray-500">O <span className={displayOhlc.close >= displayOhlc.open ? 'text-green-400' : 'text-red-400'}>{fmtPrice(displayOhlc.open)}</span></span>
          <span className="text-gray-500">H <span className="text-gray-300">{fmtPrice(displayOhlc.high)}</span></span>
          <span className="text-gray-500">L <span className="text-gray-300">{fmtPrice(displayOhlc.low)}</span></span>
          <span className="text-gray-500">C <span className={displayOhlc.close >= displayOhlc.open ? 'text-green-400' : 'text-red-400'}>{fmtPrice(displayOhlc.close)}</span></span>
          {displayOhlc.volume > 0 && (
            <span className="text-gray-500">Vol <span className="text-gray-400">{fmtVol(displayOhlc.volume)}</span></span>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="flex-1 w-full min-h-0" />

      {/* Bottom Timeframe Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-white/5 shrink-0 bg-black/20 text-[11px]">
        <div className="flex items-center gap-0.5">
          {timeframeRanges.map((range) => (
            <button
              key={range}
              onClick={() => handleRangeClick(range)}
              className={cn(
                "px-2 py-1 rounded transition-colors font-medium",
                activeRange === range
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              )}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-gray-600 font-mono">
          {new Date().toLocaleTimeString('en-IN', { hour12: false })} UTC+5:30
        </div>
      </div>
    </div>
  );
}
