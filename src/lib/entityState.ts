import type { CancellationMetadata, CancellationOutcome } from "@/types/cancellation";
import { COMPLETED_CONFIRMED, type EntityStatus } from "@/types/target";

const CANCELLED_FILTER_OUTCOMES: ReadonlySet<CancellationOutcome> = new Set([
  "cancelled_before_exit",
  "cancelled_without_launches",
]);

type LifecycleEntity = {
  archived_at: string | null;
  reported_at?: string | null;
  confirmed_at?: string | null;
  cancellation?: CancellationMetadata | null;
};

export function isCancellationOutcome(status: string): status is CancellationOutcome {
  return (
    status === "cancelled_before_exit" ||
    status === "cancelled_without_launches" ||
    status === "partially_completed"
  );
}

export function isCancelledFilterStatus(status: EntityStatus): boolean {
  return CANCELLED_FILTER_OUTCOMES.has(status as CancellationOutcome);
}

export function getEntityState(entity: LifecycleEntity): EntityStatus {
  if (entity.cancellation?.outcome) {
    return entity.cancellation.outcome;
  }
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

/** Prefer cancellation → archived → confirmed → reported across a planning chain. */
export function resolvePlanningEntityState(
  ...entities: Array<LifecycleEntity | null | undefined>
): EntityStatus {
  const present = entities.filter((entity): entity is LifecycleEntity => entity != null);
  if (present.length === 0) {
    return "active";
  }
  const cancelled = present.find((entity) => entity.cancellation?.outcome);
  if (cancelled?.cancellation?.outcome) {
    return cancelled.cancellation.outcome;
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
  entity: LifecycleEntity,
  status: EntityStatus | "cancelled" | "all",
): boolean {
  if (status === "all") {
    return true;
  }
  const state = getEntityState(entity);
  if (status === "cancelled") {
    return isCancelledFilterStatus(state);
  }
  if (status === "active") {
    return state === "active";
  }
  if (status === "archived") {
    return state === "archived";
  }
  if (status === "reported") {
    return state === "reported" || state === COMPLETED_CONFIRMED || state === "partially_completed";
  }
  return state === status;
}

export function releasedTaskIdsFromCancellation(
  tasks: Array<{ id: string; cancellation?: CancellationMetadata | null }>,
): Set<string> {
  return new Set(
    tasks
      .filter((task) => task.cancellation?.outcome === "cancelled_before_exit")
      .map((task) => task.id),
  );
}
