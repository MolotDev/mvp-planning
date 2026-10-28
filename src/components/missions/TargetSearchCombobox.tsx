import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";
import type { Target } from "@/types/target";

interface TargetSearchComboboxProps {
  id: string;
  value: string;
  targets: Target[];
  disabled?: boolean;
  onChange: (targetId: string) => void;
  /** When set, opens in-place create flow instead of navigating to the catalog. */
  onCreateNew?: () => void;
}

function targetLabel(target: Target): string {
  return `${target.mgrs} - ${target.name} (${target.address})`;
}

function matchesQuery(target: Target, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [target.name, target.mgrs, target.address].some((field) => field.toLowerCase().includes(needle));
}

export function TargetSearchCombobox({
  id,
  value,
  targets,
  disabled = false,
  onChange,
  onCreateNew,
}: TargetSearchComboboxProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = targets.find((target) => target.id === value);
  const matches = useMemo(
    () => targets.filter((target) => matchesQuery(target, query)),
    [query, targets],
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
      const gap = 4;
      const pad = 8;
      const width = Math.max(rect.width, 320);
      const left = Math.min(Math.max(pad, rect.left), Math.max(pad, window.innerWidth - width - pad));
      const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
      const spaceAbove = rect.top - gap - pad;
      const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
      const available = Math.max(0, openUpward ? spaceAbove : spaceBelow);
      const listMaxHeight = Math.min(192, Math.max(40, available - 56));
      setMenuBox(
        openUpward
          ? { bottom: window.innerHeight - rect.top + gap, left, width, listMaxHeight }
          : { top: rect.bottom + gap, left, width, listMaxHeight },
      );
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
      setQuery("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuBox]);

  const choose = (targetId: string) => {
    onChange(targetId);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const createTarget = () => {
    setOpen(false);
    setQuery("");
    if (onCreateNew) {
      onCreateNew();
      return;
    }
    navigate("/catalogs/targets?action=create");
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((current) => !current);
        }}
        className="flex h-8 w-full overflow-hidden items-center justify-between gap-2 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <p className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{selected ? targetLabel(selected) : DICTIONARY.missions.select_target}</p>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              style={{
                top: menuBox.top,
                bottom: menuBox.bottom,
                left: menuBox.left,
                width: menuBox.width,
              }}
              className="fixed z-[80] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 py-2 shadow-md"
            >
              <div className="px-2 pb-2">
                <Input
                  ref={searchRef}
                  value={query}
                  aria-label={DICTIONARY.missions.target_search.placeholder}
                  placeholder={DICTIONARY.missions.target_search.placeholder}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {matches.length === 0 ? (
                <div className="flex flex-col gap-2 px-3 pb-1">
                  <p className="text-sm text-primitive-neutral-300">{DICTIONARY.missions.target_search.not_found}</p>
                  <Button variant="ghost" onClick={createTarget}>
                    {DICTIONARY.missions.target_search.create_new}
                  </Button>
                </div>
              ) : (
                <ul
                  role="listbox"
                  aria-labelledby={id}
                  style={{ maxHeight: menuBox.listMaxHeight }}
                  className="overflow-y-auto overscroll-contain"
                >
                  {matches.map((target) => (
                    <li key={target.id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={target.id === value}
                        onClick={() => choose(target.id)}
                        className={cn(
                          "flex w-full px-3 py-2 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:bg-primitive-blue-500 hover:shadow-md",
                          target.id === value && "bg-primitive-blue-500",
                        )}
                      >
                        {targetLabel(target)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
