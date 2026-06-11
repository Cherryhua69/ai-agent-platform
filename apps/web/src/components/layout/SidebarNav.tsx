import { Boxes, BrainCircuit, Gauge, GitBranch, Library, Rocket, ScrollText, Store } from "lucide-react";

export type ViewId = "dashboard" | "agents" | "workflow" | "knowledge" | "tools" | "runs" | "release" | "market";

type NavItem = {
  id: ViewId;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "总览", group: "主控", icon: Gauge },
  { id: "agents", label: "智能体", group: "构建", icon: BrainCircuit },
  { id: "workflow", label: "工作流", group: "构建", icon: GitBranch },
  { id: "knowledge", label: "知识库", group: "构建", icon: Library },
  { id: "tools", label: "工具", group: "构建", icon: Boxes },
  { id: "runs", label: "运行记录", group: "上线", icon: ScrollText },
  { id: "release", label: "发布", group: "上线", icon: Rocket },
  { id: "market", label: "模板", group: "资产", icon: Store }
];

type SidebarNavProps = {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
};

export function SidebarNav({ activeView, onNavigate }: SidebarNavProps) {
  const groups = [...new Set(navItems.map((item) => item.group))];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <strong>AI Agent</strong>
          <span>轻量控制台</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="主导航">
        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <span>{group}</span>
            {navItems
              .filter((item) => item.group === group)
              .map((item, index) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    className={item.id === activeView ? "active" : ""}
                    onClick={() => onNavigate(item.id)}
                    title={item.label}
                    type="button"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={2.15} />
                    </span>
                    <strong>{item.label}</strong>
                    <span className="sr-only">{index + 1}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="sidebar-status">
        <b>今日状态</b>
        <span>阻断 1 项</span>
        <span>工具异常 1 个</span>
      </div>
    </aside>
  );
}
