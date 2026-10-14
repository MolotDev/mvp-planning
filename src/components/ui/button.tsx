import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium transition-colors hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primitive-blue-500 text-primitive-neutral-0 hover:bg-primitive-blue-500/90 hover:shadow-md",
        ghost:
          "bg-transparent text-primitive-neutral-0 hover:bg-primitive-neutral-850 hover:shadow-md",
        icon: "h-9 w-9 bg-transparent text-primitive-neutral-0 hover:bg-primitive-neutral-850 hover:shadow-md",
      },
      size: {
        default: "h-9 px-3",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
