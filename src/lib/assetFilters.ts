import { DEFAULT_ASSET_FILTERS, type AssetFilterState } from "@/store/useAssetFilterStore";
import type { AssetStatusFilter } from "@/types/asset";

const STATUSES: AssetStatusFilter[] = ["active", "reported", "archived", "all"];

function parseStatus(value: string | null): AssetStatusFilter {
  if (value && STATUSES.includes(value as AssetStatusFilter)) {
    return value as AssetStatusFilter;
  }
  return DEFAULT_ASSET_FILTERS.status;
}

export function assetFiltersFromSearchParams(params: URLSearchParams): AssetFilterState | null {
  if (!params.has("q") && !params.has("status")) {
    return null;
  }
  return {
    query: params.get("q") ?? "",
    status: parseStatus(params.get("status")),
  };
}

export function assetFiltersToSearchParams(filters: AssetFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.query) {
    params.q = filters.query;
  }
  if (filters.status !== DEFAULT_ASSET_FILTERS.status) {
    params.status = filters.status;
  }
  return params;
}

export function sameAssetFilters(left: AssetFilterState, right: AssetFilterState): boolean {
  return left.query === right.query && left.status === right.status;
}
