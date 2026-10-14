import { FormField } from "@/components/forms/FormField";
import { NativeFormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { TARGET_TYPES } from "@/types/target";
import type { FieldErrors } from "@/lib/targetForm";
import type { TargetFormValues } from "@/types/target";

interface TargetFormProps {
  values: TargetFormValues;
  errors: FieldErrors<TargetFormValues>;
  readOnly?: boolean;
  onChange: (field: keyof TargetFormValues, value: string) => void;
}

export function TargetForm({ values, errors, readOnly = false, onChange }: TargetFormProps) {
  const fields = DICTIONARY.targets_catalog.fields;

  return (
    <div className="flex flex-col gap-3">
      {/* <FormField id="displayed_id" label={fields.displayed_id} error={errors.displayed_id}>
        <Input
          id="displayed_id"
          value={values.displayed_id}
          disabled={readOnly}
          aria-invalid={Boolean(errors.displayed_id)}
          onChange={(event) => onChange("displayed_id", event.target.value)}
        />
      </FormField> */}
      <FormField id="name" label={fields.name}>
        <Input
          id="name"
          value={values.name}
          disabled={readOnly}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => onChange("name", event.target.value)}
          data-error={!!errors.name}
        />
      </FormField>
      <FormField id="address" label={fields.address}>
        <Input
          id="address"
          value={values.address}
          disabled={readOnly}
          aria-invalid={Boolean(errors.address)}
          onChange={(event) => onChange("address", event.target.value)}
          data-error={!!errors.address}
        />
      </FormField>
      <FormField id="type" label={fields.type}>
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
      <FormField id="mgrs" label={fields.mgrs}>
        <Input
          id="mgrs"
          value={values.mgrs}
          disabled={readOnly}
          aria-invalid={Boolean(errors.mgrs)}
          onChange={(event) => onChange("mgrs", event.target.value)}
          data-error={!!errors.mgrs}
        />
      </FormField>
      <FormField
        id="distance_from_hot_line"
        label={fields.distance_from_hot_line}
      >
        <Input
          id="distance_from_hot_line"
          type="number"
          step="0.1"
          value={values.distance_from_hot_line}
          disabled={readOnly}
          aria-invalid={Boolean(errors.distance_from_hot_line)}
          onChange={(event) => onChange("distance_from_hot_line", event.target.value)}
          data-error={!!errors.distance_from_hot_line}
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
