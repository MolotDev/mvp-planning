import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  FileBarChart,
  Flag,
  ListTodo,
  Plane,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { HoverPopover } from "@/components/launches/HoverPopover";
import { DICTIONARY } from "@/constants/dictionary";
import { areaForPath, canAccess } from "@/lib/access";
import { cn } from "@/lib/utils";
import { TRANSLATIONS } from "@/lib/translations";
import { useAuthStore } from "@/store/useAuthStore";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const PLANNING_ITEMS: NavItem[] = [
  { to: "/planning/missions", label: TRANSLATIONS.missions, icon: Flag },
  { to: "/planning/tasks", label: TRANSLATIONS.tasks, icon: ListTodo },
  { to: "/planning/launches", label: TRANSLATIONS.launches, icon: Rocket },
];

const CATALOG_ITEMS: NavItem[] = [
  { to: "/catalogs/targets", label: TRANSLATIONS.targets, icon: Crosshair },
  { to: "/catalogs/assets", label: TRANSLATIONS.uavModels, icon: Plane },
];

export function NavMenu() {
  const { pathname } = useLocation();
  const [isPlanningOpen, setIsPlanningOpen] = useState(pathname.startsWith("/planning"));
  const [isCatalogsOpen, setIsCatalogsOpen] = useState(pathname.startsWith("/catalogs"));

  useEffect(() => {
    if (pathname.startsWith("/planning")) {
      setIsPlanningOpen(true);
    }
    if (pathname.startsWith("/catalogs")) {
      setIsCatalogsOpen(true);
    }
  }, [pathname]);

  return (
    <ul className="flex flex-col gap-1">
      <li>
        <NavGroup
          label={TRANSLATIONS.planning}
          isOpen={isPlanningOpen}
          onToggle={() => setIsPlanningOpen((open) => !open)}
          items={PLANNING_ITEMS}
        />
      </li>
      <li>
        <NavItemLink
          to="/reports"
          label={TRANSLATIONS.reports}
          icon={FileBarChart}
        />
      </li>
      <li>
        <NavGroup
          label={TRANSLATIONS.catalogs}
          isOpen={isCatalogsOpen}
          onToggle={() => setIsCatalogsOpen((open) => !open)}
          items={CATALOG_ITEMS}
        />
      </li>
    </ul>
  );
}

function NavGroup({
  label,
  isOpen,
  onToggle,
  items,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  items: NavItem[];
}) {
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-primitive-neutral-0 hover:cursor-pointer hover:bg-primitive-neutral-850"
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        <Chevron size={16} aria-hidden="true" />
      </button>
      {isOpen ? (
        <ul className="ml-2 mt-1 space-y-1 border-l border-primitive-neutral-700 py-1 pl-3">
          {items.map((item) => (
            <li key={item.to} className="ml-2">
              <NavItemLink to={item.to} label={item.label} icon={item.icon} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NavItemLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
}) {
  const role = useAuthStore((state) => state.role);
  const area = areaForPath(to);
  const denied = area !== null && !canAccess(role, area);
  const link = (
    <NavLink
      to={to}
      aria-disabled={denied}
      title={denied ? DICTIONARY.auth.access_denied : undefined}
      onClick={(event) => {
        if (denied) {
          event.preventDefault();
        }
      }}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1 rounded-md px-3 py-2 text-sm",
          denied
            ? "cursor-not-allowed text-primitive-neutral-200 opacity-50"
            : "hover:cursor-pointer hover:bg-primitive-neutral-850",
          !denied && isActive
            ? "bg-primitive-neutral-800 text-primitive-neutral-0"
            : !denied && "text-primitive-neutral-200",
        )
      }
    >
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
  if (!denied) {
    return link;
  }
  return <HoverPopover content={<span className="text-sm text-primitive-neutral-0">{DICTIONARY.auth.access_denied}</span>}>{link}</HoverPopover>;
}
