import { COMPLETED_CONFIRMED, type EntityStatus } from "@/types/target";

type LifecycleEntity = {
  archived_at: string | null;
  reported_at?: string | null;
  confirmed_at?: string | null;
};

export function getEntityState(entity: LifecycleEntity): EntityStatus {
  if (entity.archived_at !== null) {
    return "archived";
  }
  if (entity.confirmed_at != null && entity.confirmed_at !== "") {
    return COMPLETED_CONFIRMED;
  }
  if (entity.reported_at != null && entity.reported_at !== "") {
    return "reported";
  }
  return "active";
}

/** Prefer archived → confirmed → reported across a planning chain (mission / task / launch). */
export function resolvePlanningEntityState(
  ...entities: Array<LifecycleEntity | null | undefined>
): EntityStatus {
  const present = entities.filter((entity): entity is LifecycleEntity => entity != null);
  if (present.length === 0) {
    return "active";
  }
  if (present.some((entity) => entity.archived_at !== null)) {
    return "archived";
  }
  if (present.some((entity) => entity.confirmed_at != null && entity.confirmed_at !== "")) {
    return COMPLETED_CONFIRMED;
  }
  if (present.some((entity) => entity.reported_at != null && entity.reported_at !== "")) {
    return "reported";
  }
  return "active";
}

export function matchesEntityStatusFilter(
  entity: {
    archived_at: string | null;
    reported_at?: string | null;
    confirmed_at?: string | null;
  },
  status: EntityStatus | "all",
): boolean {
  if (status === "all") {
    return true;
  }
  const state = getEntityState(entity);
  if (status === "reported") {
    return state === "reported" || state === COMPLETED_CONFIRMED;
  }
  return state === status;
}
