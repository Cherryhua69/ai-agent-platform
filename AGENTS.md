# 项目协作指南

默认全部使用中文回答，包括文档、代码注释、提交说明和测试说明。
使用 superpowers 相关技能时，也必须使用中文回复。

## CodeGraph 语义代码智能工具

本项目已初始化 CodeGraph，本地索引目录为 `.codegraph/`。该目录只保存本机生成的数据库、日志和运行状态，不应提交到 Git。

日常开发中必须充分使用 CodeGraph。涉及代码理解、架构边界、跨模块修改、仓储层、服务层、数据模型、API 边界、前后端契约、模型供应商集成、工作流执行链路或重构时，必须先使用 CodeGraph，再进行文件读取、搜索或修改。

### 使用优先级

1. 理解某个功能、模块、调用链、页面、接口或 bug 时，优先调用：

```text
codegraph_explore("<自然语言问题或相关符号名>")
```

2. 只需要查找某个符号位置时，使用：

```text
codegraph_search("<symbol>")
```

3. 需要查看单个符号完整源码、签名、调用链时，使用：

```text
codegraph_node("<symbol>", includeCode=true)
```

4. 修改前评估调用方、被调用方或影响范围时，使用：

```text
codegraph_callers("<symbol>")
codegraph_callees("<symbol>")
codegraph_impact("<symbol>")
```

5. 查看目录结构或某类文件分布时，使用：

```text
codegraph_files(path="<dir>", pattern="<glob>")
```

6. 怀疑索引不可用、过期或 watcher 异常时，先使用：

```text
codegraph_status()
```

### 必须使用 CodeGraph 的场景

- 修改 `KnowledgeRepository`、`AgentRepository`、`WorkflowRepository`、`AgentRunService` 等仓储层或服务层边界。
- 修改 FastAPI router、Pydantic schema、SQLAlchemy model、数据库迁移或 `Base`。
- 修改前后端契约，例如新增/调整 API 字段、响应结构、hook、domain type。
- 修改模型供应商集成，例如 `LangChainModelClient`、model provider、embedding、rerank、LLM 调用。
- 修改工作流执行、工作流节点、图编译、图校验、运行 Trace 或 Agent Runtime。
- 修改知识库/RAG 链路，包括文档解析、分段、embedding、向量存储、检索、引用、回答生成。
- 删除、重命名、移动文件或符号前，必须先用 `codegraph_impact` 或 `codegraph_callers` 评估影响。
- 对调用关系、依赖关系或“这段代码在哪里被用到”存在不确定时，必须先查 CodeGraph。

### 使用方式约束

- `codegraph_explore` 是理解代码的首选入口。不要先用 `rg`/全文搜索重复做 CodeGraph 已能完成的语义查找。
- 如果 CodeGraph 返回的源码已经覆盖问题，不要再重复读取同一文件；只有在返回结果提示索引过期、内容截断或需要验证刚刚编辑的文件时，才读取文件。
- CodeGraph 索引会有短暂延迟。编辑文件后如果工具提示文件未同步，应读取对应文件确认最新内容，或稍等后检查 `codegraph_status()`。
- CodeGraph 只用于理解和影响分析，不替代 TypeScript、pytest、Vitest、lint、build 等验证命令。
- 如果当前会话没有暴露 CodeGraph 工具，必须在工作说明或最终总结里明确说明“本次无法调用 CodeGraph”，并用 `rg`、文件阅读和测试作为降级方案。

### 推荐工作流

跨模块开发时按以下顺序执行：

1. `codegraph_explore()` 理解现有实现和调用链。
2. 必要时使用 `codegraph_impact()` 评估修改影响。
3. 写测试或调整测试。
4. 修改代码。
5. 运行相关测试、类型检查或构建。
6. 总结时说明 CodeGraph 查询了哪些核心符号或影响范围。

