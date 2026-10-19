import { useMemo, useState } from "react";
import { Minus, Pencil, Plus, Users, X } from "lucide-react";
import { AllocationConflictBadge } from "@/components/tasks/QuantityDiscrepancy";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { crewsForOrganization } from "@/data/crews";
import { crewName, occupiedCrewIds, taskIdsOnOperationalDay, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import {
  getAvailableCrewOptions,
  getCrewAssignedAssetMap,
  getRemaining,
  type CrewAssignmentDraft,
} from "@/lib/crewAllocation";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { filledBoardCount } from "@/lib/missionCascade";
import { crewClearanceAssetIds, parseAllocationQuantity } from "@/lib/taskDashboard";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

interface AllocationWorkspaceProps {
  task: Task;
  targets: Target[];
  aimingPoints: AimingPoint[];
  battleGroups: BattleGroup[];
  launches: Launch[];
  editing: boolean;
  canEdit: boolean;
  drafts: CrewAssignmentDraft[];
  onDraftsChange: (drafts: CrewAssignmentDraft[]) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onHighlightCrew: (crewId: string) => void;
}

function QuantityStepper({
  value,
  max,
  editing,
  onChange,
}: {
  value: number;
  max: number;
  editing: boolean;
  onChange: (next: number) => void;
}) {
  const text = DICTIONARY.tasks.details;
  const allocation = DICTIONARY.tasks.crew_allocation;
  const [raw, setRaw] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setRaw(String(value));
  }

  const commit = (nextRaw: string) => {
    if (nextRaw === "") {
      setRaw("");
      return;
    }
    const parsed = parseAllocationQuantity(nextRaw, max);
    if (parsed === null) {
      const overMax = /^[1-9][0-9]*$/.test(nextRaw) && Number(nextRaw) > max;
      if (overMax) {
        setRaw(String(max));
        if (max !== value) {
          onChange(max);
        }
      }
      return;
    }
    setRaw(nextRaw);
    if (parsed !== value) {
      onChange(parsed);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {editing ? (
        <Button
          variant="ghost"
          className="h-8 w-8 px-0"
          title={allocation.decrease}
          aria-label={allocation.decrease}
          disabled={!editing || value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <div className="h-8 w-8" />
      )}
      <input
        type="text"
        inputMode="numeric"
        pattern="^[1-9][0-9]*$"
        aria-label={text.quantity_label}
        readOnly={!editing}
        value={raw}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setRaw(String(value))}
        className="h-8 w-14 rounded border border-primitive-neutral-700 bg-primitive-neutral-900 px-1 text-center font-mono font-semibold text-primitive-neutral-0 read-only:cursor-default"
      />
      {editing ? (
        <Button
          variant="ghost"
          className="h-8 w-8 px-0"
          title={allocation.increase}
          aria-label={allocation.increase}
          disabled={!editing || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <div className="h-8 w-8" />
      )}
    </div>
  );
}

export function AllocationWorkspace({
  task,
  targets,
  aimingPoints,
  battleGroups,
  launches,
  editing,
  canEdit,
  drafts,
  onDraftsChange,
  onStartEdit,
  onCancel,
  onSave,
  onHighlightCrew,
}: AllocationWorkspaceProps) {
  const text = DICTIONARY.tasks.details;
  const allocationText = DICTIONARY.tasks.crew_allocation;
  const missions = useMissionStore((state) => state.missions);
  const [pickerByAllocation, setPickerByAllocation] = useState<Record<string, string>>({});
  const roster = useMemo(() => crewsForOrganization(task.organization_id), [task.organization_id]);
  const occupiedElsewhere = useMemo(() => {
    const sameDay = taskIdsOnOperationalDay(task.id, useTaskStore.getState().tasks, missions);
    return occupiedCrewIds(
      battleGroups.filter((group) => group.task_id !== task.id),
      undefined,
      sameDay,
    );
  }, [battleGroups, missions, task.id]);

  const allocations = task.allocations;
  const allocationsByTarget = useMemo(() => task.allocations.reduce((acc, allocation) => {
    const target = targets.find((target) => target.id === allocation.target_id);
    if (target) {
      acc[target.id] = [...(acc[target.id] || []), allocation];
    }
    return acc;
  }, {} as Record<string, TaskAllocation[]>), [task, targets]);
  const crewAssetMap = getCrewAssignedAssetMap(drafts, allocations);
  const totalPlanned = allocations.reduce((sum, line) => sum + line.quantity, 0);
  const assignedCount = drafts.reduce((sum, draft) => sum + draft.quantity, 0);
  const unassignedCount = Math.max(0, totalPlanned - assignedCount);
  const assignedCrewIds = new Set(drafts.map((draft) => draft.crewId));
  const freeCrews = roster.filter((crew) => !assignedCrewIds.has(crew.id) && !occupiedElsewhere.has(crew.id));
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const progress = totalPlanned === 0 ? 0 : Math.round((Math.min(assignedCount, totalPlanned) / totalPlanned) * 100);
  const quantityConflicts = allocations.flatMap((line) => {
    const filled = filledBoardCount(taskLaunches.filter((launch) => launch.allocation_line_id === line.id));
    return filled > line.quantity ? [{ lineId: line.id, planned: line.quantity, filled }] : [];
  });

  const updateQuantity = (allocationId: string, crewId: string, next: number) => {
    onDraftsChange(
      drafts.map((draft) =>
        draft.allocationId === allocationId && draft.crewId === crewId ? { ...draft, quantity: next } : draft,
      ),
    );
  };

  const removeCrew = (allocationId: string, crewId: string) => {
    onDraftsChange(drafts.filter((draft) => !(draft.allocationId === allocationId && draft.crewId === crewId)));
  };

  const addCrew = (allocation: TaskAllocation, crewId: string) => {
    if (!crewId) {
      return;
    }
    const remaining = getRemaining(allocation, drafts);
    if (remaining < 1) {
      return;
    }
    onDraftsChange([...drafts, { allocationId: allocation.id, crewId, quantity: remaining }]);
    setPickerByAllocation((current) => ({ ...current, [allocation.id]: "" }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primitive-neutral-0">
          <span>{fillTemplate(text.planned, { count: totalPlanned })}</span>
          <span>{fillTemplate(text.allocated, { count: assignedCount })}</span>
          <span>{fillTemplate(text.remaining_units, { count: unassignedCount })}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-primitive-neutral-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalPlanned}
          aria-valuenow={Math.min(assignedCount, totalPlanned)}
          aria-label={text.kpi_distribution}
        >
          <div className="h-full bg-primitive-blue-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-primitive-neutral-300">
            {fillTemplate(text.free_crews_list, { free: freeCrews.length, total: roster.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {freeCrews.map((crew) => {
              const assets = crewClearanceAssetIds(crew.id, battleGroups).map((id) => uavName(id));
              const label = assets.length
                ? fillTemplate(text.crew_chip, { name: crew.name, assets: assets.join(", ") })
                : crew.name;
              return (
                <button
                  key={crew.id}
                  type="button"
                  title={label}
                  onClick={() => onHighlightCrew(crew.id)}
                  className="rounded border border-emerald-800/40 bg-emerald-950/40 px-2 py-1 text-xs text-emerald-300 hover:cursor-pointer hover:shadow-md"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && !editing ? (
            <Button variant="ghost" className="border border-primitive-neutral-700" onClick={onStartEdit}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {text.allow_edit}
            </Button>
          ) : null}
          {editing ? (
            <>
              <Button variant="ghost" onClick={onCancel}>
                <X className="h-4 w-4" aria-hidden="true" />
                {DICTIONARY.common.actions.cancel}
              </Button>
              <Button onClick={onSave}>
                {DICTIONARY.common.actions.save}
              </Button>
            </>
          ) : null}
        </div>
        {quantityConflicts.map((conflict) => (
          <AllocationConflictBadge key={conflict.lineId} planned={conflict.planned} filled={conflict.filled} />
        ))}
        {Object.entries(allocationsByTarget).map(([targetId, allocations]) => {
          const target = targets.find((target) => target.id === targetId);
          return (
            <article className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center">
                  <TargetBadge
                    targetId={target?.id ?? ""}
                    mgrs={formattingMGRS.spacing(target?.mgrs ?? "")}
                    label={`${target?.name ?? ""}`}
                  />
                  <span className="text-sm text-primitive-neutral-300 ml-6">{` (${target?.address ?? ""})`}</span>
                </div>
              </div>
              {allocations.map((allocation) => {
                // const target = targets.find((item) => item.id === allocation.target_id);
                const aimingPoint = aimingPoints.find((item) => item.id === allocation.aiming_point_id);
                const remaining = Math.max(0, getRemaining(allocation, drafts));
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
                    ? DICTIONARY.tasks.allocation.crew_unassigned
                    : remaining === 0
                      ? allocationText.complete
                      : fillTemplate(allocationText.bucket_remaining, { remaining });
                const pointLabel = aimingPoint?.name ?? target?.name ?? DICTIONARY.tasks.allocation.primary_target;
                const pointMgrs = formattingMGRS.spacing(aimingPoint?.mgrs ?? target?.mgrs ?? "");
                return (
                  <article key={allocation.id} className="flex flex-col gap-3 rounded-lg bg-primitive-neutral-900">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 border-l border-primitive-neutral-700 ml-2 pl-8 last:border-b">
                        <div className="flex flex-wrap items-center justify-between">
                          <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                            <AimingPointBadge label={pointLabel} mgrs={pointMgrs} />
                            <ProgressBadge
                              label={`${uavName(allocation.asset_id)} × ${allocation.quantity}`}
                              processed={assigned}
                              total={allocation.quantity}
                            />
                          </div>
                          <div className="min-w-36 flex items-center justify-end">
                            <Badge className="progress-badge" data-status={status}>
                              {statusLabel}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-l border-primitive-neutral-700 ml-1.5 pl-8 pb-2">
                          {bucketDrafts.map((draft) => {
                            const max = draft.quantity + remaining;
                            return (
                              <div key={draft.crewId} className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-primitive-neutral-0 flex items-center gap-2">
                                  <Users className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                                  {fillTemplate(text.crew_title, { name: crewName(draft.crewId) })}
                                </p>
                                <div className={`flex items-center gap-2 ${editing ? "" : "mr-10"}`}>
                                  <QuantityStepper
                                    value={draft.quantity}
                                    max={max}
                                    editing={editing}
                                    onChange={(next) => updateQuantity(allocation.id, draft.crewId, next)}
                                  />
                                  {editing ? (
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 px-0"
                                      title={allocationText.remove_crew}
                                      aria-label={allocationText.remove_crew}
                                      onClick={() => removeCrew(allocation.id, draft.crewId)}
                                    >
                                      <X className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                          {editing && remaining > 0 ? (
                            <select
                              aria-label={text.assign_crew}
                              value={pickerByAllocation[allocation.id] ?? ""}
                              onChange={(event) => addCrew(allocation, event.target.value)}
                              className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md"
                            >
                              <option value="">{text.assign_crew}</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id} disabled={option.isDisabled}>
                                  {option.isDisabled ? `${option.name} [${option.disabledReason}]` : option.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </article>
          );
        })}
      </section>
    </div>
  );
}
