import { TRANSLATIONS } from "@/lib/translations";
import { NavMenu } from "@/components/layout/NavMenu";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { useAuthStore } from "@/store/useAuthStore";
import { useMemo } from "react";
import { CREWS, DETACHMENT_REFS } from "@/data/crews";

export function Sidebar() {
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);

  const entityName = useMemo(() => {
    if (role === "CENTER") {
      return "Центр";
    }
    if (role === "DETACHMENT") {
      return DETACHMENT_REFS.find((item) => item.id === entityId)?.name || "—";
    }
    if (role === "CREW") {
      return CREWS.find((item) => item.id === entityId)?.name || "—";
    }
    return entityId;
  }, [role, entityId]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-primitive-neutral-800 px-4">
        <p className="truncate text-base font-semibold text-primitive-neutral-0">
          {TRANSLATIONS.appTitle}
        </p>
      </header>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        aria-label={TRANSLATIONS.appTitle}
      >
        <NavMenu />
      </nav>
      <div className="flex gap-4 items-center shrink-0 border-t border-primitive-neutral-800 p-3">
        <p className="text-sm text-primitive-neutral-300 min-w-fit">{entityName}</p>
        <Button variant="ghost" className="w-full" onClick={logout}>
          {DICTIONARY.auth.logout_button}
        </Button>
      </div>
    </>
  );
}
