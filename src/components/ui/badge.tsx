import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function TargetIdBadgeLink({ className, id: targetId, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <a href={`#/catalogs/targets/${targetId}`} title="Перглянути ціль">
      <Badge className={cn("underline font-semibold text-sky-600 hover:shadow-[0_0_10px_rgba(2,132,199,0.5)]", className || "text-[16px]")} {...props} />
    </a>
  );
}
export function TargetIdBadge({ className, id: targetId, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <Badge className={cn("font-semibold text-sky-600 ", className || "text-[16px]")} {...props} />
  );
}

export function AimingPointIdBadge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <Badge className={cn("font-semibold bg-sky-950", className || "text-[12px]")} {...props} />
  );
}

export function ProgressBadge({label, processed, total }: { label: string, processed: number, total: number }) {
  const status = processed === 0 ? "error" : processed === total ? "success" : "warning";
  const title = processed === 0 ? "Не розподілено між екіпажами" : processed === total ? "Розподілено повністю" : `Розподілено ${processed} / ${total}`;
  return (
    <Badge className="progress-badge" data-status={status} title={title}>
      {label}
    </Badge>
  );
}
