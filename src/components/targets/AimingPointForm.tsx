import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import type { FieldErrors } from "@/lib/targetForm";
import type { AimingPointFormValues } from "@/types/target";

interface AimingPointFormProps {
  values: AimingPointFormValues;
  errors: FieldErrors<AimingPointFormValues>;
  readOnly?: boolean;
  onChange: (field: keyof AimingPointFormValues, value: string) => void;
}

export function AimingPointForm({
  values,
  errors,
  readOnly = false,
  onChange,
}: AimingPointFormProps) {
  const fields = DICTIONARY.targets_catalog.fields;

  return (
    <div className="flex flex-col gap-3">
      {/* <FormField id="ap_displayed_id" label={fields.displayed_id}>
        <Input
          id="ap_displayed_id"
          value={values.displayed_id}
          disabled={readOnly}
          aria-invalid={Boolean(errors.displayed_id)}
          onChange={(event) => onChange("displayed_id", event.target.value)}
          data-error={!!errors.displayed_id}
        />
      </FormField> */}
      <FormField id="ap_name" label={fields.name}>
        <Input
          id="ap_name"
          value={values.name}
          disabled={readOnly}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => onChange("name", event.target.value)}
          data-error={!!errors.name}
        />
      </FormField>
      <FormField id="ap_mgrs" label={fields.mgrs}>
        <Input
          id="ap_mgrs"
          value={values.mgrs}
          disabled={readOnly}
          aria-invalid={Boolean(errors.mgrs)}
          onChange={(event) => onChange("mgrs", event.target.value)}
          data-error={!!errors.mgrs}
        />
      </FormField>
      <FormField id="feat_hgt_msl" label={fields.feat_hgt_msl}>
        <Input
          id="feat_hgt_msl"
          type="number"
          step="0.1"
          value={values.feat_hgt_msl}
          disabled={readOnly}
          aria-invalid={Boolean(errors.feat_hgt_msl)}
          onChange={(event) => onChange("feat_hgt_msl", event.target.value)}
          data-error={!!errors.feat_hgt_msl}
        />
      </FormField>
      <FormField id="agl_msl" label={fields.agl_msl}>
        <Input
          id="agl_msl"
          type="number"
          step="0.1"
          value={values.agl_msl}
          disabled={readOnly}
          aria-invalid={Boolean(errors.agl_msl)}
          onChange={(event) => onChange("agl_msl", event.target.value)}
          data-error={!!errors.agl_msl}
        />
      </FormField>
    </div>
  );
}
