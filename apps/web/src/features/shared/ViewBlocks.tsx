import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PageHeader } from "../../components/layout/PageHeader";

gsap.registerPlugin(useGSAP);

type PageScaffoldProps = {
  className?: string;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageScaffold({ className, eyebrow, title, description, actions, children }: PageScaffoldProps) {
  return (
    <article className={className ? `view-page ${className}` : "view-page"}>
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
  visual?: "agent" | "rate" | "publish";
  metricValue?: number;
  metricTotal?: number;
};

type MetricMotionVisualProps = {
  variant: "agent" | "rate" | "publish";
  value: number;
  total?: number;
};

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function MetricMotionVisual({ variant, value, total = 100 }: MetricMotionVisualProps) {
  const scope = useRef<HTMLDivElement>(null);
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const ratio = variant === "rate" ? clampRatio(safeValue / 100) : clampRatio(safeValue / Math.max(total, 1));
  const agentNodes = useMemo(() => Array.from({ length: Math.max(3, Math.min(8, Math.ceil(safeValue) || 3)) }), [safeValue]);
  const publishedSlots = useMemo(() => Array.from({ length: 4 }), []);
  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - ratio);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      if (variant === "rate") {
        const ring = scope.current?.querySelector<SVGCircleElement>(".rate-ring-value");
        if (ring) {
          gsap.to(ring, {
            strokeDashoffset: dashOffset,
            duration: reduceMotion ? 0 : 0.56,
            ease: "power2.out",
            overwrite: "auto"
          });
        }
      }

      if (variant === "agent") {
        const nodes = gsap.utils.toArray<HTMLElement>(".agent-node", scope.current);
        gsap.fromTo(
          nodes,
          { autoAlpha: 0, scale: 0.62, y: 8 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: reduceMotion ? 0 : 0.36,
            ease: "back.out(1.6)",
            stagger: reduceMotion ? 0 : 0.035,
            overwrite: "auto"
          }
        );
        const orbit = scope.current?.querySelector<HTMLElement>(".agent-orbit");
        if (orbit) {
          gsap.to(orbit, {
            rotation: safeValue * 16,
            duration: reduceMotion ? 0 : 0.62,
            ease: "power2.out",
            overwrite: "auto"
          });
        }
      }

      if (variant === "publish") {
        const slots = gsap.utils.toArray<HTMLElement>(".publish-slot", scope.current);
        gsap.to(slots, {
          y: (index) => (index < safeValue ? -7 : 0),
          autoAlpha: (index) => (index < safeValue ? 1 : 0.34),
          scale: (index) => (index < safeValue ? 1 : 0.9),
          duration: reduceMotion ? 0 : 0.32,
          ease: "power2.out",
          stagger: reduceMotion ? 0 : 0.04,
          overwrite: "auto"
        });
        const pulse = scope.current?.querySelector<HTMLElement>(".publish-pulse");
        if (pulse) {
          gsap.fromTo(
            pulse,
            { scale: 0.78, autoAlpha: 0.24 },
            {
              scale: 1 + ratio * 0.18,
              autoAlpha: ratio > 0 ? 0.62 : 0.22,
              duration: reduceMotion ? 0 : 0.44,
              ease: "power2.out",
              overwrite: "auto"
            }
          );
        }
      }
    },
    { dependencies: [dashOffset, ratio, safeValue, variant], scope }
  );

  if (variant === "rate") {
    return (
      <div className="metric-visual metric-visual-rate" ref={scope} aria-hidden="true">
        <svg viewBox="0 0 96 96">
          <circle className="rate-ring-track" cx="48" cy="48" r="38" />
          <circle
            className="rate-ring-value"
            cx="48"
            cy="48"
            r="38"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
          />
        </svg>
        <i />
      </div>
    );
  }

  if (variant === "publish") {
    return (
      <div className="metric-visual metric-visual-publish" ref={scope} aria-hidden="true">
        <b className="publish-pulse" />
        <div className="publish-slots">
          {publishedSlots.map((_, index) => (
            <i className="publish-slot" key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="metric-visual metric-visual-agent" ref={scope} aria-hidden="true">
      <div className="agent-orbit">
        {agentNodes.map((_, index) => (
          <i className="agent-node" key={index} style={{ "--node-angle": `${(360 / agentNodes.length) * index}deg` } as CSSProperties} />
        ))}
      </div>
      <b />
    </div>
  );
}

export function MetricCard({ label, value, detail, tone = "blue", visual = "agent", metricValue = 0, metricTotal }: MetricCardProps) {
  return (
    <section className={`panel metric-card reveal-item ${tone}`}>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      <MetricMotionVisual variant={visual} value={metricValue} total={metricTotal} />
    </section>
  );
}

type PanelProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
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
  children: ReactNode;
  tone?: "ok" | "warn" | "bad" | "info" | "gray";
};

export function StatusPill({ children, tone = "info" }: StatusPillProps) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

type SimpleTableProps = {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  highlightFirstRow?: boolean;
};

export function SimpleTable({ columns, rows, highlightFirstRow = true }: SimpleTableProps) {
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
            <tr key={rowIndex} className={highlightFirstRow && rowIndex === 0 ? "selected" : undefined}>
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

export function KeyValueList({ items }: { items: Array<[string, ReactNode]> }) {
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
