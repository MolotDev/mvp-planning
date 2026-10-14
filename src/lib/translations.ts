export const TRANSLATIONS = {
  appTitle: "Операційне планування",
  toggleSidebar: "Перемкнути бічну панель",
  planning: "Планування",
  missions: "Вогневі завдання",
  tasks: "Політні заявки",
  launches: "Пуски",
  reports: "Звіти",
  catalogs: "Довідники",
  targets: "Цілі",
  uavModels: "Засоби ураження",
} as const;

export const PATH_SEGMENT_LABELS: Record<string, string> = {
  planning: TRANSLATIONS.planning,
  missions: TRANSLATIONS.missions,
  tasks: TRANSLATIONS.tasks,
  launches: TRANSLATIONS.launches,
  reports: TRANSLATIONS.reports,
  catalogs: TRANSLATIONS.catalogs,
  targets: TRANSLATIONS.targets,
  "uav-models": TRANSLATIONS.uavModels,
  assets: TRANSLATIONS.uavModels,
};

export function getPathSegments(pathname: string): string[] {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pathname.split("/").filter((segment) => Boolean(segment) && !uuidPattern.test(segment));
}

export function getPageTitle(pathname: string): string {
  const segments = getPathSegments(pathname);
  const last = segments[segments.length - 1];
  return last ? (PATH_SEGMENT_LABELS[last] ?? last) : TRANSLATIONS.appTitle;
}

export function getBreadcrumbLabels(pathname: string): string[] {
  return getPathSegments(pathname).map((segment) => PATH_SEGMENT_LABELS[segment] ?? segment);
}
