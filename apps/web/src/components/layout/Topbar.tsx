export function Topbar() {
  return (
    <header className="topbar">
      <span className="env-chip">
        <span className="env-led" />
        测试环境
      </span>
      <select aria-label="空间" className="env-chip" defaultValue="digital">
        <option value="digital">空间：数字化运营部</option>
      </select>
      <select aria-label="项目" className="env-chip" defaultValue="support">
        <option value="support">项目：客服自动化</option>
      </select>
      <input aria-label="全局搜索" value="搜索 Agent、Flow、Tool、Dataset、Run ID" readOnly />
      <span className="topbar-note">待处理 12</span>
      <span className="topbar-note">发布窗口 18:00</span>
      <span className="avatar">陈</span>
    </header>
  );
}
