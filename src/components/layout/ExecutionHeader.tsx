import type { CSSProperties, ReactNode } from "react";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

export interface ExecutionHeaderBadge {
  text: string;
  className?: string;
  style?: CSSProperties;
}

interface ExecutionHeaderProps {
  onBack: () => void;
  badge: ExecutionHeaderBadge;
  title: string;
  titleTitle?: string;
  showCancel?: boolean;
  onCancelClick?: () => void;
  rightActions?: ReactNode;
}

export function ExecutionHeader({
  onBack,
  badge,
  title,
  titleTitle,
  showCancel = false,
  onCancelClick,
  rightActions,
}: ExecutionHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <GoBackIconButton onClick={onBack} />
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium",
            badge.className,
          )}
          style={badge.style}
        >
          {badge.text}
        </span>
        <h1 className="truncate text-lg font-semibold text-primitive-neutral-0" title={titleTitle ?? title}>
          {title}
        </h1>
        {showCancel && onCancelClick ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelClick}
            className="border border-red-700/60 bg-red-950/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-900/40 hover:text-red-300"
          >
            {DICTIONARY.common.actions.cancel_execution}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rightActions}
      </div>
    </header>
  );
}
