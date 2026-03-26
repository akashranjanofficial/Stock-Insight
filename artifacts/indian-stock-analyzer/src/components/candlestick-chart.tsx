import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

export function CandlestickChart({ data, height = 400 }: CandlestickChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => {
      const isUp = d.close >= d.open;
      return {
        ...d,
        dateStr: (() => {
          try {
            const ms = d.time > 1e10 ? d.time : d.time * 1000;
            return format(new Date(ms), 'MMM dd');
          } catch {
            return '';
          }
        })(),
        isUp,
        // For area chart: use close price
        closePrice: d.close,
        // For custom candle rendering via stacked bar trick
        // body: [low, min(open,close), max(open,close), high]
        wickLow: d.low,
        bodyLow: Math.min(d.open, d.close),
        bodyHigh: Math.max(d.open, d.close),
        wickHigh: d.high,
      };
    });
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No chart data available
      </div>
    );
  }

  const closes = data.map((d) => d.close);
  const min = Math.min(...data.map((d) => d.low));
  const max = Math.max(...data.map((d) => d.high));
  const padding = (max - min) * 0.08;

  const isOverall = (closes[closes.length - 1] ?? 0) >= (closes[0] ?? 0);
  const lineColor = isOverall ? 'hsl(142, 71%, 45%)' : 'hsl(350, 89%, 60%)';
  const gradientId = isOverall ? 'gradientUp' : 'gradientDown';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0]?.payload;
      if (!d) return null;
      const isUp = d.close >= d.open;
      const color = isUp ? '#22c55e' : '#ef4444';
      return (
        <div className="bg-card border border-border rounded-xl p-4 text-xs font-mono shadow-xl z-50">
          <p className="font-semibold text-foreground mb-2">{d.dateStr}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">O:</span>
            <span style={{ color }}>{d.open?.toFixed(2)}</span>
            <span className="text-muted-foreground">H:</span>
            <span className="text-foreground">{d.high?.toFixed(2)}</span>
            <span className="text-muted-foreground">L:</span>
            <span className="text-foreground">{d.low?.toFixed(2)}</span>
            <span className="text-muted-foreground">C:</span>
            <span style={{ color }}>{d.close?.toFixed(2)}</span>
            <span className="text-muted-foreground mt-1">Vol:</span>
            <span className="text-foreground mt-1">{(d.volume / 1e6).toFixed(2)}M</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Decide how many ticks to show based on data density
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(350, 89%, 60%)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(350, 89%, 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
          <XAxis
            dataKey="dateStr"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            domain={[min - padding, max + padding]}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(0)}
            orientation="right"
            width={55}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="closePrice"
            stroke={lineColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume bars */}
      <ResponsiveContainer width="100%" height="25%">
        <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="dateStr" hide />
          <YAxis hide domain={[0, 'dataMax * 2']} />
          <Bar
            dataKey="volume"
            isAnimationActive={false}
            maxBarSize={6}
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const color = payload?.isUp ? 'hsl(142, 71%, 45%)' : 'hsl(350, 89%, 60%)';
              return <rect x={x} y={y} width={Math.max(1, width)} height={height} fill={color} opacity={0.5} />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
