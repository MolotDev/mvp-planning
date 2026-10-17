import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CrosshairIcon, MapPinned } from "lucide-react";

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
export function TargetBadgeLink({ className, id: targetId, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <a href={`#/catalogs/targets/${targetId}`} title="Перглянути ціль">
      <Badge 
        className={cn("min-w-fit tracking-widest text-sky-300 underline underline-offset-2 font-semibold bg-sky-950 hover:shadow-[0_0_10px_rgba(2,132,199,0.5)] hover:bg-primitive-neutral-800",
          className || "text-md")}
        {...props}
      />
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

export function ProgressBadge({label, processed, total, className = "" }: { label: string, processed: number, total: number, className?: string }) {
  const status = processed === 0 ? "error" : processed === total ? "success" : "warning";
  const title = processed === 0 ? "Не опрацьовано" : processed === total ? "Опрацьовано повністю" : `Опрацьовано ${processed} / ${total}`;
  return (
    <Badge className={cn("progress-badge", className)} data-status={status} title={title}>
      {label}
    </Badge>
  );
}

export function AimingPointBadge({label, mgrs, className = "" }: { label: string, mgrs: string, className?: string }) {
  return (
    <div className="flex items-center flex-wrap gap-2" title="Точка прицілювання">
      <CrosshairIcon className="h-4 w-4 text-sky-300/50" />
      <Badge className={cn("font-semibold bg-sky-200/5 text-sky-300 flex items-center gap-1 w-fit tracking-widest", className || "text-[12px]")}>
        {mgrs}
      </Badge>
      {/* <span className="text-sm text-primitive-neutral-300">{`•`}</span> */}
      <span className="text-sm text-primitive-neutral-300">{label}</span>
    </div>
  );
}
export function TargetBadge({targetId, mgrs, label, className = "" }: { targetId: string, mgrs: string, label: string, className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <div className="flex h-6 items-center justify-center">
        <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <TargetBadgeLink className="text-md tracking-widest" id={targetId}>
          {mgrs}
        </TargetBadgeLink>
        <p className="font-medium text-primitive-neutral-0">{label}</p>
      </div>
    </div>
  );
}
