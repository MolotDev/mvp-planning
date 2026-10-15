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
}: TargetSearchComboboxProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
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
      const width = Math.max(rect.width, 320);
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
      setMenuBox({ top: rect.bottom + 4, left, width });
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
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected ? targetLabel(selected) : DICTIONARY.missions.select_target}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
              className="fixed w-full z-[80] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 py-2 shadow-md"
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
                <ul role="listbox" aria-labelledby={id} className="max-h-48 overflow-y-auto">
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
