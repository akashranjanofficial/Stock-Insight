import { describe, it, expect } from "vitest";
import { formatChartData, extractVolumeData, Candle } from "./chart-utils";

describe("chart-utils data transformation", () => {
    it("should convert millisecond timestamps to seconds and sort chronologically", () => {
        const rawData: Candle[] = [
            { time: 1672617600000, open: 110, high: 115, low: 105, close: 108, volume: 5000 },
            { time: 1672531200000, open: 100, high: 110, low: 95, close: 105, volume: 10000 }, // Older date
        ];

        const formatted = formatChartData(rawData);

        // Should be sorted chronologically
        expect(formatted[0].time).toBe(1672531200);
        expect(formatted[1].time).toBe(1672617600);

        // Values should be preserved
        expect(formatted[0].close).toBe(105);
    });

    it("should format volume data with correct up/down colors", () => {
        const rawData: Candle[] = [
            { time: 1001, open: 100, high: 105, low: 95, close: 105, volume: 1000 }, // Up candle
            { time: 1002, open: 105, high: 110, low: 90, close: 95, volume: 2000 },  // Down candle
        ];

        const volumeData = extractVolumeData(rawData);

        expect(volumeData[0].value).toBe(1000);
        expect(volumeData[0].color).toBe("rgba(34, 197, 94, 0.4)"); // Green for up

        expect(volumeData[1].value).toBe(2000);
        expect(volumeData[1].color).toBe("rgba(239, 68, 68, 0.4)"); // Red for down
    });
});
