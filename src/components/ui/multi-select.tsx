import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  badge: string;
}

interface MultiSelectProps {
  id: string;
  values: string[];
  options: MultiSelectOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  isRemoveButton?: boolean;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  id,
  className,
  values,
  options,
  onChange,
  disabled = false,
  placeholder = "",
  isRemoveButton = true
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = useMemo(
    () =>
      values.map((value) => {
        const option = options.find((item) => item.value === value);
        return { value, badge: option?.badge ?? value };
      }),
    [options, values],
  );
  const available = useMemo(
    () => options.filter((option) => !values.includes(option.value)),
    [options, values],
  );

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
  }, [open, values]);

  useEffect(() => {
    if (open && available.length === 0) {
      setOpen(false);
    }
  }, [available.length, open]);

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
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) {
      return;
    }
    setOpen((current) => (current ? false : available.length > 0));
  };

  const add = (value: string) => {
    if (values.includes(value)) {
      return;
    }
    const next = [...values, value];
    onChange(next);
    if (options.every((option) => next.includes(option.value))) {
      setOpen(false);
    }
  };

  const remove = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "flex min-h-9 w-full items-center gap-2 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 py-1 text-left text-sm text-primitive-neutral-0",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selected.length === 0 ? (
            <span className="px-1 text-primitive-neutral-500">{placeholder}</span>
          ) : (
            selected.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-full bg-primitive-neutral-0 px-2 py-0.5 text-xs font-medium text-primitive-neutral-900"
              >
                {option.badge}
                {disabled ? null : (
                  <button
                    type="button"
                    title={`${DICTIONARY.common.actions.delete} ${option.badge}`}
                    aria-label={`${DICTIONARY.common.actions.delete} ${option.badge}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(option.value);
                    }}
                    className="inline-flex items-center hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        {selected.length > 0 && !disabled && isRemoveButton ? (
          <button
            type="button"
            title={DICTIONARY.common.actions.clear}
            aria-label={DICTIONARY.common.actions.clear}
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
            className="inline-flex shrink-0 items-center text-primitive-neutral-300 hover:cursor-pointer hover:text-primitive-neutral-0 hover:shadow-md"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {open && menuBox && available.length > 0
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-multiselectable="true"
              aria-labelledby={id}
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
              className="fixed z-[80] max-h-48 overflow-y-auto rounded-md border border-primitive-neutral-700 bg-primitive-neutral-950 py-1 shadow-md"
            >
              {available.map((option) => (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => add(option.value)}
                    className="flex w-full px-3 py-2 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:bg-primitive-neutral-800 hover:shadow-md"
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
