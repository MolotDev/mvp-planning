import { useState, type ReactElement } from "react";
import { FoldHorizontal, FoldVertical, UnfoldHorizontal, UnfoldVertical, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeFormSelect } from "@/components/ui/form-select";
import { FormSelect } from "@/components/ui/form-select";
import { Textarea } from "@/components/ui/textarea";
import { ReportPatternField } from "@/components/reports/ReportPatternField";
import { invalidControlClass } from "@/components/ui/control-class";
import { DICTIONARY } from "@/constants/dictionary";
import { CAUSE_LAUNCH_PROBLEMS, LAUNCH_STATUSES, PLANNED_LAUNCH_STATUS_ID, TRACKERS } from "@/data/launchCatalog";
import { antennaName, assetName } from "@/lib/assets";
import { crewName } from "@/lib/battleGroup";
import { formattingMGRS } from "@/lib/formattingMGRS";
import {
  crewRate,
  summarizeLaunchesByCrew,
  type DaySlice,
  type PlanningSnapshot,
} from "@/lib/reportAggregation";
import {
  combineDateAndTime,
  formatDateInput,
  formatHeight,
  formatStampFromIso,
  formatTimeInput,
  parseStamp,
  STAMP_PATTERN,
} from "@/lib/reportFormat";
import { sliceForReport } from "@/lib/reportValidation";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/store/useAssetStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useReportStore } from "@/store/useReportStore";
import type { Launch } from "@/types/launch";
import type { Report, Trajectory } from "@/types/report";
import type { Target } from "@/types/target";
import { MultiSelect } from "../ui/multi-select";

const selectClass =
  "h-7 w-full min-w-10 rounded-md border border-zinc-100 bg-primitive-neutral-900 px-2 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
const cell = "border border-primitive-neutral-700 px-2 py-2 align-top text-sm text-primitive-neutral-0";
const baseLabelCell =
  "border border-primitive-neutral-700 bg-primitive-neutral-850 px-2 py-2 text-left text-sm font-medium text-primitive-neutral-200";
const labelCell = cn(baseLabelCell, "min-w-48 w-48");
const tarjectoryLabelCell = cn(baseLabelCell, "min-w-48 w-48");

interface ReportDocumentProps {
  report: Report;
  snapshot: PlanningSnapshot;
  readOnly: boolean;
  canSubmit: boolean;
  locked: boolean;
  onClear: () => void;
  onSubmit: () => void;
}

