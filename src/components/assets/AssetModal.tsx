import { useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeFormSelect } from "@/components/ui/form-select";
import { DICTIONARY } from "@/constants/dictionary";
import { ANTENNAS } from "@/data/antennas";
import { AMMOS } from "@/data/launchCatalog";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAssetStore } from "@/store/useAssetStore";
import type { Asset } from "@/types/asset";

interface AssetModalProps {
  asset: Asset | null;
  onClose: () => void;
}

const selectClassName =
  "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export function AssetModal({ asset, onClose }: AssetModalProps) {
  const isEdit = Boolean(asset);
  const createAsset = useAssetStore((state) => state.createAsset);
  const updateAsset = useAssetStore((state) => state.updateAsset);
  const isLabelTaken = useAssetStore((state) => state.isLabelTaken);
  const nextAssetLabel = useAssetStore((state) => state.nextAssetLabel);
  const [label, setLabel] = useState(() => (asset ? asset.label : nextAssetLabel()));
  const [antennaId, setAntennaId] = useState(asset?.antenna_id ?? "");
  const [ammoIds, setAmmoIds] = useState<string[]>(asset ? [...asset.ammo_ids] : []);
  const [submitted, setSubmitted] = useState(false);

  const trimmed = label.trim();
  const duplicate = trimmed !== "" && isLabelTaken(trimmed, asset?.id);
  const labelError = !trimmed
    ? submitted
      ? DICTIONARY.targets_catalog.validation.required
      : undefined
    : duplicate
      ? DICTIONARY.assets.validation.duplicate_label
      : undefined;
  const antennaError =
    submitted && !antennaId ? DICTIONARY.targets_catalog.validation.required : undefined;
  const canSave = Boolean(trimmed) && Boolean(antennaId) && !duplicate;

  const save = () => {
    setSubmitted(true);
    if (!canSave) {
      return;
    }
    const input = { label: trimmed, antenna_id: antennaId, ammo_ids: ammoIds };
    const saved = isEdit && asset ? updateAsset(asset.id, input) : createAsset(input);
    if (!saved) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    notifySuccess(isEdit ? DICTIONARY.assets.toasts.updated : DICTIONARY.assets.toasts.created);
    onClose();
  };

  const title = isEdit
    ? `${DICTIONARY.assets.modals.title_edit} ${asset?.label ?? ""}`
    : DICTIONARY.assets.modals.title_create;

  return (
    <Modal
      title={title}
      confirmLabel={DICTIONARY.common.actions.save}
      confirmDisabled={!canSave}
      onClose={onClose}
      onConfirm={save}
    >
      <div className="flex flex-col gap-8">
        <div className="relative flex flex-col gap-6">
          <Label htmlFor="asset-label">{DICTIONARY.assets.fields.label}</Label>
          <Input
            id="asset-label"
            value={label}
            aria-invalid={Boolean(labelError)}
            aria-describedby={labelError ? "asset-label-error" : undefined}
            onChange={(event) => setLabel(event.target.value)}
          />
          {labelError ? (
            <p id="asset-label-error" role="alert" className="absolute bottom-[-18px] text-sm text-primitive-red-500">
              {labelError}
            </p>
          ) : null}
        </div>
        <div className="relative flex flex-col gap-6">
          <Label htmlFor="asset-antenna">{DICTIONARY.assets.fields.antenna}</Label>
          <NativeFormSelect
            id="asset-antenna"
            value={antennaId}
            placeholder={DICTIONARY.assets.select_antenna}
            options={ANTENNAS.map((antenna) => ({ value: antenna.id, label: antenna.name }))}
            onChange={setAntennaId}
            ariaInvalid={Boolean(antennaError)}
            className={selectClassName}
          />
          {antennaError ? (
            <p id="asset-antenna-error" role="alert" className="absolute bottom-[-18px] text-sm text-primitive-red-500">
              {antennaError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <Label htmlFor="asset-ammo">
            {DICTIONARY.assets.fields.ammo}
            <span className="ml-1 italic text-primitive-neutral-500">{DICTIONARY.common.optional}</span>
          </Label>
          <MultiSelect
            id="asset-ammo"
            values={ammoIds}
            placeholder={DICTIONARY.assets.select_ammo}
            options={AMMOS.map((ammo) => ({ value: ammo.id, label: ammo.name, badge: ammo.name }))}
            onChange={setAmmoIds}
          />
        </div>
      </div>
    </Modal>
  );
}
