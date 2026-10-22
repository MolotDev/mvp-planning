import type { AccessArea, AccessLevel, AuthRole } from "@/types/auth";
import type { BattleGroup } from "@/types/battleGroup";
import type { Task } from "@/types/mission";
import type { Report } from "@/types/report";

const ACCESS: Record<AuthRole, Record<AccessArea, AccessLevel>> = {
  CENTER: {
    missions: "admin",
    tasks: "view",
    launches: "view",
    reports: "view",
    targets: "admin",
    assets: "deny",
  },
  DETACHMENT: {
    missions: "deny",
    tasks: "admin",
    launches: "view",
    reports: "admin",
    targets: "admin",
    assets: "admin",
  },
  CREW: {
    missions: "deny",
    tasks: "deny",
    launches: "crew-edit",
    reports: "deny",
    targets: "deny",
    assets: "deny",
  },
};

const CREW_LAUNCH_FIELDS = new Set(["trajectory_name", "asset_serial_number", "tracker_model_serial_number", "ammo_model_id", "ammo_quantity"]);

export function accessLevel(role: AuthRole | null, area: AccessArea): AccessLevel {
  if (!role) {
    return "deny";
  }
  return ACCESS[role][area];
}

export function canAccess(role: AuthRole | null, area: AccessArea): boolean {
  return accessLevel(role, area) !== "deny";
}

export function canAdminister(role: AuthRole | null, area: AccessArea): boolean {
  return accessLevel(role, area) === "admin";
}

export function canEditLaunchFields(role: AuthRole | null): boolean {
  return accessLevel(role, "launches") === "crew-edit";
}

export function canEditLaunchField(role: AuthRole | null, field: string): boolean {
  return canEditLaunchFields(role) && CREW_LAUNCH_FIELDS.has(field);
}

export function areaForPath(pathname: string): AccessArea | null {
  if (pathname.startsWith("/planning/missions")) {
    return "missions";
  }
  if (pathname.startsWith("/planning/tasks")) {
    return "tasks";
  }
  if (pathname.startsWith("/planning/launches")) {
    return "launches";
  }
  if (pathname.startsWith("/reports")) {
    return "reports";
  }
  if (pathname.startsWith("/catalogs/targets")) {
    return "targets";
  }
  if (pathname.startsWith("/catalogs/assets") || pathname.startsWith("/catalogs/uav-models")) {
    return "assets";
  }
  return null;
}

export function homePath(role: AuthRole | null): string {
  if (role === "DETACHMENT") {
    return "/planning/tasks";
  }
  if (role === "CREW") {
    return "/planning/launches";
  }
  return "/planning/missions";
}

export function crewOwnsGroup(
  group: Pick<BattleGroup, "lead_crew_id" | "support_crew_ids"> | undefined,
  crewId: string | null,
): boolean {
  if (!group || !crewId) {
    return false;
  }
  return group.lead_crew_id === crewId || group.support_crew_ids.includes(crewId);
}

export function taskInScope(task: Pick<Task, "organization_id">, role: AuthRole | null, entityId: string | null): boolean {
  if (role === "CENTER") {
    return true;
  }
  if (role === "DETACHMENT") {
    return Boolean(entityId) && task.organization_id === entityId;
  }
  return false;
}

export function launchInScope(
  role: AuthRole | null,
  entityId: string | null,
  task: Pick<Task, "organization_id"> | undefined,
  group: Pick<BattleGroup, "lead_crew_id" | "support_crew_ids"> | undefined,
): boolean {
  if (role === "CENTER") {
    return true;
  }
  if (role === "DETACHMENT") {
    return Boolean(task && entityId && task.organization_id === entityId);
  }
  if (role === "CREW") {
    return crewOwnsGroup(group, entityId);
  }
  return false;
}

export function reportInScope(report: Pick<Report, "organization_id">, role: AuthRole | null, entityId: string | null): boolean {
  if (role === "CENTER") {
    return true;
  }
  if (role === "DETACHMENT") {
    return Boolean(entityId) && report.organization_id === entityId;
  }
  return false;
}

export function locksDetachmentFilter(role: AuthRole | null): boolean {
  return role === "DETACHMENT";
}

export function locksCrewFilter(role: AuthRole | null): boolean {
  return role === "CREW";
}

export function hidesDetachmentFilter(role: AuthRole | null): boolean {
  return role !== "CENTER";
}

export function withSessionScope<T extends { organizationId: string; crewId?: string }>(
  filters: T,
  role: AuthRole | null,
  entityId: string | null,
): T {
  if (role === "DETACHMENT" && entityId) {
    return { ...filters, organizationId: entityId };
  }
  if (role === "CREW" && entityId) {
    return {
      ...filters,
      organizationId: "",
      ...("crewId" in filters ? { crewId: entityId } : {}),
    };
  }
  return filters;
}
