import { useMemo, useState } from "react";
import { MapPinned, Plus } from "lucide-react";
import { TargetSearchCombobox } from "@/components/missions/TargetSearchCombobox";
import { Button } from "@/components/ui/button";
import { NativeFormSelect } from "@/components/ui/form-select";
import { DeleteIconButton } from "@/components/ui/icon-buttons";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { platoonsForOrganization } from "@/data/crews";
import { uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import {
  assignPlanAimingPoint,
  assignPlanAsset,
  PLATOON_ACTION,
  emptyPlanTarget,
  externalAimingUsage,
  fanOutPlanRow,
  getAvailablePlatoonCrews,
  getCrewAssignedAssets,
  nextForceRow,
  planRowsAsTasks,
  platoonDistributionLabel,
  unassignedTargetQuantity,
  type PlanForceRow,
  type PlanTargetBlock,
} from "@/lib/detachmentPlan";
import { formatStoredAimingPoint } from "@/lib/formatters";
import { notifySuccess } from "@/lib/toasts";
import { extractNumeric } from "@/lib/validation";
import type { Crew } from "@/types/battleGroup";
import type { Task } from "@/types/mission";
import type { Asset } from "@/types/asset";
import type { AimingPoint, Target } from "@/types/target";

const columnClass =
  "grid grid-cols-[minmax(8rem,1.4fr)_minmax(7rem,1fr)_4.5rem_minmax(14rem,1.8fr)_2rem] items-center gap-2";
const controlClass =
  "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

interface DetachmentPlanFormProps {
  blocks: PlanTargetBlock[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  crews: Crew[];
  assets: Asset[];
  tasks: Task[];
  taskId: string;
  organizationId: string;
  onChange: (blocks: PlanTargetBlock[]) => void;
}

export function DetachmentPlanForm({
  blocks,
  catalogTargets,
  aimingPoints,
  crews,
  assets,
  tasks,
  taskId,
  organizationId,
  onChange,
}: DetachmentPlanFormProps) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const replace = (next: PlanTargetBlock) => {
    onChange(blocks.map((block) => (block.key === next.key ? next : block)));
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <TargetBlock
          key={block.key}
          block={block}
          blocks={blocks}
          catalogTargets={catalogTargets}
          aimingPoints={aimingPoints}
          crews={crews}
          assets={assets}
          tasks={tasks}
          taskId={taskId}
          organizationId={organizationId}
          selectedRowKey={selectedRowKey}
          onSelectRow={setSelectedRowKey}
          onChange={replace}
          onRemove={() => onChange(blocks.filter((item) => item.key !== block.key))}
        />
      ))}
      <Button
        className="h-7 bg-sky-900/50 py-1 transition-all duration-300 hover:bg-sky-800/80"
        onClick={() => onChange([...blocks, emptyPlanTarget()])}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {DICTIONARY.missions.add_target}
      </Button>
    </div>
  );
}

