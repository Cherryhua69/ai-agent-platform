# 项目协作指南

## CodeGraph 代码地图

本项目目前不使用 graphify 作为日常代码地图。涉及架构、工作流、仓储层、服务层、数据模型、API 边界或多个模块的工作时，请优先使用 CodeGraph 理解代码关系和影响范围。

在进行跨模块或架构层面的变更前，先通过 CodeGraph 查询相关符号、调用关系或影响范围，例如：

```text
codegraph_explore("<question>")
codegraph_node("<symbol>")
codegraph_callers("<symbol>")
codegraph_callees("<symbol>")
codegraph_impact("<symbol>")
```

适合使用 CodeGraph 的场景：

- 修改工作流执行、工作流节点、图编译或图校验逻辑。
- 调整仓储层或服务层边界，例如 `WorkflowRepository`、`AgentRepository` 或 `AgentRunService`。
- 修改模型或供应商集成，例如 `LangChainModelClient`。
- 重构共享数据库模型、Schema 或 `Base`。
- 在删除、重命名或移动代码前，先评估调用方、被调用方和影响范围。
- 在信任意外依赖或推断关系前，先审查 CodeGraph 返回的源码位置和调用链是否合理。

CodeGraph 的本地索引位于 `.codegraph/`，该目录只保存本机生成的数据库、日志和运行状态，不应提交到 Git。

CodeGraph watcher 正常运行时会自动同步文件变更；如果查询结果看起来过期，请先检查 CodeGraph 状态或重新触发索引，再依赖查询结果。
