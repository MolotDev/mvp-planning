import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

type StatusTab = "active" | "archived" | "all" | "reported";

interface StatusToggleProps {
  value: StatusTab;
  onChange: (value: StatusTab) => void;
  disabled?: boolean;
  withReported?: boolean;
}

export function StatusToggle({
  value,
  onChange,
  disabled = false,
  withReported = false,
}: StatusToggleProps) {
  const options: { id: StatusTab; label: string }[] = [
    { id: "active", label: DICTIONARY.common.toggle_tabs.active },
    ...(withReported
      ? [{ id: "reported" as const, label: DICTIONARY.common.toggle_tabs.reported }]
      : []),
    { id: "archived", label: DICTIONARY.common.toggle_tabs.archived },
    { id: "all", label: DICTIONARY.common.toggle_tabs.all },
  ];

  return (
    <div role="tablist" className="inline-flex rounded-md border border-primitive-neutral-700 p-0.5">
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm hover:cursor-pointer hover:bg-primitive-neutral-850 disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "bg-primitive-neutral-800 text-primitive-neutral-0"
                : "text-primitive-neutral-300",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
