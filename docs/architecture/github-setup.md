# GitHub 仓库配置建议

## 1. 仓库名称

推荐：

```txt
ai-agent-platform
```

## 2. 分支策略

- `main`：稳定分支，可部署版本。
- `dev`：日常集成分支。
- `feature/*`：功能开发分支。
- `fix/*`：缺陷修复分支。
- `docs/*`：文档变更分支。

## 3. Pull Request 要求

每个 PR 应包含：
- 变更摘要
- 关联 Issue
- 截图或录屏，适用于 UI 变更
- 测试说明
- 风险与回滚方式

合并前建议检查：
- lint
- typecheck
- unit tests
- build

## 4. Issue 分类

- Feature：功能需求
- Bug：缺陷
- Design：UI/UX 设计任务
- Tech Debt：技术债
- Docs：文档
- Research：技术调研

## 5. Labels

建议标签：
- `area:web`
- `area:api`
- `area:workflow`
- `area:mcp`
- `area:knowledge`
- `area:evaluation`
- `area:release`
- `type:feature`
- `type:bug`
- `type:design`
- `type:docs`
- `priority:p0`
- `priority:p1`
- `priority:p2`

## 6. 本地连接远程仓库

创建 GitHub 仓库后执行：

```powershell
git remote add origin https://github.com/<owner>/ai-agent-platform.git
git branch -M main
git push -u origin main
```

如果使用 GitHub CLI：

```powershell
gh repo create ai-agent-platform --private --source . --remote origin --push
```

