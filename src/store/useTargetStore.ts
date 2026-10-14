import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEED_AIMING_POINTS, SEED_TARGETS } from "@/data/targetSeed";
import type { AimingPoint, StatusFilter, Target } from "@/types/target";

export const TARGET_STORE_KEY = "military_crm_target_store";

export interface TargetMetrics {
  total: number;
  active: number;
  archived: number;
}

export interface TargetStoreState {
  targets: Target[];
  aimingPoints: AimingPoint[];
  targetSeq: number;
  aimingPointSeq: number;
  createTarget: (
    input: Omit<Target, "id" | "label" | "created_at" | "updated_at" | "archived_at" | "aiming_point_ids">,
  ) => Target;
  updateTarget: (
    id: string,
    input: Omit<Target, "id" | "label" | "created_at" | "updated_at" | "archived_at" | "aiming_point_ids">,
  ) => Target | null;
  archiveTarget: (id: string) => void;
  restoreTarget: (id: string) => void;
  createAimingPoint: (
    targetId: string,
    input: Omit<AimingPoint, "id" | "label" | "target_id" | "created_at" | "updated_at" | "archived_at">,
  ) => AimingPoint | null;
  updateAimingPoint: (
    id: string,
    input: Omit<AimingPoint, "id" | "label" | "target_id" | "created_at" | "updated_at" | "archived_at">,
  ) => AimingPoint | null;
  archiveAimingPoint: (id: string) => void;
  restoreAimingPoint: (id: string) => void;
  nextTargetLabel: () => string;
  nextAimingPointLabel: () => string;
  isTargetDisplayedIdTaken: (displayedId: string, excludeId?: string) => boolean;
  isTargetNameTaken: (name: string, excludeId?: string) => boolean;
  isTargetMgrsTaken: (mgrs: string, excludeId?: string) => boolean;
  isAimingPointDisplayedIdTaken: (targetId: string, displayedId: string, excludeId?: string) => boolean;
  isAimingPointMgrsTaken: (mgrs: string, excludeId?: string) => boolean;
}

function cloneSeedTargets(): Target[] {
  return SEED_TARGETS.map((target) => ({ ...target, aiming_point_ids: [...target.aiming_point_ids] }));
}

function cloneSeedAimingPoints(): AimingPoint[] {
  return SEED_AIMING_POINTS.map((point) => ({ ...point }));
}

export function createInitialTargetState(): Pick<
  TargetStoreState,
  "targets" | "aimingPoints" | "targetSeq" | "aimingPointSeq"
> {
  return {
    targets: cloneSeedTargets(),
    aimingPoints: cloneSeedAimingPoints(),
    targetSeq: SEED_TARGETS.length,
    aimingPointSeq: SEED_AIMING_POINTS.length,
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function matchesQuery(target: Target, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    target.name.toLowerCase().includes(q) ||
    // target.displayed_id.toLowerCase().includes(q) ||
    target.mgrs.toLowerCase().includes(q)
  );
}

function matchesStatus(archivedAt: string | null, filter: StatusFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "archived") {
    return archivedAt !== null;
  }
  return archivedAt === null;
}

export function filterTargets(targets: Target[], query: string, status: StatusFilter): Target[] {
  return targets.filter((target) => matchesQuery(target, query) && matchesStatus(target.archived_at, status));
}

export function getTargetMetrics(targets: Target[]): TargetMetrics {
  return {
    total: targets.length,
    active: targets.filter((target) => target.archived_at === null).length,
    archived: targets.filter((target) => target.archived_at !== null).length,
  };
}

export function getActiveAimingPointCount(aimingPoints: AimingPoint[], targetId: string): number {
  return aimingPoints.filter((point) => point.target_id === targetId && point.archived_at === null).length;
}

