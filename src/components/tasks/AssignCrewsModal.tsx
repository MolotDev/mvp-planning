import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { AimingPointBadge, Badge, ProgressBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { crewsForOrganization } from "@/data/crews";
import { DICTIONARY } from "@/constants/dictionary";
import { occupiedCrewIds, taskIdsOnOperationalDay, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import {
  getAvailableCrewOptions,
  getCrewAssignedAssetMap,
  getRemaining,
  type CrewAssignmentDraft,
} from "@/lib/crewAllocation";
import { formatDateUk } from "@/lib/dates";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Task, TaskAllocation } from "@/types/mission";

interface AssignCrewsModalProps {
  taskId: string;
  onClose: () => void;
}

function draftsFromGroups(task: Task, groups: BattleGroup[]): CrewAssignmentDraft[] {
  const active = groups.filter((group) => group.task_id === task.id && group.archived_at === null);
  const rows: CrewAssignmentDraft[] = [];
  active.forEach((group) => {
    const allocationId =
      group.allocation_line_id && task.allocations.some((line) => line.id === group.allocation_line_id)
        ? group.allocation_line_id
        : task.allocations.find((line) => line.asset_id === group.asset_id)?.id ?? "";
    if (!allocationId) {
      return;
    }
    const existing = rows.find((row) => row.allocationId === allocationId && row.crewId === group.lead_crew_id);
    if (existing) {
      existing.quantity += group.uav_quantity;
      return;
    }
    rows.push({
      allocationId,
      crewId: group.lead_crew_id,
      quantity: group.uav_quantity,
    });
  });
  return rows;
}

export function AssignCrewsModal({ taskId, onClose }: AssignCrewsModalProps) {
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const saveCrewDistribution = useBattleGroupStore((state) => state.saveCrewDistribution);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const [drafts, setDrafts] = useState<CrewAssignmentDraft[]>(() =>
    task ? draftsFromGroups(task, useBattleGroupStore.getState().battleGroups) : [],
  );
  const [pickerByAllocation, setPickerByAllocation] = useState<Record<string, string>>({});

  const roster = useMemo(
    () => (task ? crewsForOrganization(task.organization_id) : []),
    [task],
  );
  const occupiedElsewhere = useMemo(() => {
    if (!task) {
      return new Set<string>();
    }
    const sameDay = taskIdsOnOperationalDay(task.id, useTaskStore.getState().tasks, missions);
    return occupiedCrewIds(
      battleGroups.filter((group) => group.task_id !== task.id),
      undefined,
      sameDay,
    );
  }, [battleGroups, missions, task]);

  if (!task) {
    return null;
  }

  const allocations = task.allocations;
  const crewAssetMap = getCrewAssignedAssetMap(drafts, allocations);
  const totalQuantity = allocations.reduce((sum, line) => sum + line.quantity, 0);
  const unassignedTotal = allocations.reduce((sum, line) => sum + Math.max(0, getRemaining(line, drafts)), 0);
  const complete = unassignedTotal === 0 && totalQuantity > 0;
  const assignedCrewIds = new Set(drafts.map((draft) => draft.crewId));
  const freeCrews = roster.filter((crew) => !assignedCrewIds.has(crew.id) && !occupiedElsewhere.has(crew.id)).length;
  const scheduledAt = task.scheduled_at || task.created_at;

  const updateQuantity = (allocationId: string, crewId: string, next: number) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.allocationId === allocationId && draft.crewId === crewId ? { ...draft, quantity: next } : draft,
      ),
    );
  };

  const removeCrew = (allocationId: string, crewId: string) => {
    setDrafts((current) => current.filter((draft) => !(draft.allocationId === allocationId && draft.crewId === crewId)));
  };

  const addCrew = (allocation: TaskAllocation, crewId: string) => {
    if (!crewId) {
      return;
    }
    const remaining = getRemaining(allocation, drafts);
    if (remaining < 1) {
      return;
    }
    setDrafts((current) => [...current, { allocationId: allocation.id, crewId, quantity: 1 }]);
    setPickerByAllocation((current) => ({ ...current, [allocation.id]: "" }));
  };

  const handleSave = () => {
    const error = saveCrewDistribution(task.id, drafts);
    if (error) {
      notifyError(error);
      return;
    }
    notifySuccess(DICTIONARY.tasks.crew_allocation.saved);
    onClose();
  };

  const label = complete
    ? fillTemplate(DICTIONARY.tasks.crew_allocation.complete_total, { total: totalQuantity })
    : fillTemplate(DICTIONARY.tasks.crew_allocation.remaining_total, {
        remaining: unassignedTotal,
        total: totalQuantity,
      });

  return (
    <Modal
      className="max-w-3xl"
      title={fillTemplate(DICTIONARY.tasks.crew_allocation.title, {
        label: task.label,
        date: formatDateUk(scheduledAt),
      })}
      headerExtra={
        <ProgressBadge
          label={label}
          processed={totalQuantity - unassignedTotal}
          total={totalQuantity}
        />
      }
      footerStart={fillTemplate(DICTIONARY.tasks.crew_allocation.free_crews, {
        free: freeCrews,
        total: roster.length,
      })}
      confirmLabel={DICTIONARY.tasks.crew_allocation.save}
      onClose={onClose}
      onConfirm={handleSave}
    >
      <div className="flex flex-col gap-3">
        {allocations.map((allocation) => {
          const target = targets.find((item) => item.id === allocation.target_id);
          const aimingPoint = aimingPoints.find((item) => item.id === allocation.aiming_point_id);
          const remaining = getRemaining(allocation, drafts);
          const assigned = allocation.quantity - remaining;
          const bucketDrafts = drafts.filter((draft) => draft.allocationId === allocation.id);
          const options = getAvailableCrewOptions(
            roster,
            allocation,
            bucketDrafts.map((draft) => draft.crewId),
            crewAssetMap,
            uavName,
            occupiedElsewhere,
          );
          const status = assigned === 0 ? "error" : remaining === 0 ? "success" : "warning";
          const statusLabel =
            assigned === 0
              ? fillTemplate(DICTIONARY.tasks.crew_allocation.unassigned, { quantity: allocation.quantity })
              : remaining === 0
                ? DICTIONARY.tasks.crew_allocation.complete
                : fillTemplate(DICTIONARY.tasks.crew_allocation.bucket_remaining, { remaining });
          const pointLabel = aimingPoint?.name ?? target?.name ?? DICTIONARY.tasks.allocation.primary_target;
          const pointMgrs = formattingMGRS.spacing(aimingPoint?.mgrs ?? target?.mgrs ?? "");
          return (
            <section key={allocation.id} className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AimingPointBadge label={pointLabel} mgrs={pointMgrs} />
                  <ProgressBadge
                    label={`${uavName(allocation.asset_id)} × ${allocation.quantity}`}
                    processed={assigned}
                    total={allocation.quantity}
                  />
                </div>
                <Badge className="progress-badge" data-status={status}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-end justify-end gap-4">
                <div className="flex flex-col items-end gap-2 w-full">
                  {bucketDrafts.map((draft) => {
                    const crew = roster.find((item) => item.id === draft.crewId);
                    return (
                      <div key={draft.crewId} className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-primitive-neutral-0">{crew?.name ?? draft.crewId}</p>
                        <div className="p-1 flex items-center gap-2 rounded-md border border-primitive-neutral-700">
                          <Button
                            variant="ghost"
                            className="h-5 w-5 px-0 bg-zinc-900"
                            title={DICTIONARY.tasks.crew_allocation.decrease}
                            aria-label={DICTIONARY.tasks.crew_allocation.decrease}
                            disabled={draft.quantity <= 1}
                            onClick={() => updateQuantity(allocation.id, draft.crewId, draft.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <span className="w-8 text-center text-sm text-primitive-neutral-0">{draft.quantity}</span>
                          <Button
                            variant="ghost"
                            className="h-5 w-5 px-0 bg-zinc-900"
                            title={DICTIONARY.tasks.crew_allocation.increase}
                            aria-label={DICTIONARY.tasks.crew_allocation.increase}
                            disabled={remaining <= 0}
                            onClick={() => updateQuantity(allocation.id, draft.crewId, draft.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                          <Button
                            variant="ghost"
                            className="h-7 w-7 px-0 bg-zinc-900"
                            title={DICTIONARY.tasks.crew_allocation.remove_crew}
                            aria-label={DICTIONARY.tasks.crew_allocation.remove_crew}
                            onClick={() => removeCrew(allocation.id, draft.crewId)}
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </Button>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <select
                    disabled={remaining <= 0}
                    aria-label={DICTIONARY.tasks.crew_allocation.add_crew}
                    value={pickerByAllocation[allocation.id] ?? ""}
                    onChange={(event) => addCrew(allocation, event.target.value)}
                    className="h-7 w-40 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer"
                  >
                    <option value="">{DICTIONARY.tasks.crew_allocation.add_crew}</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id} disabled={option.isDisabled}>
                        {option.isDisabled ? `${option.name} [${option.disabledReason}]` : option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
