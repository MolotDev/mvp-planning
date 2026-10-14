import { DICTIONARY } from "@/constants/dictionary";

export const TARGET_DISPLAYED_ID_PATTERN = /^GS\d{4}$/;
export const AIMING_POINT_DISPLAYED_ID_PATTERN = /^MP\d{2}$/;
export const MGRS_PATTERN = /^\d{2}\s?[A-Z]{3}\s?\d{2,5}\s?\d{2,5}$/;
const MGRS_COMPACT_PATTERN = /^\d{2}[A-Z]{3}\d{4,10}$/;

export function isValidMgrs(value: string): boolean {
  const trimmed = value.trim();
  if (MGRS_PATTERN.test(trimmed)) {
    return true;
  }
  const compact = trimmed.replace(/\s+/g, "");
  return MGRS_COMPACT_PATTERN.test(compact);
}

export function isValidTargetDisplayedId(value: string): boolean {
  return TARGET_DISPLAYED_ID_PATTERN.test(value.trim());
}

export function isValidAimingPointDisplayedId(value: string): boolean {
  return AIMING_POINT_DISPLAYED_ID_PATTERN.test(value.trim());
}

export function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mgrsError(value: string): string | null {
  if (!value.trim()) {
    return DICTIONARY.targets_catalog.validation.required;
  }
  if (!isValidMgrs(value)) {
    return DICTIONARY.targets_catalog.validation.mgrs;
  }
  return null;
}

export function requiredError(value: string): string | null {
  return value.trim() ? null : DICTIONARY.targets_catalog.validation.required;
}

export function extractNumeric(value: string): string {
  return value.match(/(\d+)/)?.[0] || "";
}
