import { Navigate, Outlet, useLocation } from "react-router-dom";
import { areaForPath, canAccess, homePath } from "@/lib/access";
import { useAuthStore } from "@/store/useAuthStore";

export function RequireAuth() {
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function AccessGuard() {
  const role = useAuthStore((state) => state.role);
  const { pathname } = useLocation();
  const area = areaForPath(pathname);
  if (area && !canAccess(role, area)) {
    return <Navigate to={homePath(role)} replace />;
  }
  return <Outlet />;
}
