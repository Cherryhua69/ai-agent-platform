# UI Style Guide

## Direction

The MVP UI is a soft, light, data-console interface. It should feel closer to a calm product dashboard than a traditional dense admin system.

- Use a narrow icon sidebar.
- Do not use a top toolbar.
- Keep the first screen directly usable.
- Prefer soft panels, pastel metric cards, rounded tables, and concise status language.
- Avoid marketing hero sections, old prototype explanations, competitor strategy blocks, and decorative badge piles.

## Navigation

Primary navigation contains eight entries:

1. 总览
2. 智能体
3. 工作流
4. 知识库
5. 工具
6. 运行记录
7. 发布
8. 模板

Removed from the primary navigation:

- 评测观察
- 治理

## Visual Tokens

- Page background: muted blue gray
- Shell: translucent mist blue / white
- Panels: translucent white with soft inset highlight
- Metric cards: low-saturation blue, pink, mint
- Text: dark plum / charcoal
- Muted text: gray violet
- Radius: 18px to 34px
- Shadows: soft, broad, low opacity

## Layout

- Sidebar width is compact and icon-led.
- Main shell uses one rounded container.
- Pages use a single header with title, short description, and optional actions.
- Content should favor one or two strong regions over many small cards.
- Tables are preferred for operational records.
- Cards are reserved for metrics, templates, or compact summaries.

## Components

- Buttons use rounded pill styling.
- Status pills include text and a dot; color is never the only signal.
- Metric cards include a large number and a compact mini-bar visualization.
- Workflow uses a three-zone editor: node palette, canvas, inspector.
- Trace uses a left step list and right detail area.

## Content Rules

- Use clear Chinese product copy.
- Keep dashboard text short.
- Do not expose old Open Design prototype language.
- Do not add competitor comparison content to the main UI.
- Use English only for technical identifiers such as `create_ticket`, `Hybrid + Rerank`, and `Run ID`.

## Accessibility

- Icon-only navigation must have accessible names and titles.
- Focus outlines must remain visible.
- Body text should stay readable on light translucent panels.
- Reduced motion must be respected.
- Mobile layout must avoid page-level horizontal overflow.
