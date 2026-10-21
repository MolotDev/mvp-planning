import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Info, PanelRightOpen } from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AllocationWorkspace } from "@/components/tasks/AllocationWorkspace";
import { CrewStatsDrawer } from "@/components/tasks/CrewStatsDrawer";
import { LaunchDetailsModal, type LaunchAimingSection } from "@/components/tasks/LaunchDetailsModal";
import { LaunchSummaryCards } from "@/components/tasks/LaunchSummaryCards";
import { TaskInfoDrawer } from "@/components/tasks/TaskInfoDrawer";
import { Button } from "@/components/ui/button";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { crewsForOrganization } from "@/data/crews";
import { canAccess, canAdminister, homePath, taskInScope } from "@/lib/access";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import { formatDateUk, isBeforeToday, parseIsoDate, startOfDay } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { resolveLaunchAimingPoint } from "@/lib/launchAiming";
import { isLaunchReadOnly } from "@/lib/launches";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { matchingReports } from "@/lib/reportAggregation";
import { groupLaunchesByCrew, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
import { draftsFromGroups } from "@/lib/taskDashboard";
import {
  allocationsFromBlocks,
  crewDraftsFromBlocks,
  emptyPlanTarget,
  isPlanReady,
  planBlocksFromTask,
  type PlanTargetBlock,
} from "@/lib/detachmentPlan";
import { splitTasksByTarget } from "@/lib/taskView";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Task } from "@/types/mission";

interface LaunchSelection {
  crewId: string;
  assetId: string;
}

