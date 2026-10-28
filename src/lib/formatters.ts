import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";

export function formatAimingPoint(code?: string | null, targetName?: string): { badge: string; label: string } {
  const normalizedCode = code && code.trim() ? code.trim().toUpperCase() : "MP00";
  const formattedCode = normalizedCode.startsWith("AP") ? normalizedCode.replace("AP", "MP0") : normalizedCode;

  if (formattedCode === "MP00") {
    return {
      badge: "MP00",
      label: DICTIONARY.tasks.allocation.primary_target,
    };
  }

  const name = targetName?.trim();
  return {
    badge: formattedCode,
    label: name ? name : fillTemplate(DICTIONARY.tasks.allocation.aiming_code_label, { code: formattedCode }),
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
