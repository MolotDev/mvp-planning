import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Info, PanelRightOpen } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AllocationWorkspace } from "@/components/tasks/AllocationWorkspace";
import { CrewStatsDrawer } from "@/components/tasks/CrewStatsDrawer";
import { LaunchDetailsModal } from "@/components/tasks/LaunchDetailsModal";
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
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { isLaunchReadOnly } from "@/lib/launches";
import { matchingReports } from "@/lib/reportAggregation";
import { groupLaunchesByCrew, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
import { draftsFromGroups } from "@/lib/taskDashboard";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";

interface LaunchSelection {
  crewId: string;
  assetId: string;
  allocationId: string;
}

export function TaskPreviewPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const reports = useReportStore((state) => state.reports);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const storedDrafts = useMemo(
    () => (task ? draftsFromGroups(task, battleGroups) : []),
    [battleGroups, task],
  );
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
    setInfoOpen(false);
    setLaunchSelection(null);
    setHighlightedCrewId(null);
    setStatsOpen(false);
  }, [taskId]);

  if (role === "CREW") {
    return <Navigate to={homePath(role)} replace />;
  }

  if (task && !taskInScope(task, role, entityId)) {
    return <Navigate to={homePath(role)} replace />;
  }

  if (!task || !task.allocations[0]) {
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

  const text = DICTIONARY.tasks.details;
  const entityState = getEntityState(task);
  const canEdit = role === "DETACHMENT" && canAdminister(role, "tasks") && entityState === "active";
  const scheduledAt = task.scheduled_at || task.created_at;
  const windowOpen = Boolean(task.scheduled_at) && new Date(task.scheduled_at).getTime() <= Date.now();
  const report = matchingReports(reports, [task.organization_id], task.scheduled_at)[0];
  const roster = crewsForOrganization(task.organization_id);
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const crewGroups = groupLaunchesByCrew(task, battleGroups, launches);
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
    const error = useBattleGroupStore.getState().saveCrewDistribution(task.id, drafts);
    if (error) {
      notifyError(error);
      return;
    }
    notifySuccess(DICTIONARY.tasks.crew_allocation.saved);
    setEditing(false);
  };

  const selectedLaunches = launchSelection
    ? taskLaunches.filter((launch) => {
        const group = battleGroups.find((item) => item.id === launch.battle_group_id);
        if (!group || group.lead_crew_id !== launchSelection.crewId || group.asset_id !== launchSelection.assetId) {
          return false;
        }
        return group.allocation_line_id === launchSelection.allocationId || group.allocation_line_id === null;
      })
    : [];
  const selectedAllocation = launchSelection
    ? task.allocations.find((line) => line.id === launchSelection.allocationId)
    : undefined;
  const selectedTarget = targets.find((item) => item.id === selectedAllocation?.target_id);
  const selectedPoint = selectedAllocation?.aiming_point_id
    ? aimingPoints.find((item) => item.id === selectedAllocation.aiming_point_id && item.archived_at === null)
    : undefined;
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
            <EntityStatusBadge status={entityState} />
            <h1 className="truncate text-lg font-semibold text-primitive-neutral-0">
              {fillTemplate(text.title_dated, { label: task.label || task.id, date: formatDateUk(scheduledAt) })}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* <Button variant="ghost" className="border border-primitive-neutral-700" onClick={() => setInfoOpen(true)}>
              <Info className="h-4 w-4" aria-hidden="true" />
              {text.task_info}
            </Button> */}
            {role === "CENTER" && report?.status === "submitted" ? (
              <Button variant="ghost" onClick={() => navigate(`/reports/${report.id}`)}>
                {text.view_report}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
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
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="flex h-full w-[60%] flex-col gap-4 overflow-y-auto border-r border-primitive-neutral-800 pr-2">
            <AllocationWorkspace
              task={task}
              targets={targets}
              aimingPoints={aimingPoints}
              battleGroups={battleGroups}
              launches={launches}
              editing={editing && canEdit}
              canEdit={canEdit}
              drafts={drafts}
              onDraftsChange={setDrafts}
              onStartEdit={() => {
                setDrafts(storedDrafts);
                setEditing(true);
              }}
              onCancel={() => {
                setDrafts(storedDrafts);
                setEditing(false);
              }}
              onSave={saveAllocation}
              onHighlightCrew={highlightCrew}
            />
          </div>
          <div className="relative flex h-full w-[40%] flex-col overflow-hidden bg-primitive-neutral-900/40">
            <div className="flex h-full flex-col gap-4 overflow-y-auto pl-2">
              <Button
                variant="ghost"
                className="h-10 w-full justify-between border border-primitive-neutral-700 bg-primitive-neutral-900 px-3"
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
                className="h-10 w-full justify-between border border-primitive-neutral-700 bg-primitive-neutral-900 px-3"
                onClick={() => setStatsOpen(true)}
              >
                <span className="text-sm font-medium">{text.crew_stats}</span>
                <PanelRightOpen className="h-4 w-4 text-primitive-neutral-400" aria-hidden="true" />
              </Button>
              <LaunchSummaryCards
                task={task}
                targets={targets}
                aimingPoints={aimingPoints}
                groups={battleGroups}
                launches={launches}
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
                task={task}
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
          aimingName={selectedPoint?.name || selectedTarget?.name || DICTIONARY.tasks.allocation.primary_target}
          launches={selectedLaunches}
          entries={serialEntries}
          canEdit={canEdit}
          lockedIds={lockedIds}
          onClose={() => setLaunchSelection(null)}
        />
      ) : null}
    </>
  );
}
