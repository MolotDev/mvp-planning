import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
// import { MetricCards } from "@/components/targets/MetricCards";
import { TargetCard } from "@/components/targets/TargetCard";
import { TargetModal } from "@/components/targets/TargetModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusToggle } from "@/components/ui/status-toggle";
import { DICTIONARY } from "@/constants/dictionary";
import { notifySuccess } from "@/lib/toasts";
import {
  filterTargets,
  // getTargetMetrics,
  useTargetStore,
} from "@/store/useTargetStore";
import { useTargetFilterStore } from "@/store/useTargetFilterStore";
import type { Target } from "@/types/target";
// import { StatusFilterSelect } from "@/components/ui/status-filter-select";

export function TargetsCatalogPage() {
  const navigate = useNavigate();
  const targets = useTargetStore((state) => state.targets);
  const archiveTarget = useTargetStore((state) => state.archiveTarget);
  const restoreTarget = useTargetStore((state) => state.restoreTarget);
  const query = useTargetFilterStore((state) => state.filters.query);
  const status = useTargetFilterStore((state) => state.filters.status);
  const setFilters = useTargetFilterStore((state) => state.setFilters);
  const [modalTarget, setModalTarget] = useState<Target | null | undefined>(undefined);

  // const metrics = useMemo(() => getTargetMetrics(filterTargets(targets, query, "all")), [targets, query]);
  const visibleTargets = useMemo(
    () => filterTargets(targets, query, status),
    [targets, query, status],
  );

  const openPreview = (target: Target) => {
    navigate(`/catalogs/targets/${target.id}`);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <h1 className="sr-only">{DICTIONARY.targets_catalog.title}</h1>
      {/* <MetricCards metrics={metrics} /> */}
      <div className="flex flex-col gap-3 lg:flex-row items-center justify-between lg:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-60">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primitive-neutral-500"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setFilters({ query: event.target.value, status })}
              placeholder={DICTIONARY.common.actions.search}
              className="pl-9 pr-9"
              aria-label={DICTIONARY.common.actions.search}
            />
            {query ? (
              <button
                type="button"
                title={DICTIONARY.common.actions.clear}
                aria-label={DICTIONARY.common.actions.clear}
                onClick={() => setFilters({ query: "", status })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <StatusToggle
            value={status}
            onChange={(value) => {
              if (value === "reported") {
                return;
              }
              setFilters({ query, status: value });
            }}
          />
        </div>
        <Button onClick={() => setModalTarget(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {DICTIONARY.targets_catalog.buttons.create_target}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visibleTargets.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-primitive-neutral-300">
            {DICTIONARY.targets_catalog.empty}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleTargets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                onPreview={openPreview}
                onEdit={setModalTarget}
                onArchive={(item) => {
                  archiveTarget(item.id);
                  notifySuccess(DICTIONARY.targets_catalog.toasts.target.archived);
                }}
                onRestore={(item) => {
                  restoreTarget(item.id);
                  notifySuccess(DICTIONARY.targets_catalog.toasts.target.reset);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {modalTarget !== undefined ? (
        <TargetModal
          target={modalTarget}
          onClose={() => setModalTarget(undefined)}
        />
      ) : null}
    </section>
  );
}
