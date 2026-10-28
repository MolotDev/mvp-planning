import { Navigate, Route, Routes } from "react-router-dom";
import { useCrossTabSync } from "@/hooks/useCrossTabSync";
import { AccessGuard, RequireAuth } from "@/components/auth/AccessGuard";
import { AppShell } from "@/components/layout/AppShell";
import { homePath } from "@/lib/access";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/store/useAuthStore";
import { LaunchPreviewPage } from "@/pages/LaunchPreviewPage";
import { LaunchesPlanningPage } from "@/pages/LaunchesPlanningPage";
import { ReportPreviewPage } from "@/pages/ReportPreviewPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { TaskPreviewPage } from "@/pages/TaskPreviewPage";
import { TasksPlanningPage } from "@/pages/TasksPlanningPage";
import { MissionPreviewPage } from "@/pages/MissionPreviewPage";
import { MissionsPlanningPage } from "@/pages/MissionsPlanningPage";
import { TargetPreviewPage } from "@/pages/TargetPreviewPage";
import { AssetsCatalogPage } from "@/pages/AssetsCatalogPage";
import { TargetsCatalogPage } from "@/pages/TargetsCatalogPage";

function HomeRedirect() {
  const role = useAuthStore((state) => state.role);
  return <Navigate to={homePath(role)} replace />;
}

export default function App() {
  useCrossTabSync();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<AccessGuard />}>
        <Route path="/planning/missions/:missionId" element={<MissionPreviewPage />} />
        <Route path="/planning/missions" element={<MissionsPlanningPage />} />
        <Route path="/planning/tasks/:taskId" element={<TaskPreviewPage />} />
        <Route path="/planning/tasks" element={<TasksPlanningPage />} />
        <Route path="/planning/launches/task/:taskId" element={<LaunchPreviewPage />} />
        <Route path="/planning/launches/mission/:missionId" element={<LaunchPreviewPage />} />
        <Route path="/planning/launches/:battleGroupId" element={<LaunchPreviewPage />} />
        <Route path="/planning/launches" element={<LaunchesPlanningPage />} />
        <Route path="/reports/:reportId" element={<ReportPreviewPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/catalogs/targets/:targetId" element={<TargetPreviewPage />} />
        <Route path="/catalogs/targets" element={<TargetsCatalogPage />} />
        <Route path="/catalogs/assets" element={<AssetsCatalogPage />} />
        <Route path="/catalogs/uav-models" element={<Navigate to="/catalogs/assets" replace />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  );
}
