import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import type { ViewId } from "../components/layout/SidebarNav";
import type { Agent } from "../types/domain";
import { AgentStudioPage } from "../features/agents/AgentStudioPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { KnowledgePage } from "../features/knowledge/KnowledgePage";
import { MarketplacePage } from "../features/marketplace/MarketplacePage";
import { ReleasePage } from "../features/releases/ReleasePage";
import { RunsPage } from "../features/runs/RunsPage";
import { ToolsPage } from "../features/tools/ToolsPage";
import { WorkflowPage } from "../features/workflows/WorkflowPage";
import { useCanvasConfig } from "../features/workflows/useCanvasConfig";
import { useViewTransition } from "../lib/motion/useViewTransition";

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const configureAgentWorkflow = useCanvasConfig((state) => state.configureAgentWorkflow);
  const viewRef = useViewTransition(activeView);

  function handleConfigureAgent(agent: Agent) {
    configureAgentWorkflow(agent.id, agent.workflowId);
    setActiveView("workflow");
  }

  const views: Record<ViewId, React.ReactNode> = {
    dashboard: <DashboardPage />,
    agents: <AgentStudioPage onConfigureAgent={handleConfigureAgent} />,
    workflow: <WorkflowPage />,
    knowledge: <KnowledgePage />,
    tools: <ToolsPage />,
    runs: <RunsPage />,
    release: <ReleasePage />,
    market: <MarketplacePage />
  };

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      <section ref={viewRef} aria-live="polite" className={`view-host view-host-${activeView}`}>
        {views[activeView]}
      </section>
    </AppShell>
  );
}
