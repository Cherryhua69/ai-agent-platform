import { expect, test } from "@playwright/test";

test("10 个一级视图可切换", async ({ page }) => {
  await page.goto("/");

  const cases = [
    ["工作台", "企业 Agent 工作台"],
    ["竞品策略", "竞品能力对标"],
    ["Agent Studio", "Agent Studio"],
    ["工作流", "工作流编排"],
    ["知识库", "知识库与 RAG Pipeline"],
    ["工具与 MCP", "工具与 MCP 生态"],
    ["评测与观测", "评测与观测"],
    ["发布渠道", "发布渠道"],
    ["模板市场", "模板市场"],
    ["治理设置", "治理设置"]
  ];

  for (const [button, title] of cases) {
    await page.getByRole("button", { name: new RegExp(button) }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});
