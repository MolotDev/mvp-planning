import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getBreadcrumbLabels, TRANSLATIONS } from "@/lib/translations";
import { useLayoutStore } from "@/store/useLayoutStore";

export function MainHeader() {
  const isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const { pathname } = useLocation();
  const labels = getBreadcrumbLabels(pathname);
  const ToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-primitive-neutral-800 bg-primitive-neutral-900 px-4">
      <Button
        variant="icon"
        size="icon"
        onClick={toggleSidebar}
        title={TRANSLATIONS.toggleSidebar}
        aria-label={TRANSLATIONS.toggleSidebar}
        aria-pressed={isSidebarOpen}
      >
        <ToggleIcon size={16} aria-hidden="true" />
      </Button>
      <h2 className="flex min-w-0 items-center gap-1 text-base font-semibold text-primitive-neutral-0">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight
                size={16}
                className="shrink-0 text-primitive-neutral-500"
                aria-hidden="true"
              />
            ) : null}
            <span className="truncate">{label}</span>
          </span>
        ))}
      </h2>
    </header>
  );
}
