import type { AmmoModel, CauseLaunchProblem, LaunchStatusRef, TrackerModel } from "@/types/launch";

export const TRACKERS: TrackerModel[] = [{ id: "tracker_1", name: "Tracker" }];

export const AMMOS: AmmoModel[] = [
  { id: "ammo_1", name: "БЧ 1" },
  { id: "ammo_2", name: "БЧ 2" },
  { id: "ammo_3", name: "БЧ 3" },
  { id: "ammo_4", name: "БЧ 4" },
];

export const LAUNCH_STATUSES: LaunchStatusRef[] = [
  { id: "success", name: "Штатно" },
  { id: "abort", name: "Відміна" },
  { id: "problem", name: "Проблемний" },
  { id: "other", name: "Інше" },
];

export const CAUSE_LAUNCH_PROBLEMS: CauseLaunchProblem[] = [
  { id: "technical", name: "Технічні" },
  { id: "weather", name: "Погодні умови" },
  { id: "fors-magori", name: "Сторонні сили" },
  { id: "other", name: "Інше" },
];

export const PLANNED_LAUNCH_STATUS_ID = "planned";
