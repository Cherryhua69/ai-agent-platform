import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import type { ViewId } from "../components/layout/SidebarNav";

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      <PageHeader
        title="企业 Agent 工作台"
        description="从 Agent 设计、工作流、知识、工具、评测、发布到审计的一体化入口。"
      />
    </AppShell>
  );
}