export const useTargetStore = create<TargetStoreState>()(
  persist(
    (set, get) => ({
      ...createInitialTargetState(),
      nextTargetLabel: () => `MT${get().targetSeq + 1}`,
      nextAimingPointLabel: () => `AP${get().aimingPointSeq + 1}`,
      isTargetDisplayedIdTaken: (displayedId, excludeId) =>
        get().targets.some(
          (target) => target.displayed_id === displayedId.trim() && target.id !== excludeId,
        ),
      isTargetNameTaken: (name, excludeId) =>
        get().targets.some((target) => target.name.trim() === name.trim() && target.id !== excludeId),
      isTargetMgrsTaken: (mgrs, excludeId) =>
        get().targets.some((target) => target.mgrs.trim() === mgrs.trim() && target.id !== excludeId),
      isAimingPointDisplayedIdTaken: (targetId, _displayedId, excludeId) =>
        get().aimingPoints.some(
          (point) =>
            point.target_id === targetId &&
            // point.displayed_id === displayedId.trim() &&
            point.id !== excludeId,
        ),
      isAimingPointMgrsTaken: (mgrs, excludeId) =>
        get().aimingPoints.some((point) => point.mgrs.trim() === mgrs.trim() && point.id !== excludeId),
      createTarget: (input) => {
        const now = new Date().toISOString();
        const target: Target = {
          ...input,
          id: createId(),
          label: `MT${get().targetSeq + 1}`,
          displayed_id: "", //input.displayed_id.trim(),
          name: input.name.trim(),
          address: input.address.trim(),
          mgrs: input.mgrs.trim(),
          image_url: input.image_url?.trim() ? input.image_url.trim() : null,
          aiming_point_ids: [],
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({
          targets: [target, ...state.targets],
          targetSeq: state.targetSeq + 1,
        }));
        return target;
      },
      updateTarget: (id, input) => {
        const existing = get().targets.find((target) => target.id === id);
        if (!existing) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: Target = {
          ...existing,
          ...input,
          displayed_id: "", //input.displayed_id.trim(),
          name: input.name.trim(),
          address: input.address.trim(),
          mgrs: input.mgrs.trim(),
          image_url: input.image_url?.trim() ? input.image_url.trim() : null,
          updated_at: now,
        };
        set((state) => ({
          targets: state.targets.map((target) => (target.id === id ? updated : target)),
        }));
        return updated;
      },
      archiveTarget: (id) => {
        const archivedAt = new Date().toISOString();
        set((state) => ({
          targets: state.targets.map((target) =>
            target.id === id ? { ...target, archived_at: archivedAt, updated_at: archivedAt } : target,
          ),
          aimingPoints: state.aimingPoints.map((point) =>
            point.target_id === id
              ? { ...point, archived_at: archivedAt, updated_at: archivedAt }
              : point,
          ),
        }));
      },
      restoreTarget: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          targets: state.targets.map((target) =>
            target.id === id ? { ...target, archived_at: null, updated_at: now } : target,
          ),
        }));
      },
      createAimingPoint: (targetId, input) => {
        const parent = get().targets.find((target) => target.id === targetId);
        if (!parent) {
          return null;
        }
        const now = new Date().toISOString();
        const point: AimingPoint = {
          ...input,
          id: createId(),
          target_id: targetId,
          label: `AP${get().aimingPointSeq + 1}`,
          displayed_id: input.displayed_id.trim(),
          name: input.name.trim(),
          mgrs: input.mgrs.trim(),
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({
          aimingPoints: [...state.aimingPoints, point],
          aimingPointSeq: state.aimingPointSeq + 1,
          targets: state.targets.map((target) =>
            target.id === targetId
              ? {
                  ...target,
                  aiming_point_ids: [...target.aiming_point_ids, point.id],
                  updated_at: now,
                }
              : target,
          ),
        }));
        return point;
      },
      updateAimingPoint: (id, input) => {
        const existing = get().aimingPoints.find((point) => point.id === id);
        if (!existing) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: AimingPoint = {
          ...existing,
          ...input,
          displayed_id: input.displayed_id.trim(),
          name: input.name.trim(),
          mgrs: input.mgrs.trim(),
          updated_at: now,
        };
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) => (point.id === id ? updated : point)),
        }));
        return updated;
      },
      archiveAimingPoint: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) =>
            point.id === id ? { ...point, archived_at: now, updated_at: now } : point,
          ),
        }));
      },
      restoreAimingPoint: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) =>
            point.id === id ? { ...point, archived_at: null, updated_at: now } : point,
          ),
        }));
      },
    }),
    {
      name: TARGET_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        targets: state.targets,
        aimingPoints: state.aimingPoints,
        targetSeq: state.targetSeq,
        aimingPointSeq: state.aimingPointSeq,
      }),
    },
  ),
);

export function resetTargetStore() {
  useTargetStore.persist.clearStorage();
  useTargetStore.setState(createInitialTargetState());
}
