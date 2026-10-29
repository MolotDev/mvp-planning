import { DICTIONARY } from "@/constants/dictionary";
import { asAimingCode, findAimingPointByRef } from "@/lib/aimingPointCode";
import type { AimingPoint } from "@/types/target";

export function formatAimingPoint(code?: string | null, _targetName?: string): { badge: string; label: string } {
  const normalizedCode = code && code.trim() ? code.trim().toUpperCase() : "MP00";
  const formattedCode = normalizedCode.startsWith("AP") ? normalizedCode.replace("AP", "MP0") : normalizedCode;

  if (formattedCode === "MP00") {
    return {
      badge: "MP00",
      label: DICTIONARY.tasks.allocation.primary_target,
    };
  }

  // Non-primary aiming points show only the MP-code badge — no extra name.
  return {
    badge: formattedCode,
    label: "",
  };
}

export function formatStoredAimingPoint(
  point?: { displayed_id?: string | null; label?: string | null; name?: string | null } | null,
  targetName?: string | null,
): { badge: string; label: string } {
  const code = point?.displayed_id?.trim() || point?.label?.trim() || null;
  const name = point?.name?.trim() || targetName?.trim() || undefined;
  return formatAimingPoint(code, name);
}

/** Resolve UUID or MP## allocation ref into badge/label for UI. */
export function formatAimingPointRef(
  ref: string | null | undefined,
  aimingPoints: AimingPoint[],
  targetName?: string | null,
  targetId?: string | null,
): { badge: string; label: string } {
  const point = findAimingPointByRef(aimingPoints, ref, targetId);
  return formatStoredAimingPoint(
    point ?? (ref ? { displayed_id: asAimingCode(ref) } : null),
    targetName,
  );
}
