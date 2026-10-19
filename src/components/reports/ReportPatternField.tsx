import { useEffect, useState } from "react";
import { invalidControlClass } from "@/components/ui/control-class";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

interface ReportPatternFieldProps {
  value: string;
  onValue: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  pattern?: RegExp;
  required?: boolean;
  patternMessage?: string;
  inputClassName?: string;
  patternPlaceholder?: string;
  accepts?: (value: string) => boolean;
}

export function ReportPatternField({
  value,
  patternPlaceholder,
  onValue,
  ariaLabel,
  disabled = false,
  pattern,
  required = false,
  patternMessage,
  inputClassName = "",
  accepts,
}: ReportPatternFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const trimmed = draft.trim();
  const patternInvalid = Boolean(pattern && trimmed && !pattern.test(trimmed));
  const rejected = Boolean(trimmed && accepts && !accepts(trimmed));
  const requiredInvalid = Boolean(required && !trimmed);
  const message = patternInvalid || rejected
    ? (patternMessage ?? DICTIONARY.targets_catalog.validation.required)
    : requiredInvalid
      ? DICTIONARY.targets_catalog.validation.required
      : null;

  return (
    <div className="flex min-w-10 flex-col gap-1.5">
      <Input
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={Boolean(message)}
        placeholder={patternPlaceholder}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const nextTrimmed = next.trim();
          if (!pattern || pattern.test(nextTrimmed)) {
            onValue(nextTrimmed);
          }
        }}
        onBlur={() => {
          if (!draft.trim()) {
            onValue("");
          }
        }}
        className={cn(inputClassName, message ? invalidControlClass : "border-primitive-neutral-100")}
      />
    </div>
  );
}
