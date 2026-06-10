type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <p>AI Agent Platform</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      <div className="page-actions">
        {actions ?? <button type="button">创建 Agent</button>}
      </div>
    </div>
  );
}
