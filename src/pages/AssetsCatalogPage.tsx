import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AssetModal } from "@/components/assets/AssetModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { ArchiveIconButton, EditIconButton, ResetFiltersIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
// import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { DICTIONARY } from "@/constants/dictionary";
import { ANTENNAS } from "@/data/antennas";
import { AMMOS } from "@/data/launchCatalog";
import { assetFiltersFromSearchParams, assetFiltersToSearchParams, sameAssetFilters } from "@/lib/assetFilters";
import { notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { filterAssets, useAssetStore } from "@/store/useAssetStore";
import { useAssetFilterStore } from "@/store/useAssetFilterStore";
import type { Asset, AssetStatusFilter } from "@/types/asset";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { getEntityState } from "@/lib/entityState";
import { StatusToggle } from "@/components/ui/status-toggle";

export function AssetsCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useAssetFilterStore((state) => state.filters);
  const setFilters = useAssetFilterStore((state) => state.setFilters);
  const resetFiltersState = useAssetFilterStore((state) => state.reset);
  const assets = useAssetStore((state) => state.assets);
  const archiveAsset = useAssetStore((state) => state.archiveAsset);
  const restoreAsset = useAssetStore((state) => state.restoreAsset);
  const [modalAsset, setModalAsset] = useState<Asset | null | undefined>(undefined);

  useEffect(() => {
    const parsed = assetFiltersFromSearchParams(searchParams);
    if (!parsed) {
      return;
    }
    const current = useAssetFilterStore.getState().filters;
    if (!sameAssetFilters(current, parsed)) {
      setFilters(parsed);
    }
  }, [searchParams, setFilters]);

  const applyFilters = (next: typeof filters) => {
    setFilters(next);
    setSearchParams(assetFiltersToSearchParams(next), { replace: true });
  };

  const resetFilters = () => {
    resetFiltersState();
    setSearchParams({}, { replace: true });
  };

  const visibleAssets = useMemo(
    () => filterAssets(assets, filters.query, filters.status),
    [assets, filters.query, filters.status],
  );
  // const metrics = useMemo(() => getAssetMetrics(visibleAssets), [visibleAssets]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <h1 className="sr-only">{DICTIONARY.assets.title}</h1>
      {/* <HeaderMetricCards metrics={metrics} /> */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-60">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primitive-neutral-500"
              aria-hidden="true"
            />
            <Input
              value={filters.query}
              onChange={(event) => applyFilters({ ...filters, query: event.target.value })}
              placeholder={DICTIONARY.assets.search}
              className="pl-9 pr-9"
              aria-label={DICTIONARY.assets.search}
            />
            {filters.query ? (
              <button
                type="button"
                title={DICTIONARY.common.actions.clear}
                aria-label={DICTIONARY.common.actions.clear}
                onClick={() => applyFilters({ ...filters, query: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850 hover:shadow-md"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <StatusToggle
            value={filters.status}
            onChange={(value) => applyFilters({ ...filters, status: value as AssetStatusFilter })}
          />
          {/* <div className="w-full min-w-[10rem] sm:w-44">
            <StatusFilterSelect
              mode="asset"
              value={filters.status}
              onChange={(value) => applyFilters({ ...filters, status: value as AssetStatusFilter })}
            />
          </div> */}
          <ResetFiltersIconButton onClick={resetFilters} />
        </div>
        <Button className="hover:shadow-md" onClick={() => setModalAsset(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {DICTIONARY.assets.create_button}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {visibleAssets.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-primitive-neutral-300">
            {DICTIONARY.assets.empty}
          </p>
        ) : (
          <div className="min-w-[320px] overflow-x-auto rounded-lg border border-primitive-neutral-800">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-primitive-neutral-900 text-primitive-neutral-300">
                <tr>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.index}</th>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.label}</th>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.antenna}</th>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.ammo}</th>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.status}</th>
                  <th className="px-3 py-2 font-medium">{DICTIONARY.assets.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset, index) => {
                  const antenna = ANTENNAS.find((item) => item.id === asset.antenna_id);
                  const ammos = AMMOS.filter((ammo) => asset.ammo_ids.includes(ammo.id));
                  const archived = asset.archived_at !== null;
                  return (
                    <tr
                      key={asset.id}
                      className={cn(
                        "border-t border-primitive-neutral-800",
                        archived && "opacity-50",
                      )}
                    >
                      <td className="px-3 py-2 text-primitive-neutral-200">{index + 1}</td>
                      <td className="px-3 py-2 text-primitive-neutral-0">{asset.label}</td>
                      <td className="px-3 py-2 text-primitive-neutral-200">{antenna?.name ?? asset.antenna_id}</td>
                      <td className="px-3 py-2">
                        {ammos.length === 0 ? (
                          <span className="text-primitive-neutral-300">{DICTIONARY.assets.fallback}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ammos.map((ammo) => (
                              <Badge key={ammo.id} className="bg-primitive-neutral-800 text-primitive-neutral-0">
                                {ammo.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <EntityStatusBadge status={getEntityState(asset)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <EditIconButton onClick={() => setModalAsset(asset)} />
                          {archived ? (
                            <ResetIconButton
                              onClick={() => {
                                restoreAsset(asset.id);
                                notifySuccess(DICTIONARY.assets.toasts.restored);
                              }}
                            />
                          ) : (
                            <ArchiveIconButton
                              onClick={() => {
                                archiveAsset(asset.id);
                                notifySuccess(DICTIONARY.assets.toasts.archived);
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modalAsset !== undefined ? (
        <AssetModal asset={modalAsset} onClose={() => setModalAsset(undefined)} />
      ) : null}
    </section>
  );
}
