import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: Candle[];
  height?: number;
}

// Custom candlestick shape using recharts' background bounds + domain for pixel math
const CandleShape = (props: any) => {
  const { x, width, payload, yMin, yMax, chartTop, chartHeight } = props;
  if (!payload || yMax === yMin) return null;

  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? '#22c55e' : '#ef4444';

  // Map a data value to pixel y coordinate
  const toY = (val: number) =>
    chartTop + ((yMax - val) / (yMax - yMin)) * chartHeight;

  const cx = x + width / 2;
  const bodyW = Math.max(2, width - 2);

  const yHigh = toY(high);
  const yLow = toY(low);
  const yBody1 = toY(Math.max(open, close));
  const yBody2 = toY(Math.min(open, close));
  const bodyH = Math.max(1, yBody2 - yBody1);

  return (
    <g>
      {/* High-Low wick */}
      <line
        x1={cx}
        y1={yHigh}
        x2={cx}
        y2={yLow}
        stroke={color}
        strokeWidth={1}
      />
      {/* Candle body */}
      <rect
        x={cx - bodyW / 2}
        y={yBody1}
        width={bodyW}
        height={bodyH}
        fill={color}
        rx={1}
      />
    </g>
  );
};

// Volume bar shape
const VolumeShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.close >= payload.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)';
  return <rect x={x} y={y} width={Math.max(1, width - 1)} height={height} fill={color} rx={1} />;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isUp = d.close >= d.open;
  const color = isUp ? '#22c55e' : '#ef4444';
  const change = d.close - d.open;
  const changePct = ((change / d.open) * 100).toFixed(2);

  return (
    <div
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      className="rounded-xl p-3 text-xs font-mono shadow-2xl z-50 min-w-[160px]"
    >
      <p className="font-semibold text-foreground mb-2 text-[11px]">{d.dateStr}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">Open</span>
        <span className="text-foreground text-right">{d.open?.toFixed(2)}</span>
        <span className="text-muted-foreground">High</span>
        <span className="text-green-400 text-right">{d.high?.toFixed(2)}</span>
        <span className="text-muted-foreground">Low</span>
        <span className="text-red-400 text-right">{d.low?.toFixed(2)}</span>
        <span className="text-muted-foreground">Close</span>
        <span style={{ color }} className="text-right font-bold">{d.close?.toFixed(2)}</span>
        <span className="text-muted-foreground">Chg%</span>
        <span style={{ color }} className="text-right">{change >= 0 ? '+' : ''}{changePct}%</span>
        <span className="text-muted-foreground mt-1">Vol</span>
        <span className="text-foreground text-right mt-1">{(d.volume / 1e6).toFixed(2)}M</span>
      </div>
    </div>
  );
};

export function CandlestickChart({ data, height = 420 }: CandlestickChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      dateStr: (() => {
        try {
          const ms = d.time > 1e10 ? d.time : d.time * 1000;
          return format(new Date(ms), 'dd MMM');
        } catch {
          return '';
        }
      })(),
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No chart data available
      </div>
    );
  }

  const allLows  = data.map((d) => d.low);
  const allHighs = data.map((d) => d.high);
  const yMin = Math.min(...allLows);
  const yMax = Math.max(...allHighs);
  const yPad = (yMax - yMin) * 0.06;
  const domainMin = yMin - yPad;
  const domainMax = yMax + yPad;

  // How many data points to show ticks for
  const tickEvery = Math.max(1, Math.floor(data.length / 7));

  // Chart area (price) takes 72% of height; volume takes 28%
  const priceH = Math.floor(height * 0.72);
  const volH = height - priceH;

  // We need to pass yMin/yMax and the chart pixel bounds into the custom shape.
  // Recharts doesn't expose yAxis.scale inside shape props directly, but we can use
  // a trick: render the candles as Bars with a custom shape that uses `background`
  // (which recharts provides = the full plot area rect).
  const ShapeWithScale = (props: any) => {
    const bg = props.background;
    if (!bg) return null;
    return (
      <CandleShape
        {...props}
        yMin={domainMin}
        yMax={domainMax}
        chartTop={bg.y}
        chartHeight={bg.height}
      />
    );
  };

  return (
    <div style={{ height }} className="w-full select-none">
      {/* Price candlestick chart */}
      <div style={{ height: priceH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 56, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="hsl(var(--border))"
              vertical={false}
              opacity={0.4}
            />
            <XAxis
              dataKey="dateStr"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={tickEvery}
              hide
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(0)}
              orientation="right"
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />
            {/* Dummy bar with 0 height — just used to drive the custom shape */}
            <Bar
              dataKey="close"
              shape={<ShapeWithScale />}
              isAnimationActive={false}
              maxBarSize={20}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill="transparent" />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      <div style={{ height: volH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 2, right: 56, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="dateStr"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={tickEvery}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
              orientation="right"
              width={52}
            />
            <Bar
              dataKey="volume"
              shape={<VolumeShape />}
              isAnimationActive={false}
              maxBarSize={20}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
