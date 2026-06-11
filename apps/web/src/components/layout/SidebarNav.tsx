import {
  Boxes,
  BrainCircuit,
  Gauge,
  GitBranch,
  Landmark,
  Library,
  Rocket,
  Settings,
  Store
} from "lucide-react";

export type ViewId =
  | "dashboard"
  | "agents"
  | "workflow"
  | "knowledge"
  | "tools"
  | "observe"
  | "release"
  | "market"
  | "governance";

type NavItem = {
  id: ViewId;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "工作台", group: "总览", icon: Gauge },
  { id: "agents", label: "Agent Studio", group: "构建", icon: BrainCircuit },
  { id: "workflow", label: "工作流", group: "构建", icon: GitBranch },
  { id: "knowledge", label: "知识库", group: "构建", icon: Library },
  { id: "tools", label: "工具与 MCP", group: "构建", icon: Boxes },
  { id: "observe", label: "评测与观测", group: "上线", icon: Landmark },
  { id: "release", label: "发布渠道", group: "上线", icon: Rocket },
  { id: "market", label: "模板市场", group: "资产", icon: Store },
  { id: "governance", label: "治理设置", group: "资产", icon: Settings }
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
        <span className="brand-mark">A</span>
        <div>
          <strong>AI Agent Platform</strong>
          <span>企业 Agent 控制台</span>
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
                    type="button"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <Icon size={15} strokeWidth={2.2} />
                    </span>
                    <span>{String(navItems.indexOf(item) + 1).padStart(2, "0")}</span>
                    <strong>{item.label}</strong>
                    <span className="sr-only">{index + 1}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="sidebar-status">
        <b>生产健康</b>
        <span>Agent 可用 14/16</span>
        <span>工具异常 1 个</span>
        <span>发布阻断 5 项</span>
      </div>
    </aside>
  );
}
