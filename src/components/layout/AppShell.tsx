import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainHeader } from "@/components/layout/MainHeader";
import { useLayoutStore } from "@/store/useLayoutStore";
import { reconcileAllocatedReports } from "@/store/useReportStore";
import { cn } from "@/lib/utils";

export function AppShell() {
  const isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);

  useEffect(() => {
    reconcileAllocatedReports();
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-primitive-neutral-950">
      <aside
        className={cn(
          "h-full shrink-0 overflow-hidden border-r border-primitive-neutral-800 bg-primitive-neutral-900 transition-[width] duration-200",
          isSidebarOpen ? "w-[280px]" : "w-0 border-r-0",
        )}
        aria-hidden={!isSidebarOpen}
      >
        <div className="flex h-full w-[280px] flex-col">
          <Sidebar />
        </div>
      </aside>
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <MainHeader />
        <main className="min-h-0 flex-1 overflow-hidden p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
