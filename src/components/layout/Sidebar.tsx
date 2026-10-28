import { TRANSLATIONS } from "@/lib/translations";
import { NavMenu } from "@/components/layout/NavMenu";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { homePath } from "@/lib/access";
import { resetApplicationData } from "@/lib/resetApplicationData";
import { notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CREWS, DETACHMENT_REFS } from "@/data/crews";

export function Sidebar() {
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);

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

  const confirmReset = () => {
    resetApplicationData();
    setResetOpen(false);
    notifySuccess(DICTIONARY.auth.reset_done);
    navigate(homePath(role), { replace: true });
  };

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
      <div className="flex shrink-0 flex-col gap-2 border-t border-primitive-neutral-800 p-3">
        <p className="truncate text-sm text-primitive-neutral-300">{entityName}</p>
        <Button
          variant="outline"
          className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-5"
          onClick={() => setResetOpen(true)}
        >
          {DICTIONARY.auth.reset_button}
        </Button>
        <Button variant="ghost" className="w-full" onClick={logout}>
          {DICTIONARY.auth.logout_button}
        </Button>
      </div>
      {resetOpen ? (
        <Modal
          title={DICTIONARY.auth.reset_button}
          onClose={() => setResetOpen(false)}
          onConfirm={confirmReset}
          confirmLabel={DICTIONARY.auth.reset_confirm}
        >
          <p className="text-sm text-primitive-neutral-0">{DICTIONARY.auth.reset_message}</p>
        </Modal>
      ) : null}
    </>
  );
}
