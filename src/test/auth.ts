import { AUTH_STORE_KEY, useAuthStore } from "@/store/useAuthStore";
import type { AuthRole } from "@/types/auth";

export function signInAs(role: AuthRole = "CENTER", entityId: string | null = null): void {
  localStorage.setItem(AUTH_STORE_KEY, JSON.stringify({ state: { role, entityId }, version: 0 }));
  useAuthStore.setState({ role, entityId });
}
