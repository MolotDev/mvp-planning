import { Activity, Archive, CheckCircle2, Database } from "lucide-react";
import { DICTIONARY } from "@/constants/dictionary";

export interface HeaderMetricValues {
  total: number;
  completed: number;
  active: number;
  archived: number;
}

const ICON_COLOR = {
  total: "#ffae00",
  completed: "#0091ff",
  active: "#64ff00",
  archived: "#3a3a3c",
} as const;

export function HeaderMetricCards({
  metrics,
  variant = "default",
}: {
  metrics: HeaderMetricValues;
  variant?: "default" | "reports";
}) {
  const labels = DICTIONARY.common.metrics;
  const items = [
    { id: "total", label: labels.total, value: metrics.total, icon: Database, color: ICON_COLOR.total },
    {
      id: "completed",
      label: variant === "reports" ? labels.submitted : labels.completed,
      value: metrics.completed,
      icon: CheckCircle2,
      color: ICON_COLOR.completed,
    },
    {
      id: "active",
      label: variant === "reports" ? labels.draft : labels.active,
      value: metrics.active,
      icon: Activity,
      color: ICON_COLOR.active,
    },
    {
      id: "archived",
      label: labels.archived,
      value: metrics.archived,
      icon: Archive,
      color: ICON_COLOR.archived,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.id}
            className="relative rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-4 py-3 hover:z-10 hover:shadow-md"
          >
            <div className="flex items-center gap-1 text-sm text-primitive-neutral-300">
              <Icon className="h-4 w-4" style={{ color: item.color }} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
            <p className="mt-2 text-center text-2xl font-semibold text-primitive-neutral-0">{item.value}</p>
          </article>
        );
      })}
    </div>
  );
}
