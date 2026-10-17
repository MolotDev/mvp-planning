import { Fragment, useMemo, useState } from "react";
import { ArrowUpRight, Calendar, ChevronDown, MapPinned } from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AssignCrewsModal } from "@/components/tasks/AssignCrewsModal";
import { AllocationConflictBadge } from "@/components/tasks/QuantityDiscrepancy";
import { TaskLaunchRow } from "@/components/tasks/TaskLaunchRow";
import { Modal } from "@/components/ui/modal";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { EditIconButton, GoBackIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { canAccess, canAdminister, homePath, taskInScope } from "@/lib/access";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { isLaunchReadOnly } from "@/lib/launches";
import { filledBoardCount, launchHasBoardIdentity } from "@/lib/missionCascade";
import { matchingReports } from "@/lib/reportAggregation";
import { groupLaunchesByCrew, isLaunchEquipped, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Launch } from "@/types/launch";
import type { Mission, Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

function missionCaption(mission: Mission | undefined, fallback: string): string {
  if (!mission) {
    return fallback;
  }
  const name = mission.name?.trim() || "";
  if (name && mission.label && name !== mission.label) {
    return `${mission.label} — ${name}`;
  }
  return name || mission.label || fallback;
}

function launchAiming(
  launch: Launch,
  task: Task,
  aimingPoints: AimingPoint[],
  targets: Target[],
): { label: string; mgrs: string } {
  const line =
    task.allocations.find((item) => item.id === launch.allocation_line_id) ??
    task.allocations.find((item) => item.asset_id === launch.asset_id);
  const point = line?.aiming_point_id
    ? aimingPoints.find((item) => item.id === line.aiming_point_id && item.archived_at === null)
    : undefined;
  const target = targets.find((item) => item.id === line?.target_id);
  const mgrs = launch.aiming_point_mgrs || point?.mgrs || target?.mgrs || "";
  return {
    label: point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target,
    mgrs: mgrs ? formattingMGRS.spacing(mgrs) : "",
  };
}

interface TargetSummary {
  targetId: string;
  name: string;
  mgrs: string;
  aimingCount: number;
  points: { id: string; name: string; mgrs: string }[];
}

function summarizeTargets(allocations: TaskAllocation[], targets: Target[], aimingPoints: AimingPoint[]): TargetSummary[] {
  const order: string[] = [];
  const grouped = new Map<string, TaskAllocation[]>();
  allocations.forEach((line) => {
    const current = grouped.get(line.target_id);
    if (current) {
      current.push(line);
    } else {
      order.push(line.target_id);
      grouped.set(line.target_id, [line]);
    }
  });
  return order.map((targetId) => {
    const lines = grouped.get(targetId) ?? [];
    const target = targets.find((item) => item.id === targetId);
    const points: TargetSummary["points"] = [];
    const seen = new Set<string>();
    lines.forEach((line) => {
      const key = line.aiming_point_id ?? "primary";
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const point = line.aiming_point_id
        ? aimingPoints.find((item) => item.id === line.aiming_point_id && item.archived_at === null)
        : undefined;
      const mgrs = point?.mgrs || target?.mgrs || "";
      points.push({
        id: key,
        name: point?.name || DICTIONARY.tasks.allocation.primary_target,
        mgrs: mgrs ? formattingMGRS.spacing(mgrs) : "",
      });
    });
    return {
      targetId,
      name: target?.name || targetId,
      mgrs: target?.mgrs ? formattingMGRS.spacing(target.mgrs) : "",
      aimingCount: points.length,
      points,
    };
  });
}

export function TaskPreviewPage() {
  const { taskId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditMode = searchParams.get("isEditMode") === "true";
  const navigate = useNavigate();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const reports = useReportStore((state) => state.reports);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [editingLaunchId, setEditingLaunchId] = useState<string | null>(null);

  if (role === "CREW") {
    return <Navigate to={homePath(role)} replace />;
  }

  if (task && !taskInScope(task, role, entityId)) {
    return <Navigate to={homePath(role)} replace />;
  }

  if (!task) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/tasks")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.tasks.not_found}</h1>
        </div>
      </section>
    );
  }
  const mission = missions.find((item) => item.id === task.allocations[0].mission_id);
  
  if (!mission) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/tasks")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.tasks.not_found}</h1>
        </div>
      </section>
    );
  }

  return (
    <TaskDetails
      task={task}
      missions={missions}
      targets={targets}
      aimingPoints={aimingPoints}
      battleGroups={battleGroups}
      launches={launches}
      reports={reports}
      role={role}
      isEditMode={isEditMode}
      distributionOpen={distributionOpen}
      targetsOpen={targetsOpen}
      editingLaunchId={editingLaunchId}
      onToggleTargets={() => setTargetsOpen((current) => !current)}
      onOpenDistribution={() => setDistributionOpen(true)}
      onCloseDistribution={() => {
        setDistributionOpen(false);
        setSearchParams({}, { replace: true });
      }}
      onEditLaunch={setEditingLaunchId}
      onCloseLaunch={() => setEditingLaunchId(null)}
    />
  );
}

