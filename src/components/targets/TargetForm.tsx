import { FormField } from "@/components/forms/FormField";
import { NativeFormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import type { FieldErrors } from "@/lib/targetForm";
import { formatMGRSDisplay, sanitizeMGRSInput } from "@/lib/validation";
import { TARGET_TYPES } from "@/types/target";
import type { TargetFormValues } from "@/types/target";

interface TargetFormProps {
  values: TargetFormValues;
  errors: FieldErrors<TargetFormValues>;
  nameCollision?: boolean;
  mgrsCollision?: boolean;
  readOnly?: boolean;
  onChange: (field: keyof TargetFormValues, value: string) => void;
}

export function TargetForm({
  values,
  errors,
  nameCollision = false,
  mgrsCollision = false,
  readOnly = false,
  onChange,
}: TargetFormProps) {
  const fields = DICTIONARY.targets_catalog.fields;
  const nameInvalid = Boolean(errors.name) || nameCollision;
  const mgrsInvalid = Boolean(errors.mgrs) || mgrsCollision;

  return (
    <div className="flex flex-col gap-3">
      <FormField id="name" label={fields.name} error={nameCollision ? undefined : errors.name}>
        <Input
          id="name"
          value={values.name}
          disabled={readOnly}
          aria-invalid={nameInvalid}
          onChange={(event) => onChange("name", event.target.value)}
          data-error={nameInvalid}
          placeholder={DICTIONARY.targets_catalog.fields.name}
        />
      </FormField>
      <FormField id="address" label={fields.address} error={errors.address}>
        <Input
          id="address"
          value={values.address}
          disabled={readOnly}
          aria-invalid={Boolean(errors.address)}
          onChange={(event) => onChange("address", event.target.value)}
          data-error={!!errors.address}
          placeholder={DICTIONARY.targets_catalog.fields.address}
        />
      </FormField>
      <FormField id="type" label={fields.type} error={errors.type}>
        <NativeFormSelect
          id="type"
          value={values.type}
          disabled={readOnly}
          ariaInvalid={Boolean(errors.type)}
          placeholder={fields.type_placeholder}
          options={TARGET_TYPES.map((type) => ({ value: type, label: type }))}
          onChange={(type) => onChange("type", type)}
          className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer hover:border-primitive-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </FormField>
      <FormField id="mgrs" label={fields.mgrs} error={mgrsCollision ? undefined : errors.mgrs}>
        <Input
          id="mgrs"
          value={values.mgrs}
          disabled={readOnly}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={mgrsInvalid}
          onChange={(event) => onChange("mgrs", sanitizeMGRSInput(event.target.value))}
          onBlur={() => {
            if (readOnly) {
              return;
            }
            const formatted = formatMGRSDisplay(values.mgrs);
            if (formatted !== values.mgrs) {
              onChange("mgrs", formatted);
            }
          }}
          data-error={mgrsInvalid}
          placeholder="36U EV 45210 88320"
        />
      </FormField>
      <FormField id="distance_from_hot_line" label={fields.distance_from_hot_line} error={errors.distance_from_hot_line}>
        <Input
          id="distance_from_hot_line"
          type="number"
          step="0.1"
          value={values.distance_from_hot_line}
          disabled={readOnly}
          aria-invalid={Boolean(errors.distance_from_hot_line)}
          onChange={(event) => onChange("distance_from_hot_line", event.target.value)}
          data-error={!!errors.distance_from_hot_line}
          placeholder={DICTIONARY.targets_catalog.fields.distance_from_hot_line}
        />
      </FormField>
      <FormField id="image_url" label={fields.image_url} error={errors.image_url} optional>
        <Input
          id="image_url"
          value={values.image_url}
          disabled={readOnly}
          onChange={(event) => onChange("image_url", event.target.value)}
        />
      </FormField>
    </div>
  );
}
