import { useNavigate } from "react-router-dom";
import { AimingPointWarnings } from "@/components/tasks/AimingPointWarnings";
import { Badge, TargetIdBadgeLink } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ViewReportButtons } from "@/components/reports/ViewReportButton";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { taskAllocation, uavName } from "@/lib/battleGroup";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/mission";
import type { EntityStatus, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import {  DetachmentAssetsBadge } from "../tasks/DetachmentAssets";
import { LaunchProgressBadge } from "../tasks/LaunchProgressBadge";
import { Launch } from "@/types/launch";
import { BattleGroup } from "@/types/battleGroup";
import { fillTemplate, remainingTaskAssets } from "@/lib/battleGroupCapacity";
import { detachmentName } from "@/lib/detachments";
import { getEntityState } from "@/lib/entityState";
import { EntityStatusBadge } from "../ui/entity-status-badge";

export type TaskGroupMode = "target" | "detachment";

interface MissionProgressPanelProps {
  tasks: Task[];
  targets: Target[];
  launches: Launch[];
  battleGroups: BattleGroup[];
  groupMode: TaskGroupMode;
  onGroupModeChange: (mode: TaskGroupMode) => void;
}

function assetBadges(tasks: Task[]) {
  return tasks.flatMap((task) =>
    taskAllocation(task).map((asset, index) => {
      return {
        key: `${task.id}-${asset.asset_id}-${index}`,
        label: `${uavName(asset.asset_id)} × ${asset.quantity}`,
      };
    }),
  );
}

export function MissionProgressPanel({
  tasks,
  targets,
  launches,
  battleGroups,
  groupMode,
  onGroupModeChange,
}: MissionProgressPanelProps) {
  const navigate = useNavigate();
  const isTargetMode = groupMode === "target";
  const groups =
  isTargetMode ? groupByTarget(tasks, targets) : groupByDetachment(tasks, targets);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-lg font-semibold text-primitive-neutral-0">
          {DICTIONARY.tasks.title}:
        </h5>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-primitive-neutral-300">{DICTIONARY.missions.grouped_by}</span>
          <div role="tablist" className="inline-flex rounded-md border border-primitive-neutral-700 p-0.5">
            <GroupTab
              selected={groupMode === "target"}
              onClick={() => onGroupModeChange("target")}
              label={DICTIONARY.missions.group_by_target}
            />
            <GroupTab
              selected={groupMode === "detachment"}
              onClick={() => onGroupModeChange("detachment")}
              label={DICTIONARY.missions.group_by_detachment}
            />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1">
        {groups.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-primitive-red-500">
            {DICTIONARY.missions.no_tasks_assigned}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} className="min-w-0 gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {group.titleBadges}
                </div>
                <div className="flex flex-col gap-1 text-sm text-primitive-neutral-200 mb-2">
                  {group.details}
                </div>
                <AimingPointWarnings tasks={group.tasks} />
                <div className="flex flex-wrap gap-1">
                  {group.assets.map((asset) => (
                    <Badge key={asset.key} className="bg-primitive-neutral-800 text-primitive-neutral-0">
                      {asset.label}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  {group.tasks.map((task) => {
                    const allocation = taskAllocation(task);
                    const remaining = remainingTaskAssets(allocation, battleGroups.filter((group) => group.task_id === task.id));
                    return (
                      <div key={task.id} className="flex flex-col gap-2">
                        {isTargetMode ? <DetachmentAssetsBadge organizationId={task.organization_id} assets={allocation} /> : null}
                        <p className={cn("ml-2 text-xs", !remaining ? "text-primitive-green-500" : "text-primitive-red-500")}>
                          {fillTemplate(DICTIONARY.tasks.unallocated_assets, { quantity: remaining })}
                        </p>
                        <LaunchProgressBadge
                          launches={launches.filter((launch) => task.id === launch.task_id)}
                        />
                        <div className="flex justify-end gap-1">
                          <PreviewActionButton
                            label={DICTIONARY.common.actions.preview_task}
                            onClick={() => navigate(`/planning/tasks/${task.id}`)}
                          />
                        </div>
                        <ViewReportButtons
                          organizationIds={[task.organization_id]}
                          missionId={task.mission_id}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* <p className="text-sm text-primitive-neutral-500">{DICTIONARY.missions.execution_info}</p> */}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupTab({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm hover:cursor-pointer hover:bg-primitive-neutral-850",
        selected ? "bg-primitive-neutral-800 text-primitive-neutral-0" : "text-primitive-neutral-300",
      )}
    >
      {label}
    </button>
  );
}

function groupByTarget(tasks: Task[], targets: Target[]) {
  const map = new Map<string, Task[]>();
  const entityStates = new Map<string, string>();
  tasks.forEach((task) => {
    const targetId = task.target_ids[0] ?? "unknown";
    const list = map.get(targetId) ?? [];
    entityStates.set(targetId, getEntityState(task));
    list.push(task);
    map.set(targetId, list);
  });
  return [...map.entries()].map(([targetId, groupTasks]) => {
    const target = targets.find((item) => item.id === targetId);
    // const detachments = [...new Set(groupTasks.map((task) => task.organization_id))];
    return {
      id: `target-${targetId}`,
      tasks: groupTasks,
      titleBadges: (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <EntityStatusBadge status={(entityStates.get(targetId) ?? "active") as EntityStatus} />
          </div>
          <div className="flex items-center gap-2">
            <TargetIdBadgeLink className="text-md" id={target?.id ?? "-"}>{target?.displayed_id || target?.label || "—"}</TargetIdBadgeLink>
            <Badge className="text-md bg-primitive-neutral-800">{formattingMGRS.spacing(target?.mgrs ?? "—")}</Badge>
          </div>
          <span className="font-medium text-primitive-neutral-0">{target?.name ?? "—"}</span>
        </div>
      ),
      details: [], //detachments.map((name) => <p key={name}>{name}</p>),
      assets: [], //assetBadges(groupTasks),
    };
  });
}

function groupByDetachment(tasks: Task[], targets: Target[]) {
  const map = new Map<string, Task[]>();
  const entityStates = new Map<string, string>();
  tasks.forEach((task) => {
    const list = map.get(task.organization_id) ?? [];
    entityStates.set(task.organization_id, getEntityState(task));
    list.push(task);
    map.set(task.organization_id, list);
  });

  return [...map.entries()].map(([organizationId, groupTasks]) => {
    const groupTargets = targets.filter((target) =>
      groupTasks.some((task) => task.target_ids.includes(target.id)),
    );
    return {
      id: `detachment-${organizationId}`,
      tasks: groupTasks,
      titleBadges: <span className="font-medium text-primitive-neutral-0">{detachmentName(organizationId)}</span>,
      details: groupTargets.map((target) => (
        <div key={target.id}  className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <EntityStatusBadge status={(entityStates.get(organizationId) ?? "active") as EntityStatus} />
          </div>
          <div className="flex items-center gap-2">
            <TargetIdBadgeLink className="text-lg" id={target?.id ?? "—"}>{target?.displayed_id ?? "—"}</TargetIdBadgeLink>
            <Badge className="text-md bg-primitive-neutral-800">{formattingMGRS.spacing(target?.mgrs ?? "—")}</Badge>
          </div>
          <span className="font-medium text-primitive-neutral-0">{target?.name ?? "—"}</span>
        </div>
        // <p key={target.id} className="flex flex-wrap items-center gap-2">
        //   <TargetIdBadge className="text-xs" id={target?.displayed_id ?? "—"}>{target?.displayed_id ?? "—"}</TargetIdBadge>
        //   <span>{target.name}</span>
        //   <Badge className="bg-primitive-neutral-800">{formattingMGRS.spacing(target.mgrs)}</Badge>
        // </p>
      )),
      assets: assetBadges(groupTasks),
    };
  });
}
