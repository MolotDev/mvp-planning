import { Archive, Crosshair, ShieldCheck } from "lucide-react";
import { DICTIONARY } from "@/constants/dictionary";
import type { TargetMetrics } from "@/store/useTargetStore";

interface MetricCardsProps {
  metrics: TargetMetrics;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const items = [
    {
      id: "total",
      label: DICTIONARY.common.statistics_label.total_quantity,
      value: metrics.total,
      icon: Crosshair,
      color: "text-primitive-blue-500",
    },
    {
      id: "active",
      label: DICTIONARY.common.statistics_label.active_quantity,
      value: metrics.active,
      icon: ShieldCheck,
      color: "text-primitive-green-500",
    },
    {
      id: "archived",
      label: DICTIONARY.common.statistics_label.archived_quantity,
      value: metrics.archived,
      icon: Archive,
      color: "text-primitive-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.id}
            className="relative rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-4 py-3 hover:z-10 hover:shadow-md"
          >
            <div className="flex items-center gap-1 text-sm text-primitive-neutral-300">
              <Icon className={`h-4 w-4 ${item.color}`} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
            <p className="mt-2 text-center text-2xl font-semibold text-primitive-neutral-0">{item.value}</p>
          </article>
        );
      })}
    </div>
  );
}
