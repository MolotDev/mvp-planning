import { DICTIONARY } from "@/constants/dictionary";

/** Legacy display pattern kept for callers that still reference the cursorrules mask. */
export const MGRS_PATTERN = /^\d{2}\s?[A-Z]{3}\s?\d{2,5}\s?\d{2,5}$/;

const MGRS_FULL_REGEX = /^([1-5]?[0-9]|60)[A-HJ-NP-Z]{3}(\d{2}|\d{4}|\d{6}|\d{8}|\d{10})$/;

/** Active input mask: Latin (no I/O) + digits only, zone → 3 letters → ≤10 coordinate digits. */
export function sanitizeMGRSInput(raw: string): string {
  const clean = raw
    .toUpperCase()
    .replace(/[^0-9A-HJ-NP-Z]/g, "")
    .slice(0, 15);

  const zoneMatch = clean.match(/^([0-9]{1,2})/);
  if (!zoneMatch) {
    return "";
  }

  let zone = zoneMatch[1];
  if (parseInt(zone, 10) > 60) {
    zone = zone[0];
  }

  const restAfterZone = clean.slice(zone.length);
  const lettersMatch = restAfterZone.match(/^([A-HJ-NP-Z]{0,3})/);
  const letters = lettersMatch ? lettersMatch[1] : "";
  const restAfterLetters = restAfterZone.slice(letters.length);
  const digits = restAfterLetters.replace(/[^0-9]/g, "").slice(0, 10);

  return `${zone}${letters}${digits}`;
}

/** Canonical spaced display: `36U EV 45210 88320`. */
export function formatMGRSDisplay(value: string): string {
  const clean = sanitizeMGRSInput(value);
  const match = clean.match(/^([0-9]{1,2}[A-HJ-NP-Z])([A-HJ-NP-Z]{2})?([0-9]+)?$/);
  if (!match) {
    return clean;
  }

  const [, gzd, square, digits] = match;
  let result = gzd;
  if (square) {
    result += ` ${square}`;
  }
  if (digits) {
    if (digits.length >= 2 && digits.length % 2 === 0) {
      const half = digits.length / 2;
      result += ` ${digits.slice(0, half)} ${digits.slice(half)}`;
    } else {
      result += ` ${digits}`;
    }
  }
  return result;
}

/** Complete MGRS: zone 1–60 + 3 letters + 2/4/6/8/10 coordinate digits. */
export function isMGRSValid(value: string): boolean {
  return MGRS_FULL_REGEX.test(sanitizeMGRSInput(value));
}

export function compactMgrs(value: string): string {
  return sanitizeMGRSInput(value);
}

export function sameMgrs(left: string, right: string): boolean {
  return sanitizeMGRSInput(left) === sanitizeMGRSInput(right);
}

export function parseAndValidateMGRS(input: string): {
  isValid: boolean;
  formatted: string;
  error: string | null;
} {
  const error = mgrsError(input);
  const formatted = input.trim() ? formatMGRSDisplay(input) : "";
  return {
    isValid: error === null,
    formatted,
    error,
  };
}

export function isValidMgrs(value: string): boolean {
  return isMGRSValid(value);
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
    return DICTIONARY.targets_catalog.validation.mgrs_required;
  }
  if (isMGRSValid(value)) {
    return null;
  }
  return DICTIONARY.targets_catalog.validation.mgrs;
}

export function requiredError(value: string): string | null {
  return value.trim() ? null : DICTIONARY.targets_catalog.validation.required;
}

export function extractNumeric(value: string): string {
  return value.match(/(\d+)/)?.[0] || "";
}
