import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { DICTIONARY } from "@/constants/dictionary";
import { CREWS, DETACHMENT_REFS } from "@/data/crews";
import { homePath } from "@/lib/access";
import { useAuthStore } from "@/store/useAuthStore";
import type { AuthRole } from "@/types/auth";

const ROLE_OPTIONS: { role: AuthRole; label: string }[] = [
  { role: "CENTER", label: DICTIONARY.auth.roles.center },
  { role: "DETACHMENT", label: DICTIONARY.auth.roles.detachment },
  { role: "CREW", label: DICTIONARY.auth.roles.crew },
];

export function LoginPage() {
  const role = useAuthStore((state) => state.role);
  const login = useAuthStore((state) => state.login);
  const [entityId, setEntityId] = useState("");

  if (role) {
    return <Navigate to={homePath(role)} replace />;
  }

  const chooseRole = (next: AuthRole) => {
    setEntityId("");
    if (next === "CENTER") {
      login("CENTER", null);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-primitive-neutral-950 p-6">
      <section className="flex w-full max-w-xl flex-col gap-6 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primitive-neutral-0">{DICTIONARY.auth.login_title}</h1>
          <p className="text-sm text-primitive-neutral-300">{DICTIONARY.auth.select_role}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROLE_OPTIONS.map((option) => {
            if (option.role === "CENTER") {
              return (
                <Button
                  key={option.role}
                  variant="ghost"
                  className="h-auto min-h-16 whitespace-normal px-3 py-3"
                  onClick={() => chooseRole(option.role)}
                >
                  {option.label}
                </Button>
              )
            }
            if (option.role === "DETACHMENT") {
              return (
                <div
                  key={option.role}
                  className="h-auto min-h-16 whitespace-normal px-3 py-3 flex flex-col gap-2 flex items-center justify-center gap-1 rounded-md bg-transparent text-primitive-neutral-0 hover:bg-primitive-neutral-850 hover:shadow-md"
                >
                  {option.label}
                  <FormSelect
                    id="auth-detachment"
                    value={entityId}
                    placeholder={DICTIONARY.auth.select_detachment}
                    options={DETACHMENT_REFS.map((item) => ({ value: item.id, label: item.name }))}
                    onChange={(value) => login(option.role, value)
                    }
                  />
                </div>
              )
            }

            return (
              <div
                key={option.role}
                className="h-auto min-h-16 whitespace-normal px-3 py-3 flex flex-col gap-2 flex items-center justify-center gap-1 rounded-md bg-transparent text-primitive-neutral-0 hover:bg-primitive-neutral-850 hover:shadow-md"
              >
                {option.label}
                  <FormSelect
                    id="auth-crew"
                    value={entityId}
                    placeholder={DICTIONARY.auth.select_crew}
                    options={CREWS.map((item) => ({ value: item.id, label: item.name }))}
                    onChange={(value) => login(option.role, value)
                    }
                  />
              </div>
            )
          })}
        </div>
      </section>
    </main>
  );
}
