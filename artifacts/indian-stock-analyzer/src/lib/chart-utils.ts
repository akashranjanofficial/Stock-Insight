export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export function formatChartData(data: Candle[]) {
    return data
        .map((d) => {
            const timeInSeconds = d.time > 1e10 ? Math.floor(d.time / 1000) : d.time;
            return { ...d, time: timeInSeconds };
        })
        .sort((a, b) => a.time - b.time);
}

export function extractPriceData(formattedData: Candle[]) {
    return formattedData.map((d) => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
    }));
}

export function extractVolumeData(formattedData: Candle[]) {
    return formattedData.map((d) => ({
        time: d.time as any,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));
}

// ─── INDICATOR CALCULATIONS ──────────────────────────────────────────────────

export function calcSMA(data: Candle[], period: number) {
    const result: { time: any; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        result.push({ time: data[i].time as any, value: sum / period });
    }
    return result;
}

export function calcEMA(data: Candle[], period: number) {
    const result: { time: any; value: number }[] = [];
    const k = 2 / (period + 1);
    let ema = data[0]?.close ?? 0;
    for (let i = 0; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        if (i >= period - 1) {
            result.push({ time: data[i].time as any, value: ema });
        }
    }
    return result;
}

export function calcBollingerBands(data: Candle[], period: number = 20, stdMult: number = 2) {
    const upper: { time: any; value: number }[] = [];
    const lower: { time: any; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close;
        const mean = sum / period;
        let sqSum = 0;
        for (let j = 0; j < period; j++) sqSum += (data[i - j].close - mean) ** 2;
        const std = Math.sqrt(sqSum / period);
        upper.push({ time: data[i].time as any, value: mean + stdMult * std });
        lower.push({ time: data[i].time as any, value: mean - stdMult * std });
    }
    return { upper, lower };
}

export function calcVWAP(data: Candle[]) {
    const result: { time: any; value: number }[] = [];
    let cumulativeTPV = 0;
    let cumulativeVol = 0;
    for (let i = 0; i < data.length; i++) {
        const tp = (data[i].high + data[i].low + data[i].close) / 3;
        cumulativeTPV += tp * data[i].volume;
        cumulativeVol += data[i].volume;
        if (cumulativeVol > 0) {
            result.push({ time: data[i].time as any, value: cumulativeTPV / cumulativeVol });
        }
    }
    return result;
}

export type IndicatorId = 'sma20' | 'sma50' | 'sma200' | 'ema9' | 'ema21' | 'bollinger' | 'vwap';

export interface IndicatorDef {
    id: IndicatorId;
    label: string;
    color: string;
    color2?: string; // for bands
}

export const AVAILABLE_INDICATORS: IndicatorDef[] = [
    { id: 'sma20', label: 'SMA 20', color: '#f59e0b' },
    { id: 'sma50', label: 'SMA 50', color: '#3b82f6' },
    { id: 'sma200', label: 'SMA 200', color: '#a855f7' },
    { id: 'ema9', label: 'EMA 9', color: '#ec4899' },
    { id: 'ema21', label: 'EMA 21', color: '#14b8a6' },
    { id: 'bollinger', label: 'Bollinger Bands', color: 'rgba(99,102,241,0.5)', color2: 'rgba(99,102,241,0.5)' },
    { id: 'vwap', label: 'VWAP', color: '#f97316' },
];
