import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-2 text-sm text-primitive-neutral-200",
        props.disabled ? "cursor-not-allowed opacity-50" : "hover:cursor-pointer",
      )}
    >
      <input
        id={id}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
