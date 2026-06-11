import { SidebarNav, type ViewId } from "./SidebarNav";

type AppShellProps = {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  children?: React.ReactNode;
};

export function AppShell({ activeView, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <SidebarNav activeView={activeView} onNavigate={onNavigate} />
      <main className="main-shell">
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
