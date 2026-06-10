# 开发约定

## 语言

默认使用中文编写产品文档、代码注释和提交说明中的业务描述。

## 前端

- 使用 React、TypeScript、Vite、Tailwind CSS。
- UI 以确认版 Open Design 原型为准。
- 动效使用 GSAP，必须支持 `prefers-reduced-motion`。
- 服务端状态使用 TanStack Query，客户端交互状态使用 Zustand。
- 工作流画布使用 React Flow。

## 后端

- MVP 使用 FastAPI 模块化单体。
- 数据库使用 MySQL，迁移使用 Alembic。
- 所有写操作必须预留审计记录。
- 高风险操作必须预留确认和阻断机制。
