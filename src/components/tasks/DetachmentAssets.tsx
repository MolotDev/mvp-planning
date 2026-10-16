import { Users } from "lucide-react";
import { formatTaskAssets } from "@/lib/battleGroup";
import type { UavAsset } from "@/types/mission";
import { Badge } from "@/components/ui/badge";
import { detachmentName } from "@/lib/detachments";

interface DetachmentAssetsProps {
  organizationId: string;
  assets: UavAsset[];
}

export function DetachmentAssets({ organizationId, assets }: DetachmentAssetsProps) {
  const assetsLabel = formatTaskAssets(assets);
  const full = [detachmentName(organizationId), `(${assetsLabel} од.)`].filter(Boolean).join(" ");

  return (
    <div className="flex items-center flex-wrap gap-2">
      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="font-medium text-primitive-neutral-0">{detachmentName(organizationId)}</p>
      {/* {Object.entries(detachment.assetsQuantity).map(([assetId, numbers]) => (
        <ProgressBadge key={assetId} label={`${uavName(assetId)} × ${numbers.quantity}`} processed={numbers.processed} total={numbers.quantity} />
      ))} */}
    </div>
    // <p className="flex items-baseline gap-1 text-sm text-primitive-neutral-200">
    //   <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    //   <span className="line-clamp-2 text-lg" title={full}>
    //     {full}
    //   </span>
    // </p>
  );
}

export function DetachmentAssetsBadge({ organizationId, assets }: DetachmentAssetsProps) {
  const assetsLabel = formatTaskAssets(assets);

  return (
    <div className="flex items-baseline gap-1 text-sm text-primitive-neutral-200">
      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="line-clamp-2 text-md" title={detachmentName(organizationId)}>
        {detachmentName(organizationId)}
      </span>
      <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">
        {assetsLabel}
      </Badge>
    </div>
  );
}
