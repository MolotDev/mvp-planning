import { useEffect, useState } from "react";
import { DICTIONARY } from "@/constants/dictionary";
import { aimingCodeFromDigits, aimingDigitsFromCode } from "@/lib/aimingPointCode";
import { cn } from "@/lib/utils";

interface AimingPointInputProps {
  value: string;
  onChange: (newValue: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function AimingPointInput({
  value,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: AimingPointInputProps) {
  const [digits, setDigits] = useState(() => aimingDigitsFromCode(value));

  useEffect(() => {
    setDigits(aimingDigitsFromCode(value));
  }, [value]);

  const commit = (nextDigits: string) => {
    const code = aimingCodeFromDigits(nextDigits);
    setDigits(aimingDigitsFromCode(code));
    onChange(code);
  };

  return (
    <div
      className={cn(
        "inline-flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900",
        "focus-within:border-primitive-blue-500",
        disabled && "opacity-50",
      )}
    >
      <span
        className="select-none border-r border-primitive-neutral-700 bg-primitive-neutral-800 px-2 py-1.5 text-xs font-semibold text-primitive-neutral-400"
        aria-hidden="true"
      >
        MP
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={2}
        value={digits}
        disabled={disabled}
        aria-label={ariaLabel ?? DICTIONARY.tasks.allocation.column_tp}
        placeholder="00"
        onChange={(event) => {
          const clean = event.target.value.replace(/\D/g, "").slice(0, 2);
          setDigits(clean);
          if (clean.length === 2) {
            onChange(aimingCodeFromDigits(clean));
          }
        }}
        onBlur={() => commit(digits)}
        className="h-full w-10 min-w-0 flex-1 bg-transparent py-1.5 text-center font-mono text-sm font-medium text-primitive-neutral-0 outline-none placeholder:text-primitive-neutral-600 disabled:cursor-not-allowed"
      />
    </div>
  );
}
