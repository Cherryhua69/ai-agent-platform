# Frontend Pages Inventory

This inventory describes the current React MVP after the UI cleanup. Static prototypes are no longer used as the source of truth.

## Current Primary Views

### 总览

- Purpose: show a compact health snapshot.
- Content: three metric cards, recent runs table, release blockers.
- Removed: large operations dashboard, competitor strategy, extra KPI wall.

### 智能体

- Purpose: create a draft Agent, inspect current Agent assets, and trigger a trial run.
- Content: creation steps, current draft details, Agent asset table.
- Interactions: create draft Agent, trial run, show latest trace summary.

### 工作流

- Purpose: show the MVP workflow editor surface.
- Content: node palette, workflow canvas, inspector.
- Interactions: save and debug buttons remain present for the MVP shell.

### 知识库

- Purpose: manage retrieval assets and indexing status.
- Content: knowledge table and processing pipeline.

### 工具

- Purpose: manage MCP/API tools and health status.
- Content: tool table with credential, permission, health, and last call.

### 运行记录

- Purpose: inspect trace steps for the latest run.
- Content: step list, run facts, JSON trace payload.
- Replaces: the old "评测观察" primary entry.

### 发布

- Purpose: check release channels and gate blockers.
- Content: channel table and release gate reasons.

### 模板

- Purpose: keep a lightweight reusable template entry.
- Content: a small set of reusable Agent/Flow/Knowledge/Tool templates.
- Removed: large marketplace placeholder content.

## Removed Primary Views

- 评测观察
- 治理

Their concerns are not lost:

- Trace diagnostics moved to 运行记录.
- Release blockers remain on 发布.
- Governance and permission details are deferred outside the MVP primary navigation.

## Verification Targets

- Navigation switches between 8 views.
- Topbar is absent.
- Old prototype and Open Design references are absent from the UI.
- Create Agent and trial run interactions still work.
- Release Gate data still renders from API/mock data.
