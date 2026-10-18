import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CrosshairIcon, MapPinned } from "lucide-react";

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
    <a onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} href={`#/catalogs/targets/${targetId}`} title="Перглянути ціль" className="group text-ellipsis whitespace-nowrap flex items-center">
      <Badge 
        className={cn("min-w-fit tracking-widest text-sky-300 underline underline-offset-2 font-semibold bg-sky-950 hover:shadow-[0_0_10px_rgba(2,132,199,0.5)] hover:bg-primitive-neutral-800",
          className || "text-md")}
        {...props}
      />
      <ArrowUpRight className="w-3 h-3 text-sky-400/70 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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

export function ProgressBadge({label, processed, total, className = "" }: { label: string, processed: number, total: number, title?: string, className?: string }) {
  const status = processed === 0 ? "error" : processed === total ? "success" : "warning";
  const title = processed === 0 ? "Не опрацьовано" : processed === total ? "Опрацьовано повністю" : `Опрацьовано ${processed} / ${total}`;
  return (
    <Badge className={cn("progress-badge text-xs", className)} data-status={status} title={title}>
      {label}
    </Badge>
  );
}

export function AimingPointBadge({label, mgrs, className = "" }: { label: string, mgrs: string, className?: string }) {
  return (
    <div className="flex gap-2" title="Точка прицілювання">
      <CrosshairIcon className="h-4 w-4 text-sky-300/50 mt-1" />
      <div className="flex flex-wrap items-center gap-x-1 w-full">
        <Badge className={cn("font-semibold bg-sky-200/5 text-sky-300 flex items-center gap-1 w-fit tracking-widest", className || "text-[12px]")}>
          {mgrs}
        </Badge>
        {/* <span className="text-sm text-primitive-neutral-300">{`•`}</span> */}
        <span className="text-sm text-primitive-neutral-300">{label}</span>
      </div>
    </div>
  );
}
export function TargetBadge({targetId, mgrs, label, wrapperClasses = "", targetClasses = "" }: { targetId: string, mgrs: string, label: string, wrapperClasses?: string, targetClasses?: string }) {
  return (
    <div className={cn("flex items-center gap-2 w-full", wrapperClasses)}>
      <div className="flex h-6 items-center justify-center">
        <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap items-center gap-1 w-full">
        <TargetBadgeLink className={cn("tracking-widest", targetClasses || "text-sm")} id={targetId} title={mgrs}>
          {mgrs}
        </TargetBadgeLink>      
        <p title={label} className="w-fit font-medium text-primitive-neutral-300 overflow-hidden text-ellipsis whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}
