import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 outline-none",
          "hover:border-primitive-neutral-500 hover:cursor-text",
          "focus:border-primitive-blue-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
