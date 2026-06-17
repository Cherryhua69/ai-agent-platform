type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
