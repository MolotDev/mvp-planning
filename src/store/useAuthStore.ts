import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthRole } from "@/types/auth";

export const AUTH_STORE_KEY = "military_crm_auth_store";

interface AuthState {
  role: AuthRole | null;
  entityId: string | null;
  login: (role: AuthRole, entityId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      entityId: null,
      login: (role, entityId) => set({ role, entityId }),
      logout: () => set({ role: null, entityId: null }),
    }),
    {
      name: AUTH_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        role: state.role,
        entityId: state.entityId,
      }),
    },
  ),
);

export function resetAuthStore(): void {
  useAuthStore.persist.clearStorage();
  useAuthStore.setState({ role: null, entityId: null });
}