function TaskDetails({
  task,
  missions,
  targets,
  aimingPoints,
  battleGroups,
  launches,
  reports,
  role,
  isEditMode,
  distributionOpen,
  targetsOpen,
  editingLaunchId,
  onToggleTargets,
  onOpenDistribution,
  onCloseDistribution,
  onEditLaunch,
  onCloseLaunch,
}: {
  task: Task;
  missions: Mission[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  battleGroups: ReturnType<typeof useBattleGroupStore.getState>["battleGroups"];
  launches: Launch[];
  reports: ReturnType<typeof useReportStore.getState>["reports"];
  role: ReturnType<typeof useAuthStore.getState>["role"];
  isEditMode: boolean;
  distributionOpen: boolean;
  targetsOpen: boolean;
  editingLaunchId: string | null;
  onToggleTargets: () => void;
  onOpenDistribution: () => void;
  onCloseDistribution: () => void;
  onEditLaunch: (launchId: string) => void;
  onCloseLaunch: () => void;
}) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<Launch | null>(null);
  const text = DICTIONARY.tasks.details;
  const entityState = getEntityState(task);
  const canEditTask = canAdminister(role, "tasks") && entityState === "active";
  const scheduledAt = task.scheduled_at || task.created_at;
  const windowOpen = Boolean(task.scheduled_at) && new Date(task.scheduled_at).getTime() <= Date.now();
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const crewGroups = groupLaunchesByCrew(task, battleGroups, launches);
  const totalPlanned = task.allocations.reduce((sum, line) => sum + line.quantity, 0);
  const totalFullyPrepped = taskLaunches.filter(isLaunchEquipped).length;
  const readinessPercent = totalPlanned === 0 ? 0 : Math.round((totalFullyPrepped / totalPlanned) * 100);
  const missionIds = [...new Set(task.allocations.map((line) => line.mission_id))];
  const report = matchingReports(reports, [task.organization_id], task.scheduled_at)[0];
  const quantityConflicts = task.allocations.flatMap((line) => {
    const filled = filledBoardCount(taskLaunches.filter((launch) => launch.allocation_line_id === line.id));
    return filled > line.quantity ? [{ lineId: line.id, planned: line.quantity, filled }] : [];
  });
  const conflictLineIds = new Set(quantityConflicts.map((item) => item.lineId));
  const targetSummaries = useMemo(
    () => summarizeTargets(task.allocations, targets, aimingPoints),
    [task.allocations, targets, aimingPoints],
  );
  const serialEntries = useMemo<LaunchSerialEntry[]>(() => {
    const entries: LaunchSerialEntry[] = [];
    crewGroups.forEach((group) => {
      group.launches.forEach((launch, index) => {
        entries.push({
          id: launch.id,
          index: index + 1,
          serial: launch.asset_serial_number,
          tracker: launch.tracker_model_serial_number,
          crewName: group.crewId ? crewName(group.crewId) : null,
          crewId: group.crewId ?? null,
        });
      });
    });
    return entries;
  }, [crewGroups]);

  const openReport = () => {
    if (report) {
      navigate(`/reports/${report.id}`);
      return;
    }
    const created = useReportStore.getState().ensureForTask(task.id);
    if (!created) {
      notifyError(DICTIONARY.tasks.no_crews_assigned);
      return;
    }
    navigate(`/reports/${created.id}`);
  };

  const [openLaunches, setOpenLaunches] = useState<Set<string>>(new Set());

  const toggleLaunch = (launchId: string) => {
    setOpenLaunches((current) => {
      const newSet = new Set(current);
      newSet.has(launchId) ? newSet.delete(launchId) : newSet.add(launchId);
      return newSet;
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <GoBackIconButton onClick={() => navigate(-1)} />
            <EntityStatusBadge status={entityState} />
            <h1 className="truncate text-lg font-semibold text-primitive-neutral-0">
              {fillTemplate(text.title, { label: task.label || task.id })}
            </h1>
          </div>
          {role === "CENTER" && report?.status === "submitted" ? (
            <Button variant="ghost" onClick={() => navigate(`/reports/${report.id}`)}>
              {text.view_report}
            </Button>
          ) : null}
          {role === "DETACHMENT" && canAccess(role, "reports") ? (
            <Button
              variant="ghost"
              disabled={!windowOpen || entityState === "archived"}
              title={!windowOpen ? text.report_not_yet : undefined}
              onClick={openReport}
            >
              {text.enter_report}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-col gap-2 flex-1 justify-between h-full">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-primitive-neutral-300" aria-hidden="true" />
              <Badge className="bg-primitive-neutral-800 text-sm text-primitive-neutral-0">{formatDateUk(scheduledAt)}</Badge>
              <div className="flex flex-col gap-2">
                {missionIds.map((missionId) => {
                  const mission = missions.find((item) => item.id === missionId);
                  const caption = missionCaption(mission, missionId);
                  return role === "CENTER" ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/planning/missions/${missionId}`)}
                      title={`Перейти до вогневого завдання ${caption}`}
                      className="group inline-flex items-center gap-1 font-medium text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <span className="underline underline-offset-4 truncate">
                        {mission?.label ?? ""} — {mission?.name ?? ""}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-sky-400/70 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  ) : (
                    <span key={missionId} className="truncate text-md font-medium text-primitive-neutral-300" title={caption}>
                      {caption}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 justify-center">
              {targetSummaries.map((summary) => (
                <span key={summary.targetId} className="inline-flex items-center gap-1 text-sm text-primitive-neutral-0">
                  <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                  <span>{summary.name}</span>
                  <span className="text-primitive-neutral-400">
                    {fillTemplate(text.aiming_count, { count: summary.aimingCount })}
                  </span>
                </span>
              ))}
            </div>
            {targetSummaries.length > 0 ? (
              <Button variant="ghost" className="h-7 rounded-md border border-primitive-neutral-700" aria-expanded={targetsOpen} onClick={onToggleTargets}>
                <ChevronDown className={cn("h-4 w-4 transition-transform", targetsOpen && "rotate-180")} aria-hidden="true" />
                {text.target_details}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <article className="w-full flex justify-between items-center gap-2 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-3 py-2">
              <span className="text-xs text-primitive-neutral-300">{text.kpi_distribution}</span>
              <Badge
                className="progress-badge"
                data-status={taskLaunches.length === totalPlanned && totalPlanned > 0 ? "success" : "warning"}
              >
                {fillTemplate(text.units, { done: taskLaunches.length, total: totalPlanned })}
              </Badge>
              {canEditTask ? (
                <EditIconButton title={text.edit_distribution} onClick={onOpenDistribution} />
              ) : null}
            </article>
            <article className="w-full flex justify-between items-center gap-2 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-3 py-2">
              <span className="text-xs text-primitive-neutral-300">{text.kpi_prep}</span>
              <p className="w-fit flex items-center gap-2">
                <ProgressBadge
                  className="text-sm ml-auto"
                  label={fillTemplate(text.units, { done: totalFullyPrepped, total: taskLaunches.length })}
                  processed={totalFullyPrepped}
                  total={taskLaunches.length}
                />
                <span className="text-sm text-primitive-neutral-200">{fillTemplate(text.percent, { value: readinessPercent })}</span>
              </p>
              {canEditTask ? (
                <div className="w-0 h-0" />
              ) : null}
            </article>
          </div>
        </div>
        {targetsOpen ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-3 py-2">
            {targetSummaries.map((summary) => (
              <div key={summary.targetId} className="flex flex-col gap-2 text-sm">
                <TargetBadge targetId={summary.targetId} mgrs={formattingMGRS.spacing(summary.mgrs)} label={summary.name} />
                <div className="flex flex-col gap-2 border-l border-primitive-neutral-700 bg-primitive-neutral-850/40 py-1 pl-3 pr-2">
                  {summary.points.map((point) => (
                    <AimingPointBadge
                      label={point?.name ?? DICTIONARY.tasks.allocation.primary_target}
                      mgrs={formattingMGRS.spacing(point?.mgrs ?? summary?.mgrs ?? "")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </header>
      {quantityConflicts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {quantityConflicts.map((conflict) => (
            <AllocationConflictBadge key={conflict.lineId} planned={conflict.planned} filled={conflict.filled} />
          ))}
        </div>
      ) : null}
      {crewGroups.length === 0 ? (
        <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.no_crews_assigned}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {crewGroups.map((group) => {
            const seen = new Set<string>();
            const aiming = group.launches.flatMap((launch) => {
              const point = launchAiming(launch, task, aimingPoints, targets);
              const key = `${point.label}|${point.mgrs}`;
              if (seen.has(key)) {
                return [];
              }
              seen.add(key);
              return [point];
            });
            return (
              <details
                key={group.crewId}
                className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4"
              >
                <summary
                 className="flex flex-wrap items-center justify-between gap-2 cursor-pointer list-none rounded-xl bg-primitive-neutral-800 px-3"
                 onClick={() => toggleLaunch(group.crewId)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-primitive-neutral-0">
                      {fillTemplate(text.crew_title, { name: crewName(group.crewId) })}
                    </h2>
                    {group.assets.map((asset) => (
                      <Fragment key={asset.assetId}>  
                        <ProgressBadge
                          className="text-sm ml-auto"
                          label={`${uavName(asset.assetId)} × (${group.readyCount} / ${group.totalCount})`}
                          //{fillTemplate(text.units, { done: totalFullyPrepped, total: taskLaunches.length })}
                          processed={group.readyCount}
                          total={group.totalCount}
                        />
                        {/* <Badge key={asset.assetId} className="bg-primitive-neutral-800 text-primitive-neutral-0">
                          {`${uavName(asset.assetId)} × ${asset.quantity}`}
                        </Badge> */}
                      </Fragment>
                    ))}
                    <div className="ml-6">
                      {aiming.map((point) => (
                        <Fragment key={`${point.label}-${point.mgrs}`}>
                          <AimingPointBadge
                            label={point?.label ?? DICTIONARY.tasks.allocation.primary_target}
                            mgrs={formattingMGRS.spacing(point?.mgrs ?? "")}
                          />
                          {/* <Crosshair className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
                          <span>{point.label}</span>
                          {point.mgrs ? (
                            <Badge className="bg-sky-950/60 font-mono text-sky-400">{point.mgrs}</Badge>
                          ) : null} */}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* <Badge className="progress-badge" data-status={readinessStatus(group.readyCount, group.totalCount)}>
                      {readinessLabel(group.readyCount, group.totalCount)}
                    </Badge> */}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openLaunches.has(group.crewId) && "rotate-180")} aria-hidden="true" />
                  </div>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-primitive-neutral-800 text-xs text-primitive-neutral-400">
                        <th scope="col" className="px-2 py-2 font-medium w-[4%] text-[14px] text-zinc-400">{text.column_index}</th>
                        <th scope="col" className="px-2 py-2 font-medium w-[20%] text-[14px] text-zinc-400">{text.column_trajectory}</th>
                        <th scope="col" className="px-2 py-2 font-medium w-[32%] text-[14px] text-zinc-400">{text.column_serial}</th>
                        <th scope="col" className="px-2 py-2 font-medium w-[32%] text-[14px] text-zinc-400">{text.column_tracker}</th>
                        {canEditTask ? (
                          <th scope="col" className="px-2 py-2 font-medium w-[10%] text-[14px] text-zinc-400">{text.column_actions}</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {group.launches.map((launch, index) => (
                        <TaskLaunchRow
                          key={launch.id}
                          launch={launch}
                          index={index + 1}
                          showActions={canEditTask}
                          locked={isLaunchReadOnly(launch, task, missions.find((item) => item.id === task.allocations.find((line) => line.id === launch.allocation_line_id)?.mission_id))}
                          editing={editingLaunchId === launch.id}
                          entries={serialEntries}
                          onEdit={() => onEditLaunch(launch.id)}
                          onClose={onCloseLaunch}
                          onDelete={
                            canEditTask &&
                            launch.allocation_line_id !== null &&
                            conflictLineIds.has(launch.allocation_line_id) &&
                            launchHasBoardIdentity(launch)
                              ? () => setPendingDelete(launch)
                              : undefined
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {canEditTask && (isEditMode || distributionOpen) ? (
        <AssignCrewsModal taskId={task.id} onClose={onCloseDistribution} />
      ) : null}
      {pendingDelete ? (
        <Modal
          title={DICTIONARY.common.actions.delete}
          confirmLabel={DICTIONARY.common.actions.delete}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const launch = pendingDelete;
            const removed = useLaunchStore.getState().archiveLaunch(launch.id);
            if (!removed) {
              notifyError(DICTIONARY.common.error);
              return;
            }
            const group = useBattleGroupStore.getState().battleGroups.find((item) => item.id === launch.battle_group_id);
            if (group && group.archived_at === null) {
              if (group.uav_quantity <= 1) {
                useBattleGroupStore.getState().archiveBattleGroup(group.id);
              } else {
                const now = new Date().toISOString();
                useBattleGroupStore.setState({
                  battleGroups: useBattleGroupStore.getState().battleGroups.map((item) =>
                    item.id === group.id ? { ...item, uav_quantity: item.uav_quantity - 1, updated_at: now } : item,
                  ),
                });
              }
            }
            notifySuccess(DICTIONARY.launches.toasts.deleted);
            setPendingDelete(null);
          }}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.launches.confirm_delete}</p>
        </Modal>
      ) : null}
    </section>
  );
}
