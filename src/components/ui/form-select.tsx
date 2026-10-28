import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { invalidControlClass } from "@/components/ui/control-class";
import { cn } from "@/lib/utils";

export interface FormSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

interface FormSelectProps {
  id: string;
  value: string;
  placeholder: string;
  className?: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function FormSelect({
  id,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  className = "",
  invalid = false,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const soleOption = options.length === 1 ? options[0].value : "";

  useEffect(() => {
    if (disabled || value || !soleOption) {
      return;
    }
    onChange(soleOption);
  }, [disabled, onChange, soleOption, value]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const selectedOption = menuRef.current?.querySelector<HTMLButtonElement>("[aria-selected='true']");
    (selectedOption ?? menuRef.current?.querySelector("button"))?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuBox]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const entries = [{ value: "", label: placeholder }, ...options];

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-invalid={invalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
          className,
          invalid && invalidControlClass,
        )}
        >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open && menuBox
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-labelledby={id}
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
              className="fixed z-[80] max-h-48 overflow-y-auto rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 py-1 shadow-md"
            >
              {entries.map((option) => (
                <li key={option.value || "empty"} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => choose(option.value)}
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:bg-primitive-blue-500 hover:shadow-md",
                      option.value === value && "bg-primitive-blue-500",
                    )}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

function SelectOptions({ options }: { options: FormSelectOption[] }) {
  const optionNode = (option: FormSelectOption) => (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  );
  if (!options.some((option) => option.group)) {
    return <>{options.map(optionNode)}</>;
  }
  const loose = options.filter((option) => !option.group);
  const groups: { label: string; options: FormSelectOption[] }[] = [];
  options.forEach((option) => {
    if (!option.group) {
      return;
    }
    const current = groups.find((group) => group.label === option.group);
    if (current) {
      current.options.push(option);
      return;
    }
    groups.push({ label: option.group, options: [option] });
  });
  return (
    <>
      {loose.map(optionNode)}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map(optionNode)}
        </optgroup>
      ))}
    </>
  );
}

interface NativeFormSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
  autoSelect?: boolean;
  tabIndex?: number;
}

export function NativeFormSelect({
  id,
  tabIndex,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  ariaInvalid,
  ariaLabel,
  invalid = false,
  autoSelect = true,
}: NativeFormSelectProps) {
  const soleOption = options.length === 1 ? options[0].value : "";

  useEffect(() => {
    if (disabled || value || !soleOption || !autoSelect) {
      return;
    }
    onChange(soleOption);
  }, [disabled, onChange, soleOption, value, autoSelect]);

  return (
    <select
      id={id}
      tabIndex={tabIndex}
      value={value}
      disabled={disabled}
      data-error={ariaInvalid || invalid}
      aria-invalid={ariaInvalid || invalid}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className={cn(className, invalid && invalidControlClass)}
      title={options.find((option) => option.value === value)?.label ?? placeholder}
    >
      <option value="">{placeholder}</option>
      <SelectOptions options={options} />
    </select>
  );
}