function TargetBlock({
  block,
  blocks,
  catalogTargets,
  aimingPoints,
  crews,
  assets,
  tasks,
  taskId,
  organizationId,
  selectedRowKey,
  onSelectRow,
  onChange,
  onRemove,
}: {
  block: PlanTargetBlock;
  blocks: PlanTargetBlock[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  crews: Crew[];
  assets: Asset[];
  tasks: Task[];
  taskId: string;
  organizationId: string;
  selectedRowKey: string | null;
  onSelectRow: (rowKey: string) => void;
  onChange: (block: PlanTargetBlock) => void;
  onRemove: () => void;
}) {
  const text = DICTIONARY.tasks.details;
  const columns = DICTIONARY.tasks.allocation;
  const primaryAiming = formatStoredAimingPoint(null);
  const selectedTarget = catalogTargets.find((target) => target.id === block.targetId);
  const points = useMemo(
    () =>
      aimingPoints.filter((point) => {
        if (point.target_id !== block.targetId) {
          return false;
        }
        return point.archived_at === null || block.rows.some((row) => row.aimingPointId === point.id);
      }),
    [aimingPoints, block.rows, block.targetId],
  );
  const platoons = platoonsForOrganization(organizationId);
  const updateRow = (rowKey: string, patch: Partial<PlanForceRow>) => {
    onChange({
      ...block,
      rows: block.rows.map((item) => (item.key === rowKey ? { ...item, ...patch } : item)),
    });
  };

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-3">
      <div className="flex w-full items-center justify-between gap-2">
        <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
        <TargetSearchCombobox
          id={`target-${block.key}`}
          value={block.targetId}
          targets={catalogTargets}
          onChange={(targetId) =>
            onChange({
              ...block,
              targetId,
              rows: block.rows.map((row) => ({ ...row, aimingPointId: "" })),
            })
          }
        />
        <div className="w-8 min-w-8">
          <DeleteIconButton onClick={onRemove} />
        </div>
      </div>
      {selectedTarget ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[720px] flex-col gap-2">
            <div className={`${columnClass} px-0.5 text-xs text-zinc-600`}>
              <span>{columns.column_tp}</span>
              <span>{columns.column_asset}</span>
              <span>{columns.column_qty}</span>
              <span>{columns.column_assignment}</span>
              <span />
            </div>
            {block.rows.map((row) => {
              const shared =
                selectedRowKey === row.key && row.aimingPointId
                  ? externalAimingUsage(tasks, row.aimingPointId, organizationId, uavName)
                  : [];
              const currentTasks = planRowsAsTasks(blocks, row.key);
              const assignedAssets = getCrewAssignedAssets(currentTasks);
              const quantity = Number(row.quantity) || 0;
              const crewLockedAsset = row.crewId ? assignedAssets.get(row.crewId) ?? "" : "";
              const platoonPlans = platoons.map((platoon) => {
                const total = crews.filter(
                  (crew) => crew.organization_id === organizationId && crew.platoon_id === platoon.id && crew.is_active,
                );
                const free = getAvailablePlatoonCrews(platoon.id, organizationId, crews, currentTasks);
                return {
                  platoon,
                  freeCount: free.length,
                  active: total.length > 0,
                  option: platoonDistributionLabel(platoon.name, free.length, total.length, quantity),
                };
              });
              const everyPlatoonBusy =
                platoonPlans.some((plan) => plan.active) && platoonPlans.every((plan) => !plan.active || plan.freeCount === 0);
              const distribute = (platoonId: string) => {
                const next = fanOutPlanRow(block, row.key, platoonId, organizationId, crews, blocks);
                if (!next) {
                  return;
                }
                onChange(next);
                notifySuccess(columns.distributed_to_platoon);
              };
              const assignCrew = (crewId: string) => {
                const lockedAssetId = assignedAssets.get(crewId) ?? "";
                if (row.assetId && lockedAssetId && lockedAssetId !== row.assetId) {
                  return;
                }
                const crew = crews.find((item) => item.id === crewId);
                onChange({
                  ...block,
                  rows: block.rows.map((item) =>
                    item.key === row.key ? { ...item, crewId, platoonId: crew?.platoon_id ?? "" } : item,
                  ),
                });
              };
              const manualCrews = platoons.flatMap((platoon) =>
                crews
                  .filter(
                    (crew) =>
                      crew.organization_id === organizationId &&
                      crew.platoon_id === platoon.id &&
                      (crew.is_active || crew.id === row.crewId),
                  )
                  .sort((left, right) => left.id.localeCompare(right.id, "uk"))
                  .map((crew) => {
                    const lockedAssetId = assignedAssets.get(crew.id) ?? "";
                    const conflict = Boolean(row.assetId && lockedAssetId && lockedAssetId !== row.assetId);
                    const reason = conflict
                      ? fillTemplate(DICTIONARY.tasks.crew_allocation.locked_asset, {
                          asset:
                            assets.find((asset) => asset.id === lockedAssetId)?.label ||
                            DICTIONARY.tasks.crew_allocation.other_asset,
                        })
                      : "";
                    return {
                      value: crew.id,
                      label: reason ? `${crew.name} [${reason}]` : crew.name,
                      group: platoon.name,
                      disabled: conflict,
                    };
                  }),
              );
              const distributionOptions = platoonPlans.map(({ platoon, option }) => ({
                value: `${PLATOON_ACTION}${platoon.id}`,
                group: columns.group_distribution,
                disabled: option.disabled,
                label: option.label,
              }));
              return (
                <div key={row.key} onClick={() => onSelectRow(row.key)} onFocus={() => onSelectRow(row.key)}>
                  <div className={columnClass}>
                    <NativeFormSelect
                      autoSelect={false}
                      ariaLabel={columns.column_tp}
                      id={`${row.key}-aiming`}
                      value={row.aimingPointId}
                      placeholder={`${primaryAiming.badge} — ${primaryAiming.label}`}
                      options={points
                        .filter((point) => point.archived_at === null || point.id === row.aimingPointId)
                        .map((point) => {
                          const aiming = formatStoredAimingPoint(point);
                          return { value: point.id, label: `${aiming.badge} — ${aiming.label}` };
                        })}
                      onChange={(aimingPointId) => onChange(assignPlanAimingPoint(block, row.key, aimingPointId))}
                      className={controlClass}
                    />
                    <NativeFormSelect
                      autoSelect={false}
                      ariaInvalid={!row.assetId}
                      ariaLabel={columns.column_asset}
                      id={`${row.key}-uav`}
                      value={row.assetId}
                      placeholder={DICTIONARY.tasks.details.select_asset}
                      options={assets
                        .filter((asset) => asset.archived_at === null || asset.id === row.assetId)
                        .map((asset) => ({
                          value: asset.id,
                          label: asset.label,
                          disabled: Boolean(crewLockedAsset && asset.id !== crewLockedAsset),
                        }))}
                      onChange={(assetId) => {
                        if (crewLockedAsset && assetId !== crewLockedAsset) {
                          return;
                        }
                        onChange(assignPlanAsset(block, row.key, assetId));
                      }}
                      className={controlClass}
                    />
                    <Input
                      data-error={!row.quantity}
                      aria-label={columns.column_qty}
                      id={`${row.key}-qty`}
                      pattern="^[1-9][0-9]*$"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: extractNumeric(event.target.value) })}
                      className="h-9 w-full"
                    />
                    <NativeFormSelect
                      autoSelect={false}
                      ariaInvalid={!row.crewId}
                      ariaLabel={columns.column_assignment}
                      id={`${row.key}-assignment`}
                      value={row.crewId}
                      placeholder={columns.assignment_placeholder}
                      options={[...distributionOptions, ...manualCrews]}
                      onChange={(value) => {
                        if (value.startsWith(PLATOON_ACTION)) {
                          distribute(value.slice(PLATOON_ACTION.length));
                          return;
                        }
                        assignCrew(value);
                      }}
                      className={controlClass}
                    />
                    <DeleteIconButton
                      onClick={() => onChange({ ...block, rows: block.rows.filter((item) => item.key !== row.key) })}
                    />
                  </div>
                  {everyPlatoonBusy ? (
                    <p role="status" className="mt-1 text-xs text-primitive-neutral-300">
                      {columns.platoon_crews_busy}
                    </p>
                  ) : null}
                  {shared.map((item) => (
                    <span
                      key={`${item.detachmentId}:${item.droneModel}`}
                      className="mt-1 inline-flex rounded border border-amber-600/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                    >
                      {`⚠️ ${fillTemplate(text.shared_aiming, {
                        detachment: item.detachmentName,
                        count: item.droneCount,
                        model: item.droneModel,
                      })}`}
                    </span>
                  ))}
                </div>
              );
            })}
            <Button
              variant="ghost"
              className="h-7 w-fit py-1"
              onClick={() => {
                const quantity = unassignedTargetQuantity(
                  tasks.find((task) => task.id === taskId),
                  block.targetId,
                  block.rows,
                );
                onChange({ ...block, rows: [...block.rows, nextForceRow(block, "", quantity)] });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {DICTIONARY.missions.add_detachment}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
