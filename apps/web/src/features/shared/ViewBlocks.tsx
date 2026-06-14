import { PageHeader } from "../../components/layout/PageHeader";

type PageScaffoldProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function PageScaffold({ eyebrow, title, description, actions, children }: PageScaffoldProps) {
  return (
    <article className="view-page">
      <PageHeader title={title} description={description} actions={actions} />
      {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
      <div className="view-stack">{children}</div>
    </article>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "pink" | "mint";
  bars?: number[];
};

export function MetricCard({ label, value, detail, tone = "blue", bars = [42, 68, 52, 84, 72] }: MetricCardProps) {
  return (
    <section className={`panel metric-card reveal-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      <div className="mini-bars" aria-hidden="true">
        {bars.map((height, index) => (
          <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
        ))}
      </div>
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
