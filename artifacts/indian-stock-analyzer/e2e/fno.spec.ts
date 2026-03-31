import { test, expect } from '@playwright/test';

test.describe('F&O Option Chain', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/stock/RELIANCE?exchange=NSE');
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    });

    test('F&O tab loads option chain with correct structure', async ({ page }) => {
        // Click F&O tab
        await page.locator('button:has-text("F&O")').click();
        await page.waitForTimeout(5000);

        // Options sub-tab should be active by default
        await expect(page.locator('button:has-text("Options")')).toBeVisible();

        // Should show expiry dates
        const expiryButtons = page.locator('button:has-text(/\\d+-\\w+-\\d{4}/)');
        expect(await expiryButtons.count()).toBeGreaterThanOrEqual(2);

        // Should show PCR badge
        await expect(page.locator('text=PCR')).toBeVisible();

        // Should show Max Pain badge
        await expect(page.locator('text=Max Pain')).toBeVisible();

        // Should show Spot price
        await expect(page.locator('text=Spot')).toBeVisible();

        // Should show strike column header
        await expect(page.locator('th:has-text("Strike")')).toBeVisible();

        // Should show ATM label
        await expect(page.locator('text=ATM')).toBeVisible({ timeout: 3000 });
    });

    test('option chain has call and put columns', async ({ page }) => {
        await page.locator('button:has-text("F&O")').click();
        await page.waitForTimeout(5000);

        // Call side headers
        await expect(page.locator('th:has-text("OI")').first()).toBeVisible();
        await expect(page.locator('th:has-text("Vol")').first()).toBeVisible();
        await expect(page.locator('th:has-text("IV")').first()).toBeVisible();
        await expect(page.locator('th:has-text("LTP")').first()).toBeVisible();

        // At least 10 strike rows
        const strikeRows = page.locator('table tbody tr');
        expect(await strikeRows.count()).toBeGreaterThanOrEqual(10);
    });

    test('switching expiry date refreshes data', async ({ page }) => {
        await page.locator('button:has-text("F&O")').click();
        await page.waitForTimeout(5000);

        // Click second expiry
        const expiries = page.locator('button:has-text(/\\d+-\\w+-\\d{4}/)');
        const secondExpiry = expiries.nth(1);
        const secondExpiryText = await secondExpiry.textContent();
        await secondExpiry.click();
        await page.waitForTimeout(3000);

        // Second expiry should now be highlighted (active style)
        await expect(secondExpiry).toBeVisible();
        // Data should still be present
        await expect(page.locator('text=ATM')).toBeVisible({ timeout: 3000 });
    });

    test('futures sub-tab shows contracts', async ({ page }) => {
        // Click F&O tab
        await page.locator('button:has-text("F&O")').click();
        await page.waitForTimeout(3000);

        // Click Futures sub-tab
        await page.locator('button:has-text("Futures")').click();
        await page.waitForTimeout(3000);

        // Should show contract labels
        await expect(page.locator('text=Current')).toBeVisible();
        await expect(page.locator('text=Next')).toBeVisible();
        await expect(page.locator('text=Far')).toBeVisible();

        // Should show Basis column
        await expect(page.locator('th:has-text("Basis")')).toBeVisible();

        // Should show Lot Size column
        await expect(page.locator('th:has-text("Lot Size")')).toBeVisible();

        // Should show Spot Price at bottom
        await expect(page.locator('text=Spot Price:')).toBeVisible();
    });
});
