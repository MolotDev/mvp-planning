import { DICTIONARY } from "@/constants/dictionary";
import { formatIsoDate, startOfDay } from "@/lib/dates";
import type { Trajectory } from "@/types/report";

export const STAMP_PATTERN = /^(\d{2}):(\d{2})\s(\d{2})\.(\d{2})\.(\d{4})$/;

export function toReportDate(iso: string): string {
  return formatIsoDate(startOfDay(new Date(iso)));
}

export function formatReportDate(reportDate: string): string {
  const [year, month, day] = reportDate.split("-");
  if (!year || !month || !day) {
    return reportDate;
  }
  return `${day}.${month}.${year}`;
}

export function formatStamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${hours}:${minutes} ${day}.${month}.${date.getFullYear()}`;
}

export function formatStampFromIso(iso: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatStamp(date);
}

export function parseStamp(value: string): string | null {
  const match = STAMP_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const day = Number(match[3]);
  const month = Number(match[4]);
  const year = Number(match[5]);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }
  return date.toISOString();
}

export function formatDistance(distance: number): string {
  if (!distance) {
    return "";
  }
  return `${distance} ${DICTIONARY.common.units.km}`;
}

export function parseDistance(value: string): number | null {
  if (!value) {
    return null;
  }
  const distance = Number(value.replace(",", "."));
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }
  return distance;
}

export function formatHeight(trajectory: Pick<Trajectory, "trajectory_height" | "height_above_hot_point">): string | null {
  if (!trajectory.trajectory_height && !trajectory.height_above_hot_point) {
    return null;
  }
  const left = trajectory.trajectory_height.replace(/\s+/g, "");
  const right = trajectory.height_above_hot_point.replace(/\s+/g, "");
  return `${left} / ${right}`;
}

export function parseHeight(value: string): { trajectory_height: string; height_above_hot_point: string } | null {
  const [heights, above] = value.trim().split("/").map((height) => height.trim());
  if (!heights) {
    return null;
  }
  return {
    trajectory_height: heights.split("-").map(Number).join(" - "),
    height_above_hot_point: above.split("-").map(Number).join("-"),
  };
}

export function formatDateInput(iso: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatIsoDate(date);
}

export function formatTimeInput(iso: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Default clock time for new report events and unset launch links. */
export const DEFAULT_LAUNCH_TIME = "00:01";

export type LaunchTimeSortDirection = "asc" | "desc" | "default";

export function nextLaunchTimeSortDirection(current: LaunchTimeSortDirection): LaunchTimeSortDirection {
  if (current === "default") {
    return "asc";
  }
  if (current === "asc") {
    return "desc";
  }
  return "default";
}

/** Display-only sort by launch time (HH:MM). Empty times sink to the end. Does not mutate IDs. */
export function sortLaunchesByLaunchTime<T extends { id: string }>(
  launches: T[],
  launchedAtByLaunchId: Map<string, string> | Record<string, string>,
  sortDir: LaunchTimeSortDirection,
): T[] {
  if (sortDir === "default") {
    return launches;
  }
  const timeOf = (launchId: string): string => {
    const raw =
      launchedAtByLaunchId instanceof Map
        ? (launchedAtByLaunchId.get(launchId) ?? "")
        : (launchedAtByLaunchId[launchId] ?? "");
    return formatTimeInput(raw);
  };
  return [...launches].sort((left, right) => {
    const leftTime = timeOf(left.id);
    const rightTime = timeOf(right.id);
    if (!leftTime && !rightTime) {
      return left.id.localeCompare(right.id);
    }
    if (!leftTime) {
      return 1;
    }
    if (!rightTime) {
      return -1;
    }
    const compare = leftTime.localeCompare(rightTime) || left.id.localeCompare(right.id);
    return sortDir === "asc" ? compare : -compare;
  });
}

export function sanitizeRouteNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function combineDateAndTime(dateValue: string, timeValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return null;
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== (month ?? 1) - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

export function buildEventDescription(assetLabel: string, crew: string, checkpoint: string, comment: string): string {
  const details = [assetLabel, crew, checkpoint, comment].filter((part) => part.trim()).join(" ");
  return `${DICTIONARY.reports.event_prefix} “${details}”`;
}
