# Frontend UI Engineering Notes

## Scope

The frontend UI is implemented directly in `apps/web`. No new static prototype should be created.

This cleanup focuses on:

- Removing the old static prototype.
- Removing obsolete Open Design references.
- Simplifying primary navigation.
- Replacing broken Chinese copy.
- Preserving the existing React Query, MSW, and API hook flow.
- Restyling the interface toward a soft glass-like dashboard.

## Source Of Truth

Current implementation files are the source of truth:

- `apps/web/src/app/App.tsx`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/SidebarNav.tsx`
- `apps/web/src/features/shared/ViewBlocks.tsx`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/globals.css`

## Removed

- `docs/design/prototypes/ai-agent-management-platform/index.html`
- `docs/design/open-design-prototype.md`
- Topbar UI
- Primary navigation entries for 评测观察 and 治理
- Old garbled copy and prototype-heavy page content

## Kept

- React + Vite + TypeScript
- TanStack Query
- MSW fixtures and handlers
- Mock/real API switch
- Agent creation
- Trial run mutation
- Release Gate rendering
- Trace inspection through the new 运行记录 page

## UI Pattern

Use a compact icon sidebar and one rounded main shell. Keep content blocks few and clear. Metric cards should be soft pastel panels, while operational data should use tables and concise key-value rows.

## Testing

Expected verification commands:

```powershell
corepack pnpm --filter @ai-agent-platform/web test
corepack pnpm --filter @ai-agent-platform/web typecheck
corepack pnpm --filter @ai-agent-platform/web build
```
