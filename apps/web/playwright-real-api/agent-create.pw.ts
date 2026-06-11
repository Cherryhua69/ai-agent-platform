import { expect, test } from "@playwright/test";

test("真实 API 模式可以创建 Agent 草稿并展示返回结果", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Agent Studio/ }).click();
  await page.getByRole("button", { name: "创建草稿 Agent" }).click();

  await expect(page.getByText("已创建草稿：售后政策助手")).toBeVisible();
  await expect(page.getByText(/flow_agent_/).first()).toBeVisible();
});
