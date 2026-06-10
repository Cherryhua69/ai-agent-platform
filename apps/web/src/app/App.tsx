import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import type { ViewId } from "../components/layout/SidebarNav";
import { AgentStudioPage } from "../features/agents/AgentStudioPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ObservePage } from "../features/evaluations/ObservePage";
import { GovernancePage } from "../features/governance/GovernancePage";
import { KnowledgePage } from "../features/knowledge/KnowledgePage";
import { MarketplacePage } from "../features/marketplace/MarketplacePage";
import { ReleasePage } from "../features/releases/ReleasePage";
import { StrategyPage } from "../features/strategy/StrategyPage";
import { ToolsPage } from "../features/tools/ToolsPage";
import { WorkflowPage } from "../features/workflows/WorkflowPage";
import { useViewTransition } from "../lib/motion/useViewTransition";

const views: Record<ViewId, React.ReactNode> = {
  dashboard: <DashboardPage />,
  strategy: <StrategyPage />,
  agents: <AgentStudioPage />,
  workflow: <WorkflowPage />,
  knowledge: <KnowledgePage />,
  tools: <ToolsPage />,
  observe: <ObservePage />,
  release: <ReleasePage />,
  market: <MarketplacePage />,
  governance: <GovernancePage />
};

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const viewRef = useViewTransition(activeView);

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      <section ref={viewRef} aria-live="polite">
        {views[activeView]}
      </section>
    </AppShell>
  );
}
