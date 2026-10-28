import { PRIMARY_AIMING_POINT, type AimingPointCode } from "@/types/database";
import type { AimingPoint } from "@/types/target";

const MP_CODE = /^MP\d{2}$/i;

export function asAimingCode(value: string | null | undefined): AimingPointCode {
  const trimmed = (value ?? "").trim().toUpperCase();
  return MP_CODE.test(trimmed) ? (trimmed as AimingPointCode) : PRIMARY_AIMING_POINT;
}

export function aimingDigitsFromCode(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 2);
  return digits.padStart(2, "0").slice(-2) || "00";
}

export function aimingCodeFromDigits(digits: string): AimingPointCode {
  const clean = digits.replace(/\D/g, "").slice(0, 2);
  if (clean.length === 0) {
    return PRIMARY_AIMING_POINT;
  }
  if (clean.length === 1) {
    return `MP${clean.padStart(2, "0")}` as AimingPointCode;
  }
  return `MP${clean}` as AimingPointCode;
}

/** Normalize a stored allocation/row aiming ref (UUID or MP code) to MP##. */
export function aimingCodeFromStored(
  stored: string | null | undefined,
  aimingPoints: AimingPoint[] = [],
): AimingPointCode {
  const raw = (stored ?? "").trim();
  if (!raw) {
    return PRIMARY_AIMING_POINT;
  }
  if (MP_CODE.test(raw)) {
    return raw.toUpperCase() as AimingPointCode;
  }
  const point = aimingPoints.find((item) => item.id === raw);
  if (!point) {
    return PRIMARY_AIMING_POINT;
  }
  const fromDisplayed = point.displayed_id.trim().toUpperCase();
  if (MP_CODE.test(fromDisplayed)) {
    return fromDisplayed as AimingPointCode;
  }
  return PRIMARY_AIMING_POINT;
}

export function findAimingPointByRef(
  aimingPoints: AimingPoint[],
  ref: string | null | undefined,
  targetId?: string | null,
): AimingPoint | undefined {
  const raw = (ref ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const byId = aimingPoints.find((point) => point.id === raw && point.archived_at === null);
  if (byId) {
    return byId;
  }
  if (!MP_CODE.test(raw)) {
    return undefined;
  }
  const code = raw.toUpperCase();
  return aimingPoints.find(
    (point) =>
      point.archived_at === null &&
      (!targetId || point.target_id === targetId) &&
      point.displayed_id.trim().toUpperCase() === code,
  );
}