export function TaskPreviewPage() {
  const { taskId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTargetId = searchParams.get("targetId") ?? "";
  const navigate = useNavigate();
  const storedTask = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const reports = useReportStore((state) => state.reports);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const creating = taskId === "new";
  const requestedDay = searchParams.get("date") ?? "";
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? parseIsoDate(requestedDay) : null;
  const createDate =
    requestedDate && !Number.isNaN(requestedDate.getTime()) ? startOfDay(requestedDate) : null;
  const canCreate =
    creating && role === "DETACHMENT" && Boolean(entityId) && createDate !== null && !isBeforeToday(createDate);
  const draftTask = useMemo<Task | undefined>(() => {
    if (!canCreate || !createDate || !entityId) {
      return undefined;
    }
    const now = new Date().toISOString();
    return {
      id: "new",
      label: "",
      organization_id: entityId,
      mission_id: null,
      source: "detachment",
      scheduled_at: createDate.toISOString(),
      allocations: [],
      battle_groups_ids: [],
      fact_submitted_at: null,
      fact_notes: null,
      created_at: now,
      updated_at: now,
      reported_at: null,
      archived_at: null,
    };
  }, [canCreate, createDate, entityId]);
  const task = creating ? draftTask : storedTask;
  const storedDrafts = useMemo(
    () => (storedTask ? draftsFromGroups(storedTask, battleGroups) : []),
    [battleGroups, storedTask],
  );
  const [editing, setEditing] = useState(taskId === "new");
  const [plan, setPlan] = useState<PlanTargetBlock[]>(taskId === "new" ? [emptyPlanTarget()] : []);
  const [routeDrafts, setRouteDrafts] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<CrewAssignmentDraft[]>(storedDrafts);
  const [infoOpen, setInfoOpen] = useState(false);
  const [highlightedCrewId, setHighlightedCrewId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [launchSelection, setLaunchSelection] = useState<LaunchSelection | null>(null);

  useEffect(() => {
    if (!editing) {
      setDrafts(storedDrafts);
    }
  }, [editing, storedDrafts]);

  useEffect(() => {
    if (taskId === "new") {
      setEditing(true);
      setInfoOpen(false);
      setLaunchSelection(null);
      setHighlightedCrewId(null);
      setStatsOpen(false);
      setRouteDrafts({});
      setPlan((current) => (current.length > 0 ? current : [emptyPlanTarget()]));
      return;
    }
    const startEditing = searchParams.get("edit") === "1";
    const current = useTaskStore.getState().tasks.find((item) => item.id === taskId);
    setEditing(startEditing);
    setInfoOpen(false);
    setLaunchSelection(null);
    setHighlightedCrewId(null);
    setStatsOpen(false);
    setRouteDrafts({});
    if (startEditing && current?.source === "detachment") {
      const next = planBlocksFromTask(current, useBattleGroupStore.getState().battleGroups);
      setPlan(next.length > 0 ? next : [emptyPlanTarget()]);
    } else {
      setPlan([]);
    }
  }, [searchParams, taskId]);

  if (role === "CREW") {
    return <Navigate to={homePath(role)} replace />;
  }

  if (creating && !canCreate) {
    return <Navigate to="/planning/tasks" replace />;
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

  const missionId = task.allocations[0]?.mission_id || task.mission_id;
  const mission = creating ? undefined : missions.find((item) => item.id === missionId);
  if (!creating && !mission) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/tasks")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.tasks.not_found}</h1>
        </div>
      </section>
    );
  }

  const text = DICTIONARY.tasks.details;
  const entityState = getEntityState(task);
  const canEdit = role === "DETACHMENT" && canAdminister(role, "tasks") && entityState === "active";
  const scheduledAt = task.scheduled_at || task.created_at;
  const focused = Boolean(focusTargetId) && !editing;
  const displayTask = focused
    ? { ...task, allocations: task.allocations.filter((line) => line.target_id === focusTargetId) }
    : task;
  const workspaceTask =
    editing && task.source === "detachment"
      ? { ...displayTask, allocations: allocationsFromBlocks(plan, mission?.id ?? "") }
      : displayTask;
  const focusedLineIds = new Set(displayTask.allocations.map((line) => line.id));
  const displayGroups = focused
    ? battleGroups.filter((group) => group.allocation_line_id !== null && focusedLineIds.has(group.allocation_line_id))
    : battleGroups;
  const focusCard = focusTargetId
    ? splitTasksByTarget([task], missions, targets).find((card) => card.targetId === focusTargetId)
    : undefined;
  const headingLabel = focusCard?.label || task.label || task.id;
  const windowOpen = Boolean(task.scheduled_at) && new Date(task.scheduled_at).getTime() <= Date.now();
  const report = matchingReports(reports, [task.organization_id], task.scheduled_at)[0];
  const roster = crewsForOrganization(task.organization_id);
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const crewGroups = groupLaunchesByCrew(displayTask, displayGroups, launches);
  const serialEntries: LaunchSerialEntry[] = crewGroups.flatMap((group) =>
    group.launches.map((launch, index) => ({
      id: launch.id,
      index: index + 1,
      serial: launch.asset_serial_number,
      tracker: launch.tracker_model_serial_number,
      crewName: group.crewId ? crewName(group.crewId) : null,
      crewId: group.crewId ?? null,
    })),
  );

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

  const saveAllocation = () => {
    const crewDrafts = task.source === "detachment" ? crewDraftsFromBlocks(plan) : drafts;
    if (creating) {
      if (!createDate || !entityId || isBeforeToday(createDate)) {
        notifyError(DICTIONARY.missions.toasts.date_error);
        return;
      }
      const scheduledAt = createDate.toISOString();
      const dailyMission = useMissionStore.getState().ensureDailyMission(scheduledAt);
      const created = dailyMission
        ? useTaskStore.getState().createDetachmentTask({
            missionId: dailyMission.id,
            organizationId: entityId,
            scheduledAt,
          })
        : null;
      if (!dailyMission || !created) {
        notifyError(DICTIONARY.missions.toasts.date_error);
        return;
      }
      useMissionStore.getState().linkTask(dailyMission.id, created.id);
      const planError = useTaskStore.getState().saveDetachmentPlan(created.id, plan);
      if (planError) {
        notifyError(planError);
        navigate(`/planning/tasks/${created.id}?edit=1`, { replace: true });
        return;
      }
      const distributionError = useBattleGroupStore.getState().saveCrewDistribution(created.id, crewDrafts);
      if (distributionError) {
        notifyError(distributionError);
        navigate(`/planning/tasks/${created.id}?edit=1`, { replace: true });
        return;
      }
      notifySuccess(DICTIONARY.tasks.toasts.request_saved);
      navigate(`/planning/tasks/${created.id}`, { replace: true });
      return;
    }
    if (task.source === "detachment") {
      const planError = useTaskStore.getState().saveDetachmentPlan(task.id, plan);
      if (planError) {
        notifyError(planError);
        return;
      }
    }
    const error = useBattleGroupStore.getState().saveCrewDistribution(task.id, crewDrafts);
    if (error) {
      notifyError(error);
      return;
    }
    Object.entries(routeDrafts).forEach(([launchId, value]) => {
      useLaunchStore.getState().updateLaunch(launchId, { trajectory_name: value.trim() ? value.trim() : null });
    });
    notifySuccess(task.source === "detachment" ? DICTIONARY.tasks.toasts.request_saved : DICTIONARY.tasks.crew_allocation.saved);
    setEditing(false);
    if (searchParams.get("edit") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  };

  const selectedGroups = launchSelection
    ? displayGroups.filter(
        (group) =>
          group.archived_at === null &&
          group.task_id === task.id &&
          group.lead_crew_id === launchSelection.crewId &&
          group.asset_id === launchSelection.assetId,
      )
    : [];
  const selectedGroupIds = new Set(selectedGroups.map((group) => group.id));
  const selectedLaunches = launchSelection
    ? taskLaunches.filter((launch) => selectedGroupIds.has(launch.battle_group_id))
    : [];
  const plannedQuantity = selectedGroups.reduce((sum, group) => sum + group.uav_quantity, 0);
  const sectionMap = new Map<string, LaunchAimingSection>();
  selectedLaunches.forEach((launch) => {
    const owner = battleGroups.find((item) => item.id === launch.battle_group_id);
    const point = resolveLaunchAimingPoint(task, launch, owner, aimingPoints);
    const line = task.allocations.find((item) => item.id === (launch.allocation_line_id ?? owner?.allocation_line_id));
    const target = targets.find((item) => item.id === line?.target_id);
    const id = point?.id ?? line?.target_id ?? "target";
    const section = sectionMap.get(id) ?? {
      id,
      label: point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target,
      mgrs: point?.label || formattingMGRS.spacing(target?.mgrs || ""),
      launchIds: [],
    };
    section.launchIds.push(launch.id);
    sectionMap.set(id, section);
  });
  const launchSections = [...sectionMap.values()].sort((left, right) => left.label.localeCompare(right.label, "uk"));
  const selectedTargetNames = [
    ...new Set(
      selectedGroups
        .map((group) => task.allocations.find((line) => line.id === group.allocation_line_id)?.target_id)
        .map((id) => targets.find((item) => item.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const lockedIds = new Set(
    selectedLaunches
      .filter((launch) =>
        isLaunchReadOnly(
          launch,
          task,
          missions.find((item) => item.id === task.allocations.find((line) => line.id === launch.allocation_line_id)?.mission_id),
        ),
      )
      .map((launch) => launch.id),
  );

  const highlightCrew = (crewId: string) => {
    setHighlightedCrewId(crewId);
    setStatsOpen(true);
    queueMicrotask(() => document.getElementById(`crew-load-${crewId}`)?.scrollIntoView({ block: "nearest" }));
  };

  return (
    <>
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GoBackIconButton onClick={() => navigate(-1)} />
            {creating ? null : <EntityStatusBadge status={entityState} />}
            <h1 className="truncate text-lg font-semibold text-primitive-neutral-0">
              {creating
                ? fillTemplate(text.create_title, { date: formatDateUk(scheduledAt) })
                : fillTemplate(text.title_dated, { label: headingLabel, date: formatDateUk(scheduledAt) })}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!creating && role === "CENTER" && report?.status === "submitted" ? (
              <Button variant="ghost" onClick={() => navigate(`/reports/${report.id}`)}>
                {text.view_report}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            {!creating && role === "DETACHMENT" && canAccess(role, "reports") ? (
              <Button
                variant="ghost"
                disabled={!windowOpen || entityState === "archived"}
                title={!windowOpen ? text.report_not_yet : undefined}
                onClick={openReport}
              >
                {text.enter_report}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="flex h-full w-[65%] flex-col gap-4 overflow-y-auto pr-2">
            <AllocationWorkspace
              task={workspaceTask}
              targets={targets}
              aimingPoints={aimingPoints}
              battleGroups={displayGroups}
              launches={launches}
              editing={editing && canEdit}
              canEdit={canEdit}
              canSave={(creating || task.source === "detachment") ? isPlanReady(plan) : true}
              plan={plan}
              onPlanChange={setPlan}
              drafts={drafts}
              onDraftsChange={setDrafts}
              onStartEdit={() => {
                if (task.source === "detachment") {
                  const next = planBlocksFromTask(task, battleGroups);
                  setPlan(next.length > 0 ? next : [emptyPlanTarget()]);
                }
                const routes: Record<string, string> = {};
                launches
                  .filter((launch) => launch.archived_at === null && launch.task_id === task.id)
                  .forEach((launch) => {
                    routes[launch.id] = launch.trajectory_name ?? "";
                  });
                setRouteDrafts(routes);
                setDrafts(storedDrafts);
                setEditing(true);
              }}
              onCancel={() => {
                if (creating) {
                  navigate("/planning/tasks");
                  return;
                }
                setDrafts(storedDrafts);
                setEditing(false);
                setRouteDrafts({});
                if (searchParams.get("edit") === "1") {
                  const next = new URLSearchParams(searchParams);
                  next.delete("edit");
                  setSearchParams(next, { replace: true });
                }
              }}
              onSave={saveAllocation}
              onHighlightCrew={highlightCrew}
            />
          </div>
          <div className="relative flex h-full w-[35%] flex-col overflow-hidden bg-primitive-neutral-900/40">
            <div className="flex h-full flex-col gap-4 overflow-y-auto pl-2">
              <Button
                variant="ghost"
                className="min-h-10 h-10 w-full justify-between border border-primitive-neutral-700 bg-primitive-neutral-900 px-3"
                onClick={() => setInfoOpen(true)}
              >
                <p className="flex items-center gap-2">
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm font-medium">{text.task_info}</span>
                </p>
                <PanelRightOpen className="h-4 w-4 text-primitive-neutral-400" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                className="min-h-10 h-10 w-full justify-between border border-primitive-neutral-700 bg-primitive-neutral-900 px-3"
                onClick={() => setStatsOpen(true)}
              >
                <span className="text-sm font-medium">{text.crew_stats}</span>
                <PanelRightOpen className="h-4 w-4 text-primitive-neutral-400" aria-hidden="true" />
              </Button>
              <LaunchSummaryCards
                task={displayTask}
                targets={targets}
                aimingPoints={aimingPoints}
                groups={displayGroups}
                launches={launches}
                routesEditable={editing && canEdit}
                routeDrafts={routeDrafts}
                onRouteChange={(launchId, value) => setRouteDrafts((current) => ({ ...current, [launchId]: value }))}
                onOpen={setLaunchSelection}
              />
            </div>
            {statsOpen ? (
              <CrewStatsDrawer
                crews={roster}
                tasks={tasks}
                groups={battleGroups}
                launches={launches}
                highlightedCrewId={highlightedCrewId}
                onClose={() => setStatsOpen(false)}
              />
            ) : null}
            {infoOpen ? (
              <TaskInfoDrawer
                task={displayTask}
                missions={missions}
                targets={targets}
                aimingPoints={aimingPoints}
                onClose={() => setInfoOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </section>
      {launchSelection && selectedLaunches.length > 0 ? (
        <LaunchDetailsModal
          crewName={crewName(launchSelection.crewId)}
          assetName={uavName(launchSelection.assetId)}
          aimingName={selectedTargetNames.join(", ") || DICTIONARY.tasks.allocation.primary_target}
          launches={selectedLaunches}
          sections={launchSections}
          entries={serialEntries}
          canEdit={canEdit}
          lockedIds={lockedIds}
          plannedQuantity={plannedQuantity}
          onClose={() => setLaunchSelection(null)}
        />
      ) : null}
    </>
  );
}
