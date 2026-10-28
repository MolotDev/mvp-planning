import type { CSSProperties } from "react";
import type { ReportStatus } from "@/types/report";
import { COMPLETED_CONFIRMED, type EntityStatus } from "@/types/target";

const STATUS_COLOR = {
  submitted: "#0091ff",
  draft: "#64ff00",
  archived: "#3a3a3c",
  confirmed: "#0091ff",
} as const;

export function reportStatusBadgeStyle(status: ReportStatus): CSSProperties {
  if (status === "archived") {
    return {
      backgroundColor: STATUS_COLOR.archived,
      color: "#ffffff",
    };
  }
  const color = STATUS_COLOR[status];
  return {
    color,
    backgroundColor: `${color}33`,
  };
}

export function entityStatusBadgeStyle(status: EntityStatus): CSSProperties {
  if (status === "archived") {
    return reportStatusBadgeStyle("archived");
  }
  if (status === COMPLETED_CONFIRMED || status === "reported") {
    return {
      color: STATUS_COLOR.confirmed,
      backgroundColor: `${STATUS_COLOR.confirmed}33`,
    };
  }
  return reportStatusBadgeStyle("draft");
}
