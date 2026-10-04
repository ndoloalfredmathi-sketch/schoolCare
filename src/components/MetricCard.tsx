import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import clsx from "clsx";

export type MetricTone = "success" | "info" | "warning" | "error";

const toneClass: Record<MetricTone, string> = {
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: MetricTone;
  delta?: string;
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  delta,
}: MetricCardProps) {
  return (
    <div className="card border border-base-content/10 bg-base-200">
      <div className="card-body gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-base-content/60">{label}</span>

          <span
            className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              toneClass[tone],
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </span>
        </div>

        <div>
          <p className="text-3xl font-bold tracking-tight text-base-content">
            {value}
          </p>
          <p className="mt-1 text-xs text-base-content/50">{detail}</p>
        </div>

        {delta ? (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default MetricCard;