export function ReportDocument({ report, snapshot, readOnly, canSubmit, locked, onClear, onSubmit }: ReportDocumentProps) {
  const assets = useAssetStore((state) => state.assets);
  const updateReport = useReportStore((state) => state.updateReport);
  const addEvent = useReportStore((state) => state.addEvent);
  const removeEvent = useReportStore((state) => state.removeEvent);
  const updateEvent = useReportStore((state) => state.updateEvent);
  const setLaunchLink = useReportStore((state) => state.setLaunchLink);
  const addImages = useReportStore((state) => state.addImages);
  const removeImage = useReportStore((state) => state.removeImage);
  const updateLaunch = useLaunchStore((state) => state.patchLaunchFromReport);
  const clearLaunchTracker = useLaunchStore((state) => state.clearLaunchTrackerFromReport);
  const slice = sliceForReport(report, snapshot);
  const text = DICTIONARY.reports;
  const mainTarget = slice.targets[0];
  const additionalTargets = slice.targets.slice(1);
  const tableIds = report.trajectories.reduce<string[]>((ids, trajectory) => {
    if (trajectory.archived_at === null && !ids.includes(trajectory.table_id)) {
      ids.push(trajectory.table_id);
    }
    return ids;
  }, []);
  const descriptions = slice.missions
    .map((mission) => mission.description.trim())
    .filter(Boolean)
    // .join("\n\n");

  const clearTracker = (launch: Launch) => {
    const hadTracker = Boolean(launch.tracker_model_id) || Boolean(launch.tracker_model_serial_number);
    const updated = clearLaunchTracker(launch.id);
    if (updated && hadTracker) {
      notifySuccess(text.toasts.tracker_cleared);
    }
  };

  const readImages = (files: FileList | null) => {
    if (!files || readOnly) {
      return;
    }
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    Promise.all(
      images.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((urls) => {
        addImages(
          report.id,
          urls.filter((url) => url),
        );
      })
      .catch(() => {
        notifyError(DICTIONARY.common.error);
      });
  };

  const [isLaunchAssetFolded, setIsLaunchAssetFolded] = useState(false);
  const [isLaunchProblemsFolded, setIsLaunchProblemsFolded] = useState(false);
  const [groupedByAssetIds, setGroupedByAssetIds] = useState<string[]>([]);

  const toggleGroupedByAssetId = (assetId: string) => {
    setGroupedByAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      return [...prev, assetId];
    });
  };

  const eventCrewOptions = slice.battleGroups.map((group) => ({
    value: crewName(group.lead_crew_id),
    label: crewName(group.lead_crew_id),
  }));
  const reportAssets = new Set(slice.battleGroups.map((group) => group.asset_id));
  const generateEventDescription = () => {
    let description = "екіпажі УБпАК {asset} - {crews} - {action}";
    if (reportAssets.size === 1) {
      description = description.replace("{asset}", `"${assetName(reportAssets.values().next().value as string)}"`);
    } 
    if (slice.battleGroups.length === 1) {
      const group = slice.battleGroups[0];
      let crewsLabel = crewName(group.lead_crew_id);
      if (group.support_crew_ids.length > 0) {
        crewsLabel += ` / ${group.support_crew_ids.flatMap((id) => crewName(id)).join(" / ")}`;
      } 
      description = description.replace("{crews}", crewsLabel);
    }
    return description;
  };
  
  return (
    <article className="mx-auto flex w-full max-w-[920px] flex-col gap-6 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4 pl-12">
      
      {readOnly ? (
        <header className="flex flex-col gap-3">
          <h6 className="text-base font-semibold text-primitive-neutral-0">{text.sections.document_title}</h6>
          <div className="rounded-md border border-primitive-neutral-700">
            {slice.targets.length === 0 ? null : (
              slice.targets.map((target) => (
                <p key={target.id} className="border-b border-primitive-neutral-800 px-3 py-2 text-sm last:border-b-0">
                  {target.name}
                </p>
              ))
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="analysis-timestamp">{text.sections.analysis_timestamp_label}</Label>
            <ReportPatternField
              value={formatStampFromIso(report.analysis_timestamp)}
              ariaLabel={text.sections.analysis_timestamp_label}
              disabled={readOnly}
              required
              pattern={STAMP_PATTERN}
              accepts={(value) => parseStamp(value) !== null}
              patternMessage={text.validation.stamp}
              onValue={(value) => {
                if (!value) {
                  updateReport(report.id, { analysis_timestamp: "" });
                  return;
                }
                const iso = parseStamp(value);
                if (iso) {
                  updateReport(report.id, { analysis_timestamp: iso });
                }
              }}
              inputClassName="h-7"
            />
          </div>
          <div className="flex flex-col rounded-md border border-primitive-neutral-700 overflow-hidden">
            {descriptions.map(text =>(
              <textarea
                key={text}
                value={text}
                readOnly
                rows={1}
                aria-label={text}
                className="border-b border-primitive-neutral-800 px-3 py-2 text-sm last:border-b-0 outline-none bg-primitive-neutral-900"
              />
            ))}
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="analysis-timestamp">{text.sections.document_subtitle}</Label>
            <ReportPatternField
              value={formatStampFromIso(report.analysis_timestamp)}
              ariaLabel={text.sections.document_subtitle}
              disabled={readOnly}
              required
              pattern={STAMP_PATTERN}
              accepts={(value) => parseStamp(value) !== null}
              patternMessage={text.validation.stamp}
              onValue={(value) => {
                if (!value) {
                  updateReport(report.id, { analysis_timestamp: "" });
                  return;
                }
                const iso = parseStamp(value);
                if (iso) {
                  updateReport(report.id, { analysis_timestamp: iso });
                }
              }}
              inputClassName="h-7"
            />
          </div>
        </header>)}
      
        {readOnly  && (
          <>
            {/* What was planned section */}
            <section className="flex flex-col gap-3 w-full">
              <h2 className="text-2xl font-bold text-primitive-neutral-0">{text.sections.what_was_planned}</h2>
              {mainTarget ? (
                <div className="flex flex-col gap-2 max-w-[520px]">
                  <h3 className="text-sm font-bold text-primitive-neutral-0">{text.sections.main_target}</h3>
                  <TargetFacts target={mainTarget} />
                </div>
              ) : null}
              {additionalTargets.length > 0 ? (
                <div className="flex flex-col gap-2 max-w-[520px]">
                  <h3 className="text-sm font-bold text-primitive-neutral-0">{text.sections.additional_targets}</h3>
                  {additionalTargets.map((target) => (
                    <TargetFacts key={target.id} target={target} />
                  ))}
                </div>
              ) : null}
            </section>
      
            {/* Trajectories section */}
            <section className="flex flex-col">
              <h2 className="text-2xl font-bold text-primitive-neutral-0">{text.sections.trajectories}</h2>
              {tableIds.map((tableId) => {
                const columns = report.trajectories.filter(
                  (trajectory) => trajectory.archived_at === null && trajectory.table_id === tableId,
                );
                return (
                  <div key={tableId} className="flex flex-col gap-2 w-full">
                    <div className="overflow-x-auto w-full pt-5">
                      <table className="border-collapse relative w-fit">
                        <tbody data-table="trajectory-column" >
                          <tr>
                            <th className={tarjectoryLabelCell}>{text.tables.trajectories.header_row}</th>
                            {columns.map((trajectory) => (
                              <td key={trajectory.id} className={`${cell} relative`}>
                                <div className="flex min-w-20 w-fit items-center">
                                  {/* <Input
                                    value={trajectory.name}
                                    aria-label={text.tables.trajectories.header_row}
                                    readOnly
                                    disabled
                                    className="h-7 text-center"
                                  /> */}
                                  <p className="px-1 text-sm text-primitive-neutral-0 font-bold">
                                    {trajectory.name?.trim() ?? ""}
                                  </p>
                                  <p className="px-1 text-sm text-primitive-neutral-0 font-bold">
                                    /
                                  </p>
                                  <p className="px-1 text-sm text-primitive-neutral-0 font-bold">
                                    {crewName(slice.battleGroups.find((item) => item.id === trajectory.battle_group_id)?.lead_crew_id ?? "")}
                                  </p>
                                  {/* <FormSelect
                                    id={`bg-${trajectory.id}`}
                                    value={trajectory.battle_group_id}
                                    placeholder={text.select_crew}
                                    disabled={readOnly || slice.battleGroups.length === 1}
                                    options={slice.battleGroups.map((group) => ({
                                      value: group.id,
                                      label: `${crewName(group.lead_crew_id)}`,
                                    }))}
                                    onChange={(battleGroupId) => {
                                      const group = slice.battleGroups.find((item) => item.id === battleGroupId);
                                      updateTrajectory(report.id, trajectory.id, {
                                        battle_group_id: battleGroupId,
                                        asset_id: group?.asset_id || trajectory.asset_id,
                                      });
                                    }}
                                    className="h-7 px-2 max-w-24"
                                    invalid={!trajectory.battle_group_id}
                                  /> */}
                                  {/* <FormSelect
                                    className="h-7"
                                    id={`asset-${trajectory.id}`}
                                    value={trajectory.asset_id}
                                    placeholder={text.select_asset}
                                    disabled={readOnly || slice.battleGroups.length === 1}
                                    options={assetOptions(trajectory, slice)}
                                    onChange={(assetId) => updateTrajectory(report.id, trajectory.id, { asset_id: assetId })}
                                  /> */}
                                  <p className="px-1 text-sm text-primitive-neutral-0 font-bold">
                                    /
                                  </p>
                                  <p className="px-1 text-sm text-primitive-neutral-0">
                                    {assetName(trajectory.asset_id)}
                                  </p>
                                </div>
                              </td>
                            ))}
                          </tr>
                          <MetricRow
                            label={text.tables.trajectories.asset_quantity}
                            columns={columns}
                            render={(trajectory) =>
                              String(
                                report.launches_by_trajectory.filter((link) => link.trajectory_id === trajectory.id).length,
                              )
                            }
                            className="min-w-20 w-fit"
                          />
                          <FieldRow label={text.tables.trajectories.distance} columns={columns}>
                            {(trajectory) => (
                              <p className={`px-1 text-sm text-primitive-neutral-0 ${!trajectory.distance ? "text-primitive-red-500" : ""}`}>
                                {trajectory.distance ? trajectory.distance : "-"}
                              </p>
                              // <ReportPatternField
                              //   value={`${trajectory.distance}`}
                              //   ariaLabel={text.tables.trajectories.distance}
                              //   disabled={readOnly}
                              //   required
                              //   accepts={(value) => parseDistance(value) !== null}
                              //   patternMessage={text.validation.distance}
                              //   patternPlaceholder="100 км"
                              //   onValue={(value) => {
                              //     if (!value) {
                              //       updateTrajectory(report.id, trajectory.id, { distance: 0 });
                              //       return;
                              //     }
                              //     const distance = parseDistance(value);
                              //     if (distance !== null) {
                              //       updateTrajectory(report.id, trajectory.id, { distance });
                              //     }
                              //   }}
                              //   inputClassName="h-7 w-[220px]"
                              // />
                            )}
                          </FieldRow>
                          <FieldRow label={text.tables.trajectories.height_lzb} columns={columns}>
                            {(trajectory) => (
                              <p className={`px-1 text-sm text-primitive-neutral-0 ${!formatHeight(trajectory) ? "text-primitive-red-500" : ""}`}>
                                {formatHeight(trajectory) ?? "-"}
                              </p>
                              // <ReportPatternField
                              //   value={formatHeight(trajectory)}
                              //   ariaLabel={text.tables.trajectories.height_lzb}
                              //   disabled={readOnly}
                              //   required
                              //   accepts={isHeightDraftValid}
                              //   patternPlaceholder="1000 - 2000 / 100 - 200"
                              //   patternMessage={text.validation.height}
                              //   onValue={(value) => {
                              //     if (!value) {
                              //       updateTrajectory(report.id, trajectory.id, {
                              //         trajectory_height: "",
                              //         height_above_hot_point: "",
                              //       });
                              //       return;
                              //     }
                              //     if (!isHeightDraftValid(value)) {
                              //       return;
                              //     }
                              //     const parsed = parseHeight(value);
                              //     if (parsed) {
                              //       updateTrajectory(report.id, trajectory.id, parsed);
                              //     }
                              //   }}
                              //   inputClassName="h-7 w-[220px]"
                              // />
                            )}
                          </FieldRow>
                          <FieldRow label={text.tables.trajectories.cross_lzb} columns={columns}>
                            {(trajectory) => (
                              <p className={`px-1 text-sm text-primitive-neutral-0 ${!trajectory.hot_point_cross_line?.trim() ? "text-primitive-red-500" : ""}`}>
                                {trajectory.hot_point_cross_line ? trajectory.hot_point_cross_line : "-"}
                              </p>
                              // <ReportPatternField
                              //   value={trajectory.hot_point_cross_line}
                              //   ariaLabel={text.tables.trajectories.cross_lzb}
                              //   disabled={readOnly}
                              //   required
                              //   patternPlaceholder="найблищий населений пункт"
                              //   onValue={(value) =>
                              //     updateTrajectory(report.id, trajectory.id, { hot_point_cross_line: value })
                              //   }
                              //   inputClassName="h-7 w-[220px]"
                              // />
                            )}
                          </FieldRow>
                          <FieldRow label={text.tables.trajectories.duration} columns={columns}>
                            {(trajectory) => (
                              <p className={`px-1 text-sm text-primitive-neutral-0 ${!trajectory.duration?.trim() ? "text-primitive-red-500" : ""}`}>
                                {trajectory.duration ? trajectory.duration : "-"}
                              </p>
                              // <ReportPatternField
                              //   value={trajectory.duration}
                              //   ariaLabel={text.tables.trajectories.duration}
                              //   disabled={readOnly}
                              //   patternPlaceholder="5 год 30 хв"
                              //   required
                              //   pattern={DURATION_PATTERN}
                              //   patternMessage={text.validation.duration}
                              //   onValue={(value) => updateTrajectory(report.id, trajectory.id, { duration: value })}
                              //   inputClassName="h-7 w-[220px]"
                              // />
                            )}
                          </FieldRow>
                          <FieldRow label={text.tables.trajectories.time_on_target} columns={columns}>
                            {(trajectory) => (
                              <p className={`px-1 text-sm text-primitive-neutral-0 ${!trajectory.time_on_target?.trim() ? "text-primitive-red-500" : ""}`}>
                                {trajectory.time_on_target ? trajectory.time_on_target : "-"}
                              </p>
                              // <ReportPatternField
                              //   value={formatStampFromIso(trajectory.time_on_target)}
                              //   ariaLabel={text.tables.trajectories.time_on_target}
                              //   disabled={readOnly}
                              //   required
                              //   accepts={(value) => parseStamp(value) !== null}
                              //   patternPlaceholder="01:00 - 01:18 20.08.2026"
                              //   patternMessage={text.validation.stamp}
                              //   onValue={(value) => {
                              //     if (!value) {
                              //       updateTrajectory(report.id, trajectory.id, { time_on_target: "" });
                              //       return;
                              //     }
                              //     const iso = parseStamp(value);
                              //     if (iso) {
                              //       updateTrajectory(report.id, trajectory.id, { time_on_target: iso });
                              //     }
                              //   }}
                              //   inputClassName="h-7 w-[220px]"
                              // />
                            )}
                          </FieldRow>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-col gap-2 mt-4 border border-primitive-neutral-700 rounded-md p-2">
                <Label data-disabled={readOnly || locked} htmlFor="trajectory-images" className="flex items-center gap-2 w-fit cursor-pointer text-lg">
                  {text.sections.trajectory_schemes}
                  <Upload className="h-6 w-6" aria-hidden="true" />
                  <Input
                    id="trajectory-images"
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={readOnly || locked}
                    aria-label={text.sections.trajectory_schemes}
                    onChange={(event) => {
                      readImages(event.target.files);
                      event.target.value = "";
                    }}
                    className="h-7 border-none hidden"
                  />
                </Label>
                {report.images.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 bg-primitive-neutral-700 rounded-md p-4">
                    {report.images.map((image, index) => (
                      <div key={`${index}-${image.slice(0, 24)}`} className="flex justify-center gap-2 relative">
                        <img src={image} alt={text.sections.trajectory_schemes} className="h-[200px] w-auto rounded-md object-cover" />
                        {readOnly ? null : (
                          <Button
                            variant="icon"
                            size="icon"
                            title={DICTIONARY.common.actions.delete}
                            aria-label={DICTIONARY.common.actions.delete}
                            className="bg-primitive-neutral-900 w-8 h-8"
                            onClick={() => removeImage(report.id, index)}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
            
            {/* Forces and assets section */}
            <section className="flex flex-col gap-3">
              <h2 className="text-2xl font-bold text-primitive-neutral-0">{text.sections.forces_and_assets}</h2>
              <div className="overflow-x-auto">
                <table className="w-fit border-collapse">
                  <thead>
                    <tr>
                      <th className={labelCell}>{text.tables.forces.asset_type}</th>
                      <th className={labelCell}>{text.tables.forces.quantity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetQuantities(slice).map((row) => (
                      <tr key={row.assetId}>
                        <td className={cell}>{assetName(row.assetId)}</td>
                        <td className={cell}>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-fit border-collapse">
                  <thead>
                    <tr>
                      {[
                        text.tables.launches_grouped.crew,
                        text.tables.launches_grouped.trajectory,
                        text.tables.launches_grouped.aiming_point,
                        text.tables.launches_grouped.asset_type,
                        text.tables.launches_grouped.asset_sn,
                        text.tables.launches_grouped.tracker_sn,
                        text.tables.launches_grouped.comment,
                      ].map((label) => (
                        <th key={label} className={baseLabelCell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.launches.map((launch) => {
                      const group = slice.battleGroups.find((item) => item.id === launch.battle_group_id);
                      const asset = assets.find((item) => item.id === launch.asset_id);
                      return (
                        <tr key={launch.id}>
                          <td className={cell}>{group ? crewName(group.lead_crew_id) : ""}</td>
                          <td className={cell}>
                            {launch.trajectory_name?.trim()
                              ? launch.trajectory_name
                              : (<span className="text-sm text-primitive-red-500">-</span>)}
                          </td>
                          <td className={cell}>
                              {!!launch.aiming_point_mgrs ? (
                                <span className="text-sm text-primitive-neutral-0">
                                  {formattingMGRS.spacing(launch.aiming_point_mgrs)}
                                </span>
                              ) : (<span className="text-sm text-primitive-red-500">-</span>)}
                          </td>
                          <td className={cell}>{assetName(launch.asset_id)}</td>
                          <td className={cell}>
                              {!!launch.asset_serial_number
                                ? (launch.asset_serial_number)
                                : (<span className="text-sm text-primitive-red-500">-</span>)
                              }
                            </td>
                          <td className={cell}>{launch.tracker_model_serial_number ?? ""}</td>
                          <td className={cell}>{asset ? antennaName(asset.antenna_id) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
      
            {/* Participants section */}
            <section className="flex flex-col gap-3">
              <h2 className="text-2xl font-bold text-primitive-neutral-0">{text.sections.participants}</h2>
              <table className="w-fit border-collapse">
                <tbody>
                  <tr>
                    <th className={labelCell}>{text.tables.participants.planning}</th>
                    <td className={cell}>
                      <Input
                        value={report.planning_participants ?? ""}
                        disabled={readOnly}
                        aria-label={text.tables.participants.planning}
                        onChange={(event) =>
                          updateReport(report.id, {
                            planning_participants: event.target.value.trim() ? event.target.value : null,
                          })
                        }
                        className="h-7 border-zinc-100"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className={labelCell}>{text.tables.participants.execution}</th>
                    <td className={cell}>
                      <div className="flex flex-wrap gap-1">
                        {executionCrews(slice).map((crewId) => (
                          <Badge key={crewId} className="bg-primitive-neutral-800 text-primitive-neutral-0">
                            {crewName(crewId)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className={labelCell}>{text.tables.participants.adjacent_units}</th>
                    <td className={cell}>
                      <Input
                        value={report.adjacent_units_participants ?? ""}
                        disabled={readOnly}
                        aria-label={text.tables.participants.adjacent_units}
                        onChange={(event) =>
                          updateReport(report.id, {
                            adjacent_units_participants: event.target.value.trim() ? event.target.value : null,
                          })
                        }
                        className="h-7 border-zinc-100"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </>
        )}

      {/* Events log & Launches order sections */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-primitive-neutral-0">{text.sections.what_actually_happened}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${baseLabelCell} w-20 ${!report.actual_events.length ? "text-primitive-red-500" : ""}`}>{text.tables.event_log.time}</th>
                <th className={`${baseLabelCell} w-20 ${!report.actual_events.length ? "text-primitive-red-500" : ""}`}>{text.tables.event_log.date}</th>
                <th className={`${baseLabelCell} ${!report.actual_events.length ? "text-primitive-red-500" : ""}`}>{text.tables.event_log.event}</th>
                {/* <th className={baseLabelCell}></th> */}
              </tr>
            </thead>
            <tbody>
              {report.actual_events.map((event, index) => (
                <tr key={`${event.date}-${event.time}-${index}`}>
                  <td className={cell}>
                    <Input
                      type="time"
                      required
                      value={event.time}
                      disabled={readOnly}
                      aria-label={text.tables.event_log.time}
                      onChange={(input) => updateEvent(report.id, index, { time: input.target.value })}
                      aria-invalid={!isEventTimeValid(event.time)}
                      className={cn("h-7 px-1", isEventTimeValid(event.time) ? "border-zinc-100" : invalidControlClass)}
                    />
                  </td>
                  <td className={cell}>
                    <Input
                      type="date"
                      required
                      value={event.date}
                      disabled={readOnly}
                      aria-label={text.tables.event_log.date}
                      onChange={(input) => updateEvent(report.id, index, { date: input.target.value })}
                      aria-invalid={!isEventDateValid(event.date)}
                      className={cn("h-7 px-1", isEventDateValid(event.date) ? "border-zinc-100" : invalidControlClass)}
                    />
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-1 h-7">
                      {event.event_description.split(" - ").map((description, descriptionIndex) => {
                        if (descriptionIndex === 0) {
                          if (description.includes("{asset}")) {
                            return (
                              <>
                                <p className="text-sm text-primitive-neutral-0 min-w-fit">
                                  екіпажі УБпАК
                                </p>
                                <FormSelect
                                  className="h-7 w-25 border-zinc-100"
                                  id={`asset-${text}-${index}`}
                                  value={''}
                                  placeholder={DICTIONARY.common.asset}
                                  disabled={readOnly}
                                  options={slice.battleGroups.map((group) => ({
                                    value: group.asset_id,
                                    label: `${assetName(group.asset_id)}`,
                                  }))}
                                  onChange={(assetId) => (
                                    addEvent(report.id, `екіпажі УБпАК "${assetName(assetId)}" - `)
                                  )}
                                />
                                <p className="text-sm text-primitive-neutral-0 min-w-fit">
                                  {` -`}
                                </p>
                              </>
                            )
                          } else {
                            return (
                              <p className="text-sm text-primitive-neutral-0 min-w-fit">
                                {`${description} - `}
                              </p>
                              )
                          }
                        }
                        if (descriptionIndex === 1) {
                          return (
                            <MultiSelect
                              id={`bg-${event.event_description}-${index}`}
                              values={description.includes("{crews}") ? [] : description.split(" / ")}
                              placeholder={text.select_battle_group}
                              disabled={readOnly || slice.battleGroups.length === 1}
                              options={eventCrewOptions.map((item) => ({
                                ...item,
                                badge: item.value,
                              }))}
                              onChange={(value) => updateEvent(report.id, index, { event_description: event.event_description.replace(description, value.join(" / ") || "{crews}") })}
                              className={cn("min-h-6 h-7 px-2 w-fit", description.includes("{crews}") ? "border-red-500" : "")}
                              isRemoveButton={false}
                            />
                          )
                        }
                        if (descriptionIndex === 2) {
                          return (
                            <>
                            <span className="text-sm text-primitive-neutral-0 min-w-fit">
                              {` - `}
                            </span>
                              <Input
                                required
                                value={description.includes("{action}") ? "" : description}
                                disabled={readOnly}
                                aria-label={text.tables.event_log.event}
                                aria-invalid={!description.trim()}
                                onChange={(input) => updateEvent(report.id, index, { event_description: event.event_description.split(" - ").slice(0, -1).join(" - ") + " - " + input.target.value || "{action}" })}
                                className={cn(
                                  "h-7 px-2 w-fit flex-1 min-w-20",
                                  description.includes("{action}") || !description.trim() ? invalidControlClass : "",
                                )}
                              />
                            </>
                          )
                        }
                      })}
                      <Button
                        variant="icon"
                        size="icon"
                        title={DICTIONARY.common.actions.delete}
                        aria-label={DICTIONARY.common.actions.delete}
                        className="w-7 h-7 bg-primitive-neutral-900"
                        onClick={() => removeEvent(report.id, event.id)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div>
            <Button disabled={readOnly} className="h-7" onClick={() => addEvent(report.id, generateEventDescription())}>
              {text.add_event}
            </Button>
          </div>
        )}
        
        {/* Launches order section */}
        {[...groupLaunches(slice).entries()].map(([assetLabel, launches]) => (
          <div key={assetLabel}>
            <h3 className="text-lg font-bold text-primitive-neutral-0">{text.sections.launches_order}</h3>
            {/* <p className="text-sm font-semibold text-primitive-neutral-0">{assetLabel}</p> */}
            <div className="overflow-x-auto p-4 w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={baseLabelCell}>{text.tables.launches_results.launch_date}</th>
                    <th className={baseLabelCell}>{text.tables.launches_results.launch_time}</th>
                    <th className={baseLabelCell}>{text.tables.launches_results.launch_number}</th>
                    <th className={baseLabelCell}>{text.tables.launches_results.trajectory}</th>
                    <th  className={`${baseLabelCell} relative`}>
                      <div className="absolute top-[-16px] z-10 right-[-12px]">
                        <Button variant="icon" size="icon"
                          tabIndex={-1}
                          title={isLaunchAssetFolded ? DICTIONARY.common.actions.fold : DICTIONARY.common.actions.unfold}
                          aria-label={isLaunchAssetFolded ? DICTIONARY.common.actions.fold : DICTIONARY.common.actions.unfold}
                          className="h-5 w-6 p-0.5"
                          onClick={() => setIsLaunchAssetFolded(!isLaunchAssetFolded)}>
                            {!isLaunchAssetFolded
                              ? <UnfoldHorizontal className="h-full w-full" aria-hidden="true" />
                              : <FoldHorizontal className="h-full w-full" aria-hidden="true" />
                            }
                        </Button>
                      </div>
                      {text.tables.launches_grouped.asset_type}
                    </th>
                    {isLaunchAssetFolded && (
                      <>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{text.tables.launches_grouped.asset_sn}</th>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{DICTIONARY.common.tracker}</th>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{text.tables.launches_grouped.tracker_sn}</th>
                      </>
                    )}
                    <th className={baseLabelCell}>{text.tables.launches_results.crew}</th>
                    <th className={`${baseLabelCell} relative`}>
                      <div className="absolute top-[-16px] z-10 right-[-12px]">
                        <Button variant="icon" size="icon"
                          tabIndex={-1}
                          title={isLaunchProblemsFolded ? DICTIONARY.common.actions.fold : DICTIONARY.common.actions.unfold}
                          aria-label={isLaunchProblemsFolded ? DICTIONARY.common.actions.fold : DICTIONARY.common.actions.unfold}
                          className="h-5 w-6 p-0.5"
                          onClick={() => setIsLaunchProblemsFolded(!isLaunchProblemsFolded)}>
                            {!isLaunchProblemsFolded
                              ? <UnfoldHorizontal className="h-full w-full" aria-hidden="true" />
                              : <FoldHorizontal className="h-full w-full" aria-hidden="true" />
                            }
                        </Button>
                      </div>
                      {text.tables.launches_results.status}
                    </th>
                    {isLaunchProblemsFolded && (
                      <>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{text.tables.launches_results.problem_cause}</th>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{text.tables.launches_grouped.comment}</th>
                        <th data-table="column-border-dashed" className={`${baseLabelCell} relative`}>{text.tables.launches_results.upload_video}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border border-primitive-neutral-700 relative">
                    <td colSpan={10} className="px-4 text-md text-primitive-neutral-0 ">
                      <div className="absolute bottom-[-17px] z-10 left-[-16px]">
                        <Button variant="icon" size="icon"
                          tabIndex={-1}
                          title={groupedByAssetIds.includes(assetLabel) ? DICTIONARY.common.actions.unfold : DICTIONARY.common.actions.fold}
                          aria-label={groupedByAssetIds.includes(assetLabel) ? DICTIONARY.common.actions.unfold : DICTIONARY.common.actions.fold}
                          className="h-6 w-5 p-0.5"
                          onClick={() => toggleGroupedByAssetId(assetLabel)}>
                            {groupedByAssetIds.includes(assetLabel)
                              ? <UnfoldVertical className="h-full w-full" aria-hidden="true" />
                              : <FoldVertical className="h-full w-full" aria-hidden="true" />
                            }
                        </Button>
                      </div>
                      {assetLabel}
                    </td>
                  </tr>
                  {!groupedByAssetIds.includes(assetLabel) &&launches.map((launch) => {
                    const group = slice.battleGroups.find((item) => item.id === launch.battle_group_id);
                    const link = report.launches_by_trajectory.find((item) => item.launch_id === launch.id);
                    const launchedAt = link?.launched_at ?? "";
                    const trackerModelName = TRACKERS.find((item) => item.id === launch.tracker_model_id)?.name ?? "";
                    return (
                      <tr key={launch.id}>
                        <td className={`${cell} relative`} data-table="row-border-dashed" >
                          <Input
                            type="date"
                            required
                            disabled={readOnly}
                            aria-label={text.tables.launches_results.launch_date}
                            value={formatDateInput(launchedAt)}
                            onChange={(event) => {
                              const next = combineDateAndTime(
                                event.target.value,
                                formatTimeInput(launchedAt) || formatTimeInput(new Date().toISOString()),
                              );
                              if (next) {
                                setLaunchLink(report.id, launch.id, { launched_at: next });
                              }
                            }}
                            aria-invalid={!formatDateInput(launchedAt)}
                            className={cn("h-7 px-2 min-w-32 max-w-32", formatDateInput(launchedAt) ? undefined : invalidControlClass)}
                          />
                        </td>
                        <td className={cell}>
                          <Input
                            type="time"
                            required
                            disabled={readOnly}
                            aria-label={text.tables.launches_results.launch_time}
                            value={formatTimeInput(launchedAt)}
                            onChange={(event) => {
                              const next = combineDateAndTime(
                                formatDateInput(launchedAt) || formatDateInput(new Date().toISOString()),
                                event.target.value,
                              );
                              if (next) {
                                setLaunchLink(report.id, launch.id, { launched_at: next });
                              }
                            }}
                            aria-invalid={!formatTimeInput(launchedAt)}
                            className={cn("h-7 px-2 min-w-20", formatTimeInput(launchedAt) ? undefined : invalidControlClass)}
                          />
                        </td>
                        <td className={cell}>
                          <Input
                            type="text"
                            // min={1}
                            pattern="[0-9]*"
                            required
                            disabled={readOnly}
                            aria-label={text.tables.launches_results.launch_number}
                            value={link?.launch_number ?? ""}
                            onChange={(event) => {
                              const launchNumber = Number(event.target.value);
                              if (Number.isFinite(launchNumber) && launchNumber > 0) {
                                setLaunchLink(report.id, launch.id, { launch_number: launchNumber });
                              }
                            }}
                            aria-invalid={!isLaunchNumberValid(link?.launch_number)}
                            className={cn(
                              "h-7 px-2 min-w-20 w-20",
                              isLaunchNumberValid(link?.launch_number) ? undefined : invalidControlClass,
                            )}
                          />
                        </td>
                        <td className={cell}>
                          {launch.trajectory_name?.trim()
                            ? launch.trajectory_name
                            : (<span className="text-sm text-primitive-red-500">-</span>)}
                        </td>
                        <td className={`${cell} min-w-24`}>
                          {assetName(launch.asset_id)}
                        </td>
                        {isLaunchAssetFolded && (
                          <>
                            <td className={cell}>
                              <Input
                                value={launch.asset_serial_number}
                                disabled={readOnly}
                                aria-label={text.tables.launches_grouped.asset_sn}
                                onChange={(event) =>
                                  updateLaunch(launch.id, { asset_serial_number: event.target.value })
                                }
                                className='h-7 px-2 min-w-28 max-w-[200px]'
                              />
                            </td>
                            <td className={cn(cell, "group/tracker")}>
                              <div className="flex items-center justify-between min-w-20">
                                {trackerModelName}
                                {(readOnly || !trackerModelName) ? null : (
                                  <Button
                                    variant="icon"
                                    size="icon"
                                    title={text.tracker.delete_tooltip}
                                    aria-label={text.tracker.delete_tooltip}
                                    className="h-6 min-w-6 w-6 group-hover/tracker:opacity-100 focus-visible:opacity-100"
                                    onClick={() => clearTracker(launch)}
                                  >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className={cell}>
                              <Input
                                value={launch.tracker_model_serial_number ?? ""}
                                disabled={readOnly}
                                aria-label={text.tables.launches_grouped.tracker_sn}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value.trim() === "") {
                                    clearTracker(launch);
                                    return;
                                  }
                                  updateLaunch(launch.id, { tracker_model_serial_number: value });
                                }}
                                className="h-7 px-2 min-w-28 max-w-[200px]"
                              />
                            </td>
                          </>
                        )}
                        <td className={cell}>{group ? crewName(group.lead_crew_id) : ""}</td>
                        <td className={cell}>
                          <NativeFormSelect
                            value={launch.launch_status_id}
                            disabled={readOnly}
                            placeholder={DICTIONARY.launches.fields.select_status}
                            options={statusOptions(launch.launch_status_id)}
                            onChange={(statusId) =>
                              updateLaunch(launch.id, {
                                launch_status_id: statusId,
                                cause_launch_problem_id: statusId === "problem" ? launch.cause_launch_problem_id : "",
                              })
                            }
                            className={`${selectClass} min-w-40`}
                            ariaLabel={text.tables.launches_results.status}
                            invalid={!launch.launch_status_id.trim() || launch.launch_status_id === PLANNED_LAUNCH_STATUS_ID}
                          />
                        </td>
                        {isLaunchProblemsFolded && (
                          <>
                            <td className={cell}>
                              <NativeFormSelect
                                value={launch.cause_launch_problem_id}
                                disabled={readOnly || launch.launch_status_id !== "problem"}
                                placeholder={DICTIONARY.launches.fields.select_cause}
                                options={CAUSE_LAUNCH_PROBLEMS.map((cause) => ({
                                  value: cause.id,
                                  label: cause.name,
                                }))}
                                onChange={(causeId) => updateLaunch(launch.id, { cause_launch_problem_id: causeId })}
                                className={`${selectClass} min-w-48`}
                                ariaLabel={text.tables.launches_results.problem_cause}
                                invalid={launch.launch_status_id === "problem" && !launch.cause_launch_problem_id.trim()}
                              />
                            </td>
                            <td className={cell}>
                              <Textarea 
                                value={launch.comments}
                                disabled={readOnly}
                                aria-label={text.tables.launches_grouped.comment}
                                onChange={(event) =>
                                  updateLaunch(launch.id, { comments: event.target.value })
                                }
                                rows={1}
                                className='h-7 px-2 py-1 min-w-40 text-xs'
                              />
                            </td>
                            <td className={cell}>
                              <Label htmlFor="trajectory-images" className="min-w-24 w-full flex items-center justify-center gap-2 cursor-pointer  text-primitive-neutral-0">
                                <div className="flex items-center justify-center h-7 w-7 rounded-md bg-transparent hover:bg-primitive-neutral-850 hover:shadow-md">
                                  <Upload className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <Input type="file"
                                  accept="video/*"
                                  disabled={readOnly}
                                  aria-label={text.tables.launches_results.upload_video}
                                  className="hidden"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      notifySuccess("Медіафайл завантажено!");
                                    } else {
                                      notifyError("Помилка завантаження медіафайлу!");
                                    }
                                  }}
                                />
                              </Label>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {readOnly  && (<>
          {/* Summary by crews section */}
          <h3 className="text-lg font-bold text-primitive-neutral-0">{text.sections.by_crews}</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    text.tables.summary_by_crew.asset_type,
                    text.tables.summary_by_crew.crew,
                    text.tables.summary_by_crew.successful_count,
                    text.tables.summary_by_crew.failed_count,
                    text.tables.summary_by_crew.success_rate,
                  ].map((label) => (
                    <th key={label} className={baseLabelCell}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summarizeLaunchesByCrew(slice).map((summary) => (
                  <tr key={`${summary.assetId}-${summary.crewId}`}>
                    <td className={cell}>{assetName(summary.assetId)}</td>
                    <td className={cell}>{summary.crewId ? crewName(summary.crewId) : ""}</td>
                    <td className={cell}>{summary.successful}</td>
                    <td className={cell}>{summary.failed}</td>
                    <td className={cell}>{`${crewRate(summary)} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </section>

      
      {!locked && report.status === "draft" && (
        <footer className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" disabled={readOnly} onClick={onClear}>
            {text.clear_report}
          </Button>
          <Button disabled={readOnly || !canSubmit} onClick={onSubmit}>
            {text.submit_report}
          </Button>
        </footer>
        )}
    </article>
  );
}

function TargetFacts({ target }: { target: Target }) {
  const rows = [
    [DICTIONARY.reports.tables.targets.id, target.displayed_id, false],
    [DICTIONARY.reports.tables.targets.object, target.name, false],
    [DICTIONARY.reports.tables.targets.type, target.type, false],
    [DICTIONARY.reports.tables.targets.address, target.address, false],
    [
      DICTIONARY.reports.tables.targets.distance_to_hot_line,
      `${target.distance_from_hot_line} ${DICTIONARY.common.units.km}`,
      false,
    ],
    [DICTIONARY.reports.tables.targets.coordinates, formattingMGRS.spacing(target.mgrs), true],
  ] as const;

  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th className={labelCell}>{label}</th>
            <td className={cell}>
              <div className="flex items-center gap-1">
                {value}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetricRow({
  label,
  className,
  columns,
  render,
}: {
  label: string;
  className: string;
  columns: Trajectory[];
  render: (trajectory: Trajectory) => string;
}) {
  return (
    <tr>
      <th className={tarjectoryLabelCell}>{label}</th>
      {columns.map((trajectory) => (
        <td key={trajectory.id} className={`${cell} ${className}`}>
          {render(trajectory)}
        </td>
      ))}
    </tr>
  );
}

function FieldRow({
  label,
  columns,
  children,
}: {
  label: string;
  columns: Trajectory[];
  children: (trajectory: Trajectory) => ReactElement;
}) {
  return (
    <tr>
      <th className={tarjectoryLabelCell}>{label}</th>
      {columns.map((trajectory) => (
        <td key={trajectory.id} className={cell}>
          {children(trajectory)}
        </td>
      ))}
    </tr>
  );
}

// function assetOptions(trajectory: Trajectory, slice: DaySlice) {
//   if (trajectory.battle_group_id) {
//     const group = slice.battleGroups.find((item) => item.id === trajectory.battle_group_id);
//     if (group?.asset_id) {
//       return [{ value: group.asset_id, label: assetName(group.asset_id) }];
//     }
//   }
//   return [...new Set(slice.battleGroups.map((group) => group.asset_id).filter(Boolean))].map((assetId) => ({
//     value: assetId,
//     label: assetName(assetId),
//   }));
// }

function assetQuantities(slice: DaySlice): { assetId: string; quantity: number }[] {
  const totals = new Map<string, number>();
  slice.tasks.forEach((task) => {
    task.assets.forEach((asset) => {
      if (!asset.asset_id) {
        return;
      }
      totals.set(asset.asset_id, (totals.get(asset.asset_id) ?? 0) + asset.quantity);
    });
  });
  return [...totals.entries()].map(([assetId, quantity]) => ({ assetId, quantity }));
}

function executionCrews(slice: DaySlice): string[] {
  return [
    ...new Set(
      slice.battleGroups.flatMap((group) => [group.lead_crew_id, ...group.support_crew_ids].filter(Boolean)),
    ),
  ];
}

function isEventTimeValid(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function isEventDateValid(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isLaunchNumberValid(value: number | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function groupLaunches(slice: DaySlice): Map<string, Launch[]> {
  const groups = new Map<string, Launch[]>();
  slice.launches.forEach((launch) => {
    const label = assetName(launch.asset_id);
    const list = groups.get(label) ?? [];
    list.push(launch);
    groups.set(label, list);
  });
  return groups;
}

function statusOptions(current: string) {
  const options = LAUNCH_STATUSES.map((status) => ({ value: status.id, label: status.name }));
  if (current && !options.some((option) => option.value === current)) {
    return [
      {
        value: current,
        label: current === PLANNED_LAUNCH_STATUS_ID ? DICTIONARY.launches.status_planned : current,
      },
      ...options,
    ];
  }
  return options;
}
