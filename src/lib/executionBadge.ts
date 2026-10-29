import { entityStatusBadgeStyle, reportStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { DICTIONARY } from "@/constants/dictionary";
import { getEntityState, isCancellationOutcome } from "@/lib/entityState";
import { isSortieStarted } from "@/lib/reportValidation";
import type { CancellationMetadata, CancellationOutcome } from "@/types/cancellation";
import type { Report } from "@/types/report";
import type { EntityStatus } from "@/types/target";
import type { CSSProperties } from "react";

const CANCELLED_BADGE_STYLE: CSSProperties = {
  color: "#f87171",
  backgroundColor: "rgba(69, 10, 10, 0.7)",
  border: "1px solid rgba(153, 27, 27, 0.6)",
};

const PARTIAL_BADGE_STYLE: CSSProperties = {
  color: "#fbbf24",
  backgroundColor: "rgba(69, 26, 3, 0.7)",
  border: "1px solid rgba(146, 64, 14, 0.6)",
};

export function cancellationBadgeStyle(outcome: CancellationOutcome): CSSProperties {
  if (outcome === "partially_completed") {
    return PARTIAL_BADGE_STYLE;
  }
  return CANCELLED_BADGE_STYLE;
}

export function cancellationBadgeClassName(outcome: CancellationOutcome): string {
  if (outcome === "partially_completed") {
    return "bg-amber-950/70 text-amber-400 border border-amber-800/60 font-medium px-2 py-0.5 rounded-full text-xs";
  }
  return "bg-red-950/70 text-red-400 border border-red-800/60 font-medium px-2 py-0.5 rounded-full text-xs";
}

export function cancellationBadge(
  cancellation: CancellationMetadata | null | undefined,
): { text: string; style: CSSProperties; className: string } | null {
  if (!cancellation) {
    return null;
  }
  return {
    text: DICTIONARY.common.states[cancellation.outcome],
    style: cancellationBadgeStyle(cancellation.outcome),
    className: cancellationBadgeClassName(cancellation.outcome),
  };
}

export function entityExecutionBadge(entity: {
  archived_at: string | null;
  reported_at?: string | null;
  confirmed_at?: string | null;
  cancellation?: CancellationMetadata | null;
}): { text: string; style: CSSProperties; className?: string } {
  const cancelled = cancellationBadge(entity.cancellation);
  if (cancelled) {
    return cancelled;
  }
  const status = getEntityState(entity) as EntityStatus;
  if (isCancellationOutcome(status)) {
    return {
      text: DICTIONARY.common.states[status],
      style: cancellationBadgeStyle(status),
      className: cancellationBadgeClassName(status),
    };
  }
  return {
    text: DICTIONARY.common.states[status],
    style: entityStatusBadgeStyle(status),
  };
}

export function reportDayCancellationOutcome(
  tasks: Array<{ cancellation?: CancellationMetadata | null }>,
): CancellationOutcome | null {
  if (tasks.length === 0) {
    return null;
  }
  if (!tasks.every((task) => task.cancellation?.outcome === "cancelled_before_exit")) {
    return null;
  }
  return "cancelled_before_exit";
}

export function reportExecutionBadge(
  report: Report,
  dayTasks: Array<{ cancellation?: CancellationMetadata | null }> = [],
): { text: string; style: CSSProperties; className?: string } {
  const beforeExit = reportDayCancellationOutcome(dayTasks);
  if (beforeExit) {
    return {
      text: DICTIONARY.common.states.cancelled_before_exit,
      style: cancellationBadgeStyle(beforeExit),
      className: cancellationBadgeClassName(beforeExit),
    };
  }
  if (report.status === "submitted") {
    return { text: DICTIONARY.reports.statuses.submitted, style: reportStatusBadgeStyle("submitted") };
  }
  if (report.status === "archived" || report.archived_at !== null) {
    return { text: DICTIONARY.reports.statuses.archived, style: reportStatusBadgeStyle("archived") };
  }
  if (isSortieStarted(report)) {
    return {
      text: DICTIONARY.reports.statuses.on_sortie,
      style: {
        color: "#f59e0b",
        backgroundColor: "#f59e0b33",
      },
    };
  }
  return { text: DICTIONARY.reports.statuses.draft, style: reportStatusBadgeStyle("draft") };
}
