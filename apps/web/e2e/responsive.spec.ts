import { expect, test } from "@playwright/test";

test("dashboard overview cards fill desktop home area", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".dashboard-page");
  await page.waitForTimeout(450);

  const layout = await page.evaluate(() => {
    const shellElement = document.querySelector(".content-shell");
    const shell = shellElement?.getBoundingClientRect();
    const dashboard = document.querySelector(".dashboard-page")?.getBoundingClientRect();
    const grid = document.querySelector(".dashboard-page .grid-two")?.getBoundingClientRect();
    const panel = document.querySelector(".dashboard-page .grid-two .panel")?.getBoundingClientRect();

    if (!shellElement || !shell || !dashboard || !grid || !panel) {
      return null;
    }

    const shellStyle = getComputedStyle(shellElement);
    const shellContentBottom = shell.bottom - parseFloat(shellStyle.paddingBottom);

    return {
      dashboardBottomGap: shellContentBottom - dashboard.bottom,
      gridBottomGap: shellContentBottom - grid.bottom,
      panelBottomGap: shellContentBottom - panel.bottom
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.dashboardBottomGap).toBeLessThanOrEqual(2);
  expect(layout!.gridBottomGap).toBeGreaterThanOrEqual(12);
  expect(layout!.gridBottomGap).toBeLessThanOrEqual(36);
  expect(layout!.panelBottomGap).toBeGreaterThanOrEqual(12);
  expect(layout!.panelBottomGap).toBeLessThanOrEqual(36);
});

test("移动端没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  expect(hasOverflow).toBe(false);
});
