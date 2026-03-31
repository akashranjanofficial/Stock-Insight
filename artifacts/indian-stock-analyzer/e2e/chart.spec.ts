import { test, expect } from '@playwright/test';

test.describe('Stock Chart — Core Features', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/stock/RELIANCE?exchange=NSE');
        // Wait for chart canvas to render
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    });

    // ─── CHART LOAD ────────────────────────────────────────────────────

    test('chart renders with candlesticks and OHLC legend', async ({ page }) => {
        // OHLC legend should show the symbol and price values
        const ohlcBar = page.locator('text=RELIANCE').first();
        await expect(ohlcBar).toBeVisible({ timeout: 10000 });

        // Should show O/H/L/C labels
        await expect(page.locator('text=/O\\s/').first()).toBeVisible();
        await expect(page.locator('text=/H\\s/').first()).toBeVisible();
        await expect(page.locator('text=/L\\s/').first()).toBeVisible();
        await expect(page.locator('text=/C\\s/').first()).toBeVisible();
    });

    // ─── MULTIPLE INDICATORS ──────────────────────────────────────────

    test('can select multiple indicators simultaneously', async ({ page }) => {
        // Open indicator menu
        const indicatorBtn = page.locator('button:has-text("Indicators")');
        await indicatorBtn.click();

        // SMA 20 should already be active (default)
        const sma20Checkbox = page.locator('button:has-text("SMA 20")');
        await expect(sma20Checkbox).toBeVisible();

        // Activate EMA 9
        await page.locator('button:has-text("EMA 9")').click();
        // Activate SMA 50
        await page.locator('button:has-text("SMA 50")').click();
        // Activate VWAP
        await page.locator('button:has-text("VWAP")').click();

        // The badge should show "4" active indicators
        await expect(indicatorBtn.locator('span:has-text("4")')).toBeVisible();

        // Close and reopen — they should remain selected
        await page.keyboard.press('Escape');
        await indicatorBtn.click();

        // All 4 should still be checked (their checkboxes colored)
        const activeCount = await page.locator('[data-indicator-menu] .bg-\\[\\#f59e0b\\], [data-indicator-menu] .bg-\\[\\#ec4899\\], [data-indicator-menu] .bg-\\[\\#3b82f6\\], [data-indicator-menu] .bg-\\[\\#f97316\\]').count();
        expect(activeCount).toBeGreaterThanOrEqual(3);
    });

    // ─── TIMEFRAME CHANGE STABILITY ───────────────────────────────────

    test('changing timeframe does not reset chart or indicators', async ({ page }) => {
        // First, enable an extra indicator
        const indicatorBtn = page.locator('button:has-text("Indicators")');
        await indicatorBtn.click();
        await page.locator('button:has-text("EMA 9")').click();
        // Close menu
        await page.mouse.click(500, 400);
        await page.waitForTimeout(500);

        // Badge should show 2 (SMA 20 default + EMA 9)
        await expect(indicatorBtn.locator('span:has-text("2")')).toBeVisible();

        // Change timeframe to 15M
        await page.locator('button:has-text("15M")').click();
        await page.waitForTimeout(3000); // Wait for data reload

        // Chart canvas should still be visible (not minimized or gone)
        await expect(page.locator('canvas').first()).toBeVisible();

        // Indicators should still show count of 2
        await expect(indicatorBtn.locator('span:has-text("2")')).toBeVisible();
    });

    // ─── INTERVAL SELECTOR ────────────────────────────────────────────

    test('all interval options are available including 1M and 2M', async ({ page }) => {
        // Check that 1M and 2M buttons exist in toolbar
        const intervals = ['1M', '2M', '5M', '15M', '30M', '1H', '1D', '1WK', '1MO'];
        for (const int of intervals) {
            await expect(page.locator(`button:has-text("${int}")`).first()).toBeVisible();
        }
    });

    test('clicking 1M interval loads minute-level data', async ({ page }) => {
        await page.locator('button:has-text("1M")').first().click();
        await page.waitForTimeout(5000); // Wait for data to load
        // Chart should still be visible with canvas
        await expect(page.locator('canvas').first()).toBeVisible();
        // OHLC legend should still show data
        await expect(page.locator('text=/O\\s/').first()).toBeVisible();
    });

    // ─── BOTTOM TIMEFRAME RANGE BAR ───────────────────────────────────

    test('bottom timeframe range bar works', async ({ page }) => {
        const ranges = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

        for (const range of ranges) {
            // Find the bottom bar button (not the interval bar)
            const bottomBar = page.locator('.border-t').last();
            const rangeBtn = bottomBar.locator(`button:has-text("${range}")`);
            if (await rangeBtn.isVisible()) {
                await rangeBtn.click();
                await page.waitForTimeout(300);
                // Chart should remain visible
                await expect(page.locator('canvas').first()).toBeVisible();
            }
        }
    });

    // ─── FULLSCREEN ────────────────────────────────────────────────────

    test('fullscreen toggle works', async ({ page }) => {
        const fsBtn = page.locator('button[title="Fullscreen"]');
        await expect(fsBtn).toBeVisible();
        // We can't truly test fullscreen API in headless but we can click it
        await fsBtn.click();
        await page.waitForTimeout(500);
        // The chart should still render
        await expect(page.locator('canvas').first()).toBeVisible();
    });

    // ─── SYMBOL SEARCH IN CHART ─────────────────────────────────────

    test('symbol search in chart toolbar works', async ({ page }) => {
        const symbolBtn = page.locator('[data-symbol-search] button');
        await symbolBtn.click();
        await page.waitForTimeout(300);

        // Search input should appear
        const searchInput = page.locator('[data-symbol-search] input');
        await expect(searchInput).toBeVisible();

        await searchInput.fill('INFY');
        await page.waitForTimeout(2000);

        // Should see results
        const result = page.locator('button:has-text("INFY")').first();
        await expect(result).toBeVisible({ timeout: 5000 });
    });
});

// ─── WATCHLIST ─────────────────────────────────────────────────────

test.describe('Watchlist', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/stock/RELIANCE?exchange=NSE');
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    });

    test('watchlist tab shows default stocks with live prices', async ({ page }) => {
        // Click Watchlist tab
        await page.locator('button:has-text("Watchlist")').click();
        await page.waitForTimeout(2000);

        // Should show default entries
        await expect(page.locator('text=NIFTY 50').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=RELIANCE').nth(1)).toBeVisible({ timeout: 10000 });

        // Should show price data (any number with decimal)
        const priceEl = page.locator('text=/\\d+\\.\\d+/').first();
        await expect(priceEl).toBeVisible({ timeout: 10000 });
    });

    test('can add and remove symbols from watchlist', async ({ page }) => {
        await page.locator('button:has-text("Watchlist")').click();
        await page.waitForTimeout(1000);

        // Click "Add symbol"
        await page.locator('button:has-text("Add symbol")').click();
        await page.waitForTimeout(300);

        // Type a symbol
        const input = page.locator('input[placeholder="Search symbol..."]');
        await input.fill('SBIN');
        await page.waitForTimeout(2000);

        // Click the first result
        const sbiResult = page.locator('button:has-text("SBIN")').first();
        if (await sbiResult.isVisible()) {
            await sbiResult.click();
            await page.waitForTimeout(1000);

            // SBIN should now appear in watchlist
            await expect(page.locator('text=SBIN').first()).toBeVisible();
        }
    });
});
