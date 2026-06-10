import { PageHeader } from "../../components/layout/PageHeader";

type PageScaffoldProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function PageScaffold({ eyebrow, title, description, actions, children }: PageScaffoldProps) {
  return (
    <article className="view-page">
      <PageHeader
        title={title}
        description={description}
        actions={
          actions ?? (
            <>
              <button className="btn" type="button">
                导入资产
              </button>
              <button className="btn primary" type="button">
                创建 Agent
              </button>
            </>
          )
        }
      />
      <p className="page-eyebrow">{eyebrow}</p>
      <div className="view-stack">{children}</div>
    </article>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "ok" | "warn" | "bad";
};

export function MetricCard({ label, value, detail, tone = "ok" }: MetricCardProps) {
  return (
    <section className="panel metric-card reveal-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <p className={tone}>{detail}</p>
    </section>
  );
}

type PanelProps = {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
};

export function Panel({ title, meta, children, strong }: PanelProps) {
  return (
    <section className={strong ? "panel panel-strong reveal-item" : "panel reveal-item"}>
      <div className="panel-head">
        <strong>{title}</strong>
        {meta}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

type StatusPillProps = {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "bad" | "info" | "gray";
};

export function StatusPill({ children, tone = "info" }: StatusPillProps) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

type SimpleTableProps = {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
};

export function SimpleTable({ columns, rows }: SimpleTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? "selected" : undefined}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValueList({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="kv-list">
      {items.map(([label, value]) => (
        <div className="kv-row" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}
