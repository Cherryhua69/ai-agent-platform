import { expect, test } from "@playwright/test";

test("8 个主视图可切换", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /评测观察/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /治理/ })).toHaveCount(0);

  const cases = [
    ["总览", "总览"],
    ["智能体", "Agent Studio"],
    ["工作流", "工作流"],
    ["知识库", "知识库"],
    ["工具", "工具"],
    ["运行记录", "运行记录"],
    ["发布", "发布"],
    ["模板", "模板"]
  ];

  for (const [button, title] of cases) {
    await page.getByRole("button", { name: new RegExp(button) }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});
